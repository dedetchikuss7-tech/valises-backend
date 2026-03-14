import { MessageSanitizerService } from './message-sanitizer.service';

describe('MessageSanitizerService', () => {
  let service: MessageSanitizerService;

  beforeEach(() => {
    service = new MessageSanitizerService();
  });

  it('should sanitize phone numbers', () => {
    const result = service.sanitize('Mon numéro est +237 699 00 11 22');

    expect(result.isRedacted).toBe(true);
    expect(result.status).toBe('SANITIZED');
    expect(result.content).toContain('[phone redacted]');
    expect(result.reasons).toContain('phone');
  });

  it('should sanitize email addresses', () => {
    const result = service.sanitize('Écris à test@example.com');

    expect(result.isRedacted).toBe(true);
    expect(result.status).toBe('SANITIZED');
    expect(result.content).toContain('[email redacted]');
    expect(result.reasons).toContain('email');
  });

  it('should sanitize links', () => {
    const result = service.sanitize('Va sur https://example.com');

    expect(result.isRedacted).toBe(true);
    expect(result.status).toBe('SANITIZED');
    expect(result.content).toContain('[link redacted]');
    expect(result.reasons).toContain('url');
  });

  it('should block messages that are only a contact attempt', () => {
    const result = service.sanitize('Parlons sur WhatsApp');

    expect(result.isRedacted).toBe(true);
    expect(result.status).toBe('BLOCKED');
    expect(result.content).toContain('[external contact redacted]');
    expect(result.reasons).toContain('external_app');
    expect(result.reasons).toContain('contact_only_message');
  });

  it('should block messages that are basically only phone sharing', () => {
    const result = service.sanitize('699001122');

    expect(result.isRedacted).toBe(true);
    expect(result.status).toBe('BLOCKED');
    expect(result.content).toContain('[phone redacted]');
    expect(result.reasons).toContain('phone');
    expect(result.reasons).toContain('contact_only_message');
  });

  it('should sanitize but keep useful logistical text', () => {
    const result = service.sanitize('Bonjour, contacte-moi au 699001122 pour confirmer ici.');

    expect(result.isRedacted).toBe(true);
    expect(result.status).toBe('SANITIZED');
    expect(result.content).toContain('[phone redacted]');
  });

  it('should keep clean text unchanged', () => {
    const result = service.sanitize('Bonjour, votre colis est prêt.');

    expect(result.isRedacted).toBe(false);
    expect(result.status).toBe('CLEAN');
    expect(result.content).toBe('Bonjour, votre colis est prêt.');
    expect(result.reasons).toEqual([]);
  });
});