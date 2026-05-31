import { TestBed } from '@angular/core/testing';
import { PendingApprovalService } from './pending-approval.service';
import { ToolRegistryService } from './tool-registry.service';
import type { ToolUseBlock } from '../models/ai-chat.model';

describe('PendingApprovalService (gap-closure 03-07, SC3-NO-PERSIST)', () => {
  let service: PendingApprovalService;
  let registrySpy: jasmine.SpyObj<ToolRegistryService>;

  const memoryBlock = (): ToolUseBlock => ({
    type: 'tool_use',
    id: 'tu1',
    name: 'memory',
    input: { command: 'create', path: '/memories/seed-1.md', file_text: 'hi' },
    status: 'approved',
  });

  beforeEach(() => {
    registrySpy = jasmine.createSpyObj<ToolRegistryService>('ToolRegistryService', [
      'has',
      'dispatch',
    ]);
    TestBed.configureTestingModule({
      providers: [
        PendingApprovalService,
        { provide: ToolRegistryService, useValue: registrySpy },
      ],
    });
    service = TestBed.inject(PendingApprovalService);
  });

  it('dispatches an approved memory create through ToolRegistryService and returns isError=false on success', async () => {
    registrySpy.has.and.returnValue(true);
    registrySpy.dispatch.and.returnValue(
      Promise.resolve('File created successfully at: /memories/seed-1.md'),
    );
    const block = memoryBlock();
    const result = await service.executeApprovedToolUse(block);
    expect(registrySpy.dispatch).toHaveBeenCalledWith('memory', block.input);
    expect(result).toEqual({
      content: 'File created successfully at: /memories/seed-1.md',
      isError: false,
    });
  });

  it('returns isError=true when the executor result string starts with Error:', async () => {
    registrySpy.has.and.returnValue(true);
    registrySpy.dispatch.and.returnValue(
      Promise.resolve('Error: File /memories/x.md already exists'),
    );
    const result = await service.executeApprovedToolUse(memoryBlock());
    expect(result.isError).toBe(true);
    expect(result.content).toContain('already exists');
  });

  it('returns isError=true (does not throw) when the tool is not registered', async () => {
    registrySpy.has.and.returnValue(false);
    const block = { ...memoryBlock(), name: 'update_profile' };
    const result = await service.executeApprovedToolUse(block);
    expect(registrySpy.dispatch).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content).toContain('unknown tool');
  });

  it('returns isError=true (does not throw) when dispatch rejects', async () => {
    registrySpy.has.and.returnValue(true);
    registrySpy.dispatch.and.returnValue(Promise.reject(new Error('boom')));
    const result = await service.executeApprovedToolUse(memoryBlock());
    expect(result.isError).toBe(true);
    expect(result.content).toContain('boom');
  });
});
