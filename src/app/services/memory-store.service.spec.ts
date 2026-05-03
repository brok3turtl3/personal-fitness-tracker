import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MemoryStoreService } from './memory-store.service';
import { StorageService } from './storage.service';
import { AppData, createEmptyAppData } from '../models/app-data.model';

describe('MemoryStoreService', () => {
  let service: MemoryStoreService;
  let storageServiceSpy: jasmine.SpyObj<StorageService>;
  let mockAppData: AppData;

  beforeEach(() => {
    mockAppData = createEmptyAppData();

    storageServiceSpy = jasmine.createSpyObj('StorageService', [
      'initialize',
      'getData',
      'saveData',
    ]);
    storageServiceSpy.initialize.and.returnValue(of(undefined));
    storageServiceSpy.getData.and.returnValue(of(mockAppData));
    storageServiceSpy.saveData.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        MemoryStoreService,
        { provide: StorageService, useValue: storageServiceSpy },
      ],
    });

    service = TestBed.inject(MemoryStoreService);
  });

  describe('listFiles', () => {
    it('returns [] when memoryFiles is empty', (done) => {
      service.listFiles().subscribe((entries) => {
        expect(entries).toEqual([]);
        done();
      });
    });

    it('returns entries sorted lexicographically by path', (done) => {
      mockAppData.memoryFiles = {
        '/memories/zebra.md': 'z',
        '/memories/apple.md': 'a',
        '/memories/mango.md': 'mm',
      };
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.listFiles().subscribe((entries) => {
        expect(entries.map((e) => e.path)).toEqual([
          '/memories/apple.md',
          '/memories/mango.md',
          '/memories/zebra.md',
        ]);
        done();
      });
    });

    it('returns size equal to content.length', (done) => {
      mockAppData.memoryFiles = { '/memories/note.md': 'hello world' };
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.listFiles().subscribe((entries) => {
        expect(entries.length).toBe(1);
        expect(entries[0].size).toBe('hello world'.length);
        done();
      });
    });

    it('returns [] when AppData is null', (done) => {
      storageServiceSpy.getData.and.returnValue(of(null));

      service.listFiles().subscribe((entries) => {
        expect(entries).toEqual([]);
        done();
      });
    });
  });

  describe('readFile', () => {
    it('returns content for an existing path', (done) => {
      mockAppData.memoryFiles = { '/memories/notes.md': 'hello' };
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.readFile('/memories/notes.md').subscribe((content) => {
        expect(content).toBe('hello');
        done();
      });
    });

    it('returns null for a missing path', (done) => {
      service.readFile('/memories/missing.md').subscribe((content) => {
        expect(content).toBeNull();
        done();
      });
    });

    it('returns null when AppData is null', (done) => {
      storageServiceSpy.getData.and.returnValue(of(null));

      service.readFile('/memories/x').subscribe((content) => {
        expect(content).toBeNull();
        done();
      });
    });
  });

  describe('writeFile', () => {
    it('creates a new entry when path is unused', (done) => {
      service.writeFile('/memories/new.md', 'hi').subscribe({
        next: () => {
          expect(storageServiceSpy.saveData).toHaveBeenCalledTimes(1);
          const saved = storageServiceSpy.saveData.calls.mostRecent()
            .args[0] as AppData;
          expect(saved.memoryFiles['/memories/new.md']).toBe('hi');
          done();
        },
        error: (err) => done.fail(`unexpected error: ${err.message}`),
      });
    });

    it('overwrites an existing entry at the same path', (done) => {
      mockAppData.memoryFiles = { '/memories/x.md': 'old' };
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.writeFile('/memories/x.md', 'new').subscribe({
        next: () => {
          const saved = storageServiceSpy.saveData.calls.mostRecent()
            .args[0] as AppData;
          expect(saved.memoryFiles['/memories/x.md']).toBe('new');
          done();
        },
        error: (err) => done.fail(`unexpected error: ${err.message}`),
      });
    });
  });

  describe('deleteFile', () => {
    it('returns true and removes the entry when path exists', (done) => {
      mockAppData.memoryFiles = {
        '/memories/keep.md': 'k',
        '/memories/gone.md': 'g',
      };
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.deleteFile('/memories/gone.md').subscribe({
        next: (ok) => {
          expect(ok).toBeTrue();
          const saved = storageServiceSpy.saveData.calls.mostRecent()
            .args[0] as AppData;
          expect(Object.keys(saved.memoryFiles)).toEqual(['/memories/keep.md']);
          done();
        },
        error: (err) => done.fail(`unexpected error: ${err.message}`),
      });
    });

    it('returns false and does not call saveData when path is missing', (done) => {
      service.deleteFile('/memories/missing.md').subscribe({
        next: (ok) => {
          expect(ok).toBeFalse();
          expect(storageServiceSpy.saveData).not.toHaveBeenCalled();
          done();
        },
        error: (err) => done.fail(`unexpected error: ${err.message}`),
      });
    });
  });

  describe('renameFile', () => {
    it('returns true and remaps content from old to new path', (done) => {
      mockAppData.memoryFiles = { '/memories/old.md': 'data' };
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.renameFile('/memories/old.md', '/memories/new.md').subscribe({
        next: (ok) => {
          expect(ok).toBeTrue();
          const saved = storageServiceSpy.saveData.calls.mostRecent()
            .args[0] as AppData;
          expect(saved.memoryFiles['/memories/old.md']).toBeUndefined();
          expect(saved.memoryFiles['/memories/new.md']).toBe('data');
          done();
        },
        error: (err) => done.fail(`unexpected error: ${err.message}`),
      });
    });

    it('returns false when oldPath is missing', (done) => {
      service.renameFile('/memories/missing.md', '/memories/new.md').subscribe({
        next: (ok) => {
          expect(ok).toBeFalse();
          expect(storageServiceSpy.saveData).not.toHaveBeenCalled();
          done();
        },
        error: (err) => done.fail(`unexpected error: ${err.message}`),
      });
    });

    it('returns false when newPath already exists (does not clobber)', (done) => {
      mockAppData.memoryFiles = {
        '/memories/old.md': 'old-data',
        '/memories/new.md': 'new-data',
      };
      storageServiceSpy.getData.and.returnValue(of(mockAppData));

      service.renameFile('/memories/old.md', '/memories/new.md').subscribe({
        next: (ok) => {
          expect(ok).toBeFalse();
          expect(storageServiceSpy.saveData).not.toHaveBeenCalled();
          done();
        },
        error: (err) => done.fail(`unexpected error: ${err.message}`),
      });
    });
  });
});
