import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnsubscribeService } from './unsubscribe.service';

describe('UnsubscribeService', () => {
  let service: UnsubscribeService;

  const SECRET = 'test-secret-that-is-at-least-32-characters-long';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnsubscribeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'EMAIL_UNSUBSCRIBE_SECRET') return SECRET;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<UnsubscribeService>(UnsubscribeService);
  });

  describe('generateToken', () => {
    it('returns a 64-character hex string', () => {
      const token = service.generateToken('user-123');
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns the same token for the same userId', () => {
      const t1 = service.generateToken('user-abc');
      const t2 = service.generateToken('user-abc');
      expect(t1).toBe(t2);
    });

    it('returns different tokens for different userIds', () => {
      const t1 = service.generateToken('user-aaa');
      const t2 = service.generateToken('user-bbb');
      expect(t1).not.toBe(t2);
    });
  });

  describe('verifyToken', () => {
    it('returns true for a valid token', () => {
      const userId = 'user-verify-ok';
      const token = service.generateToken(userId);
      expect(service.verifyToken(userId, token)).toBe(true);
    });

    it('returns false for a tampered token', () => {
      const userId = 'user-tampered';
      const token = service.generateToken(userId);
      const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
      expect(service.verifyToken(userId, tampered)).toBe(false);
    });

    it('returns false for a token belonging to a different userId', () => {
      const token = service.generateToken('user-A');
      expect(service.verifyToken('user-B', token)).toBe(false);
    });

    it('returns false for wrong-length token', () => {
      expect(service.verifyToken('user-x', 'short')).toBe(false);
    });

    it('returns false for empty token', () => {
      expect(service.verifyToken('user-x', '')).toBe(false);
    });
  });
});
