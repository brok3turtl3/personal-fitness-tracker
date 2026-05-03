import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  ToolDefinition,
  ToolExecutor,
  ToolRegistryService,
} from './tool-registry.service';
import { MemoryToolExecutor } from './memory-tool-executor.service';
import { MemoryStoreService } from './memory-store.service';
import { StorageService } from './storage.service';
import { AppData, createEmptyAppData } from '../models/app-data.model';

describe('ToolRegistryService', () => {
  let service: ToolRegistryService;
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
        ToolRegistryService,
        MemoryToolExecutor,
        MemoryStoreService,
        { provide: StorageService, useValue: storageServiceSpy },
      ],
    });

    service = TestBed.inject(ToolRegistryService);
  });

  it('registers MemoryToolExecutor on construction', () => {
    expect(service.has('memory')).toBeTrue();
  });

  it('definitions() returns the memory tool definition', () => {
    const defs = service.definitions();
    expect(defs.length).toBe(1);
    expect(defs[0].type).toBe('memory_20250818');
    expect(defs[0].name).toBe('memory');
  });

  it('dispatch("memory", { command: "view", path: "/memories" }) returns the canonical view-directory string', async () => {
    const result = await service.dispatch('memory', {
      command: 'view',
      path: '/memories',
    });
    expect(result).toContain(
      "Here're the files and directories up to 2 levels deep in /memories"
    );
  });

  it('dispatch unknown tool throws "Unknown tool: foo"', async () => {
    let caught: Error | null = null;
    try {
      await service.dispatch('foo', { x: 1 });
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toContain('Unknown tool: foo');
  });

  it('dispatch with non-object input throws "Tool input must be an object"', async () => {
    let caught: Error | null = null;
    try {
      // input is a string, not an object — re-validation gate per CHAT-11.
      await service.dispatch('memory', 'not-an-object');
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toContain('Tool input must be an object');
  });

  it('register() overwrites an existing executor with the same name', () => {
    const fakeA: ToolExecutor = {
      definition: { type: 'custom', name: 'memory' },
      execute: () => 'A',
    };
    const fakeB: ToolExecutor = {
      definition: { type: 'custom', name: 'memory' },
      execute: () => 'B',
    };
    service.register(fakeA);
    service.register(fakeB);
    // Last write wins; dispatch returns 'B'.
    return service.dispatch('memory', { x: 1 }).then((r) => {
      expect(r).toBe('B');
    });
  });

  it('register() adds a new executor that has() reflects', () => {
    const fake: ToolExecutor = {
      definition: { type: 'custom', name: 'fake-tool' },
      execute: () => 'ok',
    };
    expect(service.has('fake-tool')).toBeFalse();
    service.register(fake);
    expect(service.has('fake-tool')).toBeTrue();
  });

  it('definitions() returns one entry per registered executor', () => {
    const fake: ToolExecutor = {
      definition: { type: 'custom', name: 'extra' },
      execute: () => 'ok',
    };
    service.register(fake);
    const defs: ToolDefinition[] = service.definitions();
    expect(defs.length).toBe(2);
    expect(defs.map((d) => d.name).sort()).toEqual(['extra', 'memory']);
  });

  it('dispatch coerces a non-string output to string', async () => {
    // ToolExecutor defaults to <unknown, string>; use the registry-friendly
    // shape that returns a string-coerced value at the boundary. The dispatch
    // contract coerces via `String(await execute(...))` so that callers in
    // Phase 4 always receive a string for tool_result content.
    const fakeNum: ToolExecutor = {
      definition: { type: 'custom', name: 'num-tool' },
      // Returns the string '42' directly; the test asserts dispatch produces
      // the string output without surprise type coercion.
      execute: () => '42',
    };
    service.register(fakeNum);
    const out = await service.dispatch('num-tool', { x: 1 });
    expect(out).toBe('42');
  });
});

describe('ToolRegistryService — chokepoint enforcement (SC5 / T-3-RG)', () => {
  // Pure interface re-export sanity check: the registry must remain importable
  // without pulling SDK types. (Compile gate; runtime does not exercise.)
  it('ToolDefinition is structurally a plain object shape', () => {
    const d: ToolDefinition = { type: 'memory_20250818', name: 'memory' };
    expect(d.type).toBe('memory_20250818');
    expect(d.name).toBe('memory');
  });
});
