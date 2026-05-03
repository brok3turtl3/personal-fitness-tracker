import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MemoryToolExecutor } from './memory-tool-executor.service';
import { MemoryStoreService } from './memory-store.service';
import { StorageService } from './storage.service';
import { AppData, createEmptyAppData } from '../models/app-data.model';

describe('MemoryToolExecutor', () => {
  let executor: MemoryToolExecutor;
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
    storageServiceSpy.getData.and.callFake(() => of(mockAppData));
    storageServiceSpy.saveData.and.callFake((d) => {
      mockAppData = d;
      return of(undefined);
    });

    TestBed.configureTestingModule({
      providers: [
        MemoryToolExecutor,
        MemoryStoreService,
        { provide: StorageService, useValue: storageServiceSpy },
      ],
    });

    executor = TestBed.inject(MemoryToolExecutor);
  });

  describe('definition', () => {
    it('declares the memory_20250818 server-typed tool', () => {
      expect(executor.definition.type).toBe('memory_20250818');
      expect(executor.definition.name).toBe('memory');
    });
  });

  describe('input shape errors', () => {
    it('returns invalid-command error for non-object input (string)', async () => {
      const result = await executor.execute('hello');
      expect(result).toContain('Error: invalid memory command');
    });

    it('returns invalid-command error when command field missing', async () => {
      const result = await executor.execute({ path: '/memories/x.md' });
      expect(result).toContain('Error: invalid memory command');
    });

    it('returns unknown-command error for unrecognized command', async () => {
      const result = await executor.execute({
        command: 'destroy',
        path: '/memories/x.md',
      });
      expect(result).toContain('Error: unknown command');
      expect(result).toContain('destroy');
    });
  });

  describe('view command', () => {
    it('directory listing returns canonical "Here\'re the files..." string', async () => {
      mockAppData.memoryFiles = {
        '/memories/a.md': 'aa',
        '/memories/b.md': 'bbb',
      };
      const result = await executor.execute({
        command: 'view',
        path: '/memories',
      });
      expect(result).toContain(
        "Here're the files and directories up to 2 levels deep in /memories"
      );
      expect(result).toContain('/memories/a.md');
      expect(result).toContain('/memories/b.md');
    });

    it('file view returns canonical "Here\'s the content..." string with right-padded line numbers', async () => {
      mockAppData.memoryFiles = { '/memories/notes.md': 'line1\nline2\nline3' };
      const result = await executor.execute({
        command: 'view',
        path: '/memories/notes.md',
      });
      expect(result).toContain("Here's the content of /memories/notes.md with line numbers:");
      // 6-char right-aligned line numbers separated by tab
      expect(result).toContain('     1\tline1');
      expect(result).toContain('     2\tline2');
      expect(result).toContain('     3\tline3');
    });

    it('missing file returns canonical "does not exist" string', async () => {
      const result = await executor.execute({
        command: 'view',
        path: '/memories/missing.md',
      });
      expect(result).toContain(
        'The path /memories/missing.md does not exist. Please provide a valid path.'
      );
    });
  });

  describe('create command', () => {
    it('success returns "File created successfully at: {path}"', async () => {
      const result = await executor.execute({
        command: 'create',
        path: '/memories/new.md',
        file_text: 'hello',
      });
      expect(result).toBe('File created successfully at: /memories/new.md');
      expect(mockAppData.memoryFiles['/memories/new.md']).toBe('hello');
    });

    it('existing file returns "Error: File {path} already exists"', async () => {
      mockAppData.memoryFiles = { '/memories/exists.md': 'old' };
      const result = await executor.execute({
        command: 'create',
        path: '/memories/exists.md',
        file_text: 'new',
      });
      expect(result).toBe('Error: File /memories/exists.md already exists');
      // not overwritten
      expect(mockAppData.memoryFiles['/memories/exists.md']).toBe('old');
    });
  });

  describe('str_replace command', () => {
    it('success returns "The memory file has been edited." with snippet', async () => {
      mockAppData.memoryFiles = { '/memories/n.md': 'aaa\nbbb\nccc' };
      const result = await executor.execute({
        command: 'str_replace',
        path: '/memories/n.md',
        old_str: 'bbb',
        new_str: 'BBB',
      });
      expect(result).toContain('The memory file has been edited.');
      expect(mockAppData.memoryFiles['/memories/n.md']).toBe('aaa\nBBB\nccc');
    });

    it('missing file returns canonical does-not-exist', async () => {
      const result = await executor.execute({
        command: 'str_replace',
        path: '/memories/none.md',
        old_str: 'x',
        new_str: 'y',
      });
      expect(result).toContain(
        'Error: The path /memories/none.md does not exist. Please provide a valid path.'
      );
    });

    it('not-found old_str returns canonical "No replacement was performed, old_str ..."', async () => {
      mockAppData.memoryFiles = { '/memories/n.md': 'abc' };
      const result = await executor.execute({
        command: 'str_replace',
        path: '/memories/n.md',
        old_str: 'NOT_THERE',
        new_str: 'y',
      });
      expect(result).toContain('No replacement was performed, old_str');
      expect(result).toContain('NOT_THERE');
      expect(result).toContain('did not appear verbatim in /memories/n.md');
    });

    it('multiple occurrences returns canonical "Multiple occurrences..." with line numbers', async () => {
      mockAppData.memoryFiles = {
        '/memories/n.md': 'foo\nbar\nfoo\nbaz\nfoo',
      };
      const result = await executor.execute({
        command: 'str_replace',
        path: '/memories/n.md',
        old_str: 'foo',
        new_str: 'F',
      });
      expect(result).toContain('No replacement was performed. Multiple occurrences');
      expect(result).toContain('foo');
      expect(result).toContain('1');
      expect(result).toContain('3');
      expect(result).toContain('5');
    });
  });

  describe('insert command', () => {
    it('success returns "The file {path} has been edited."', async () => {
      mockAppData.memoryFiles = { '/memories/n.md': 'a\nb\nc' };
      const result = await executor.execute({
        command: 'insert',
        path: '/memories/n.md',
        insert_line: 1,
        insert_text: 'X',
      });
      expect(result).toBe('The file /memories/n.md has been edited.');
      expect(mockAppData.memoryFiles['/memories/n.md']).toBe('a\nX\nb\nc');
    });

    it('out-of-range line returns canonical "Invalid `insert_line` parameter..." with [0, n] range', async () => {
      mockAppData.memoryFiles = { '/memories/n.md': 'a\nb\nc' };
      const result = await executor.execute({
        command: 'insert',
        path: '/memories/n.md',
        insert_line: 99,
        insert_text: 'X',
      });
      expect(result).toContain('Invalid `insert_line` parameter');
      expect(result).toContain('99');
      expect(result).toContain('[0,');
    });

    it('missing file returns canonical "Error: The path ... does not exist"', async () => {
      const result = await executor.execute({
        command: 'insert',
        path: '/memories/none.md',
        insert_line: 0,
        insert_text: 'X',
      });
      expect(result).toContain('Error: The path /memories/none.md does not exist');
    });
  });

  describe('delete command', () => {
    it('success returns "Successfully deleted {path}"', async () => {
      mockAppData.memoryFiles = { '/memories/gone.md': 'data' };
      const result = await executor.execute({
        command: 'delete',
        path: '/memories/gone.md',
      });
      expect(result).toBe('Successfully deleted /memories/gone.md');
      expect(mockAppData.memoryFiles['/memories/gone.md']).toBeUndefined();
    });

    it('missing path returns "Error: The path ... does not exist"', async () => {
      const result = await executor.execute({
        command: 'delete',
        path: '/memories/none.md',
      });
      expect(result).toContain('Error: The path /memories/none.md does not exist');
    });
  });

  describe('rename command', () => {
    it('success returns "Successfully renamed {old} to {new}"', async () => {
      mockAppData.memoryFiles = { '/memories/old.md': 'data' };
      const result = await executor.execute({
        command: 'rename',
        old_path: '/memories/old.md',
        new_path: '/memories/new.md',
      });
      expect(result).toBe('Successfully renamed /memories/old.md to /memories/new.md');
      expect(mockAppData.memoryFiles['/memories/old.md']).toBeUndefined();
      expect(mockAppData.memoryFiles['/memories/new.md']).toBe('data');
    });

    it('missing old returns does-not-exist', async () => {
      const result = await executor.execute({
        command: 'rename',
        old_path: '/memories/missing.md',
        new_path: '/memories/new.md',
      });
      expect(result).toContain('Error: The path /memories/missing.md does not exist');
    });

    it('existing destination returns "Error: The destination ... already exists"', async () => {
      mockAppData.memoryFiles = {
        '/memories/old.md': 'A',
        '/memories/new.md': 'B',
      };
      const result = await executor.execute({
        command: 'rename',
        old_path: '/memories/old.md',
        new_path: '/memories/new.md',
      });
      expect(result).toContain(
        'Error: The destination /memories/new.md already exists'
      );
    });
  });

  describe('path validator — traversal corpus (T-3-PT)', () => {
    // Each input must be rejected by validatePath, surfacing as "Error:" string.
    it('rejects /memories/.. (parent traversal)', async () => {
      const result = await executor.execute({
        command: 'view',
        path: '/memories/..',
      });
      expect(result).toMatch(/^Error:/);
      expect(result.toLowerCase()).toContain('traversal');
    });

    it('rejects /memories/../etc/passwd (multi-level traversal)', async () => {
      const result = await executor.execute({
        command: 'view',
        path: '/memories/../etc/passwd',
      });
      expect(result).toMatch(/^Error:/);
    });

    it('rejects /memories%2e%2e/foo (URL-encoded traversal — lowercase)', async () => {
      const result = await executor.execute({
        command: 'view',
        path: '/memories%2e%2e/foo',
      });
      expect(result).toMatch(/^Error:/);
      expect(result.toLowerCase()).toMatch(/traversal|memories/);
    });

    it('rejects /memories%2E%2E/foo (URL-encoded traversal — uppercase)', async () => {
      const result = await executor.execute({
        command: 'view',
        path: '/memories%2E%2E/foo',
      });
      expect(result).toMatch(/^Error:/);
    });

    it('rejects /memories/\\0evil (NUL byte)', async () => {
      const result = await executor.execute({
        command: 'view',
        path: '/memories/ evil',
      });
      expect(result).toMatch(/^Error:/);
      expect(result.toLowerCase()).toContain('nul');
    });

    it('rejects /memories/foo\\nbar (embedded newline)', async () => {
      const result = await executor.execute({
        command: 'view',
        path: '/memories/foo\nbar',
      });
      expect(result).toMatch(/^Error:/);
      expect(result.toLowerCase()).toContain('newline');
    });

    it('rejects /memories/foo\\r (embedded carriage return)', async () => {
      const result = await executor.execute({
        command: 'view',
        path: '/memories/foo\rbar',
      });
      expect(result).toMatch(/^Error:/);
    });

    it('rejects /etc/passwd (no /memories prefix)', async () => {
      const result = await executor.execute({
        command: 'view',
        path: '/etc/passwd',
      });
      expect(result).toMatch(/^Error:/);
      expect(result.toLowerCase()).toContain('memories');
    });

    it('rejects empty string', async () => {
      const result = await executor.execute({ command: 'view', path: '' });
      expect(result).toMatch(/^Error:/);
    });

    it('rejects null path', async () => {
      const result = await executor.execute({
        command: 'view',
        path: null,
      });
      expect(result).toMatch(/^Error:/);
    });

    it('rejects undefined path', async () => {
      const result = await executor.execute({ command: 'view' });
      expect(result).toMatch(/^Error:/);
    });

    it('rejects /memoriesbad/foo (prefix-but-not-segment)', async () => {
      // `/memoriesbad/foo` starts with `/memories` lexically but the parsed
      // first path segment is `memoriesbad`, not `memories`. The parsed-segment
      // check must catch this.
      const result = await executor.execute({
        command: 'view',
        path: '/memoriesbad/foo',
      });
      expect(result).toMatch(/^Error:/);
    });

    it('rejects rename when new_path is invalid', async () => {
      mockAppData.memoryFiles = { '/memories/ok.md': 'data' };
      const result = await executor.execute({
        command: 'rename',
        old_path: '/memories/ok.md',
        new_path: '/memories/../escape.md',
      });
      expect(result).toMatch(/^Error:/);
    });
  });
});
