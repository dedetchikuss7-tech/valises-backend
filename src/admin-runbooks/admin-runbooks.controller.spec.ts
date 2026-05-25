import { Test, TestingModule } from '@nestjs/testing';
import { AdminRunbooksController } from './admin-runbooks.controller';

describe('AdminRunbooksController', () => {
  let controller: AdminRunbooksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminRunbooksController],
    }).compile();

    controller = module.get<AdminRunbooksController>(AdminRunbooksController);
  });

  it('returns a list of runbooks', () => {
    const result = controller.list();
    expect(result).toHaveProperty('runbooks');
    expect(Array.isArray(result.runbooks)).toBe(true);
  });

  it('returns exactly 5 runbooks', () => {
    const result = controller.list();
    expect(result.runbooks).toHaveLength(5);
  });

  it('each runbook has required fields', () => {
    const result = controller.list();
    for (const rb of result.runbooks) {
      expect(rb).toHaveProperty('slug');
      expect(rb).toHaveProperty('title');
      expect(rb).toHaveProperty('path');
      expect(rb).toHaveProperty('severity');
    }
  });

  it('includes payout-failure runbook', () => {
    const result = controller.list();
    const slugs = result.runbooks.map((r) => r.slug);
    expect(slugs).toContain('payout-failure');
  });

  it('includes fraud-escalation runbook', () => {
    const result = controller.list();
    const slugs = result.runbooks.map((r) => r.slug);
    expect(slugs).toContain('fraud-escalation');
  });
});
