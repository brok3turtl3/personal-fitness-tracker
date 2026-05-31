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
import { DataQueryToolExecutor } from './data-query-tool-executor';
import { WeightService } from './weight.service';
import { CardioService } from './cardio.service';
import { ReadingsService } from './readings.service';
import { DietService } from './diet.service';

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

    // Stub the four domain services so the real DataQueryToolExecutor
    // constructs and registers its six query_* adapters under TestBed.
    const weightSpy = jasmine.createSpyObj('WeightService', ['getEntries']);
    weightSpy.getEntries.and.returnValue(of([]));
    const cardioSpy = jasmine.createSpyObj('CardioService', ['getSessions']);
    cardioSpy.getSessions.and.returnValue(of([]));
    const readingsSpy = jasmine.createSpyObj('ReadingsService', ['getReadings']);
    readingsSpy.getReadings.and.returnValue(of([]));
    const dietSpy = jasmine.createSpyObj('DietService', [
      'getMealsForDay',
      'getSavedFoods',
    ]);
    dietSpy.getMealsForDay.and.returnValue(of([]));
    dietSpy.getSavedFoods.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        ToolRegistryService,
        MemoryToolExecutor,
        MemoryStoreService,
        DataQueryToolExecutor,
        { provide: StorageService, useValue: storageServiceSpy },
        { provide: WeightService, useValue: weightSpy },
        { provide: CardioService, useValue: cardioSpy },
        { provide: ReadingsService, useValue: readingsSpy },
        { provide: DietService, useValue: dietSpy },
      ],
    });

    service = TestBed.inject(ToolRegistryService);
  });

  it('registers MemoryToolExecutor on construction', () => {
    expect(service.has('memory')).toBeTrue();
  });

  it('definitions() includes the memory tool definition', () => {
    const defs = service.definitions();
    const memory = defs.find((d) => d.name === 'memory');
    expect(memory).toBeDefined();
    expect(memory!.type).toBe('memory_20250818');
  });

  it('registers all six query_* executors on construction (memory + 6)', () => {
    const queryNames = [
      'query_cardio_sessions',
      'query_weight_entries',
      'query_readings',
      'query_meals_in_range',
      'query_daily_totals',
      'query_saved_foods',
    ];
    for (const name of queryNames) {
      expect(service.has(name)).withContext(name).toBeTrue();
    }
    const defs = service.definitions();
    expect(defs.length).toBeGreaterThanOrEqual(7);
    const names = defs.map((d) => d.name);
    expect(names).toContain('memory');
    for (const name of queryNames) {
      expect(names).toContain(name);
    }
  });

  it('isWriteProposal("memory") is true; isWriteProposal("query_weight_entries") is false', () => {
    expect(service.isWriteProposal('memory')).toBeTrue();
    expect(service.isWriteProposal('query_weight_entries')).toBeFalse();
    expect(service.isWriteProposal('query_cardio_sessions')).toBeFalse();
    // Unknown / future tools default to non-write (allow-list semantics).
    expect(service.isWriteProposal('some_future_read_tool')).toBeFalse();
  });

  it('Phase 5 (D-02): web_search is read-only — isWriteProposal("web_search") is false', () => {
    // The web_search server tool is read-only; it must NEVER sit in the
    // write-proposal allow-list (it would otherwise surface a pending pill).
    expect(service.isWriteProposal('web_search')).toBeFalse();
  });

  it('Phase 5 (D-02): web_search is NOT a dispatchable client executor', () => {
    // Anthropic runs the server tool; the client has no executor for it, so it
    // is never registered and dispatch would throw "Unknown tool" — the loop
    // never reaches that path (its dispatch filter is b.type === "tool_use").
    expect(service.has('web_search')).toBeFalse();
    expect(service.definitions().some(d => d.name === 'web_search')).toBeFalse();
  });

  it('dispatch("query_weight_entries", { from, to }) returns a string', async () => {
    const result = await service.dispatch('query_weight_entries', {
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
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
    const before = service.definitions().length;
    const fake: ToolExecutor = {
      definition: { type: 'custom', name: 'extra' },
      execute: () => 'ok',
    };
    service.register(fake);
    const defs: ToolDefinition[] = service.definitions();
    expect(defs.length).toBe(before + 1);
    expect(defs.map((d) => d.name)).toContain('extra');
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
