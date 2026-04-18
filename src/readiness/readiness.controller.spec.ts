import { ServiceUnavailableException } from '@nestjs/common';
import { ReadinessController } from './readiness.controller';

describe('ReadinessController', () => {
  let controller: ReadinessController;

  const prismaMock = {
    $queryRawUnsafe: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ReadinessController(prismaMock as any);
  });

  it('returns liveness payload', () => {
    const result = controller.getHealthz();

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        service: 'valises-backend',
        environment: expect.any(String),
        uptimeSeconds: expect.any(Number),
        timestamp: expect.any(String),
      }),
    );
  });

  it('returns readiness payload when database is reachable', async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.getReadyz();

    expect(prismaMock.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
    expect(result).toEqual({
      ok: true,
      service: 'valises-backend',
      dependencies: {
        database: 'up',
      },
      timestamp: expect.any(String),
    });
  });

  it('throws ServiceUnavailableException when database is unreachable', async () => {
    prismaMock.$queryRawUnsafe.mockRejectedValue(new Error('db down'));

    await expect(controller.getReadyz()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});