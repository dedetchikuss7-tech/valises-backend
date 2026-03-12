import { MessageSanitizerService } from './message-sanitizer.service';

describe('MessageSanitizerService', () => {
  let service: MessageSanitizerService;

  beforeEach(() => {
    service = new MessageSanitizerService();
  });

  it('should redact phone numbers', () => {
    const result = service.sanitize('Mon numéro est +237 699 00 11 22');

    expect(result.isRedacted).toBe(true);
    expect(result.content).toContain('[phone redacted]');
  });

  it('should redact email addresses', () => {
    const result = service.sanitize('Écris à test@example.com');

    expect(result.isRedacted).toBe(true);
    expect(result.content).toContain('[email redacted]');
  });

  it('should redact links', () => {
    const result = service.sanitize('Va sur https://example.com');

    expect(result.isRedacted).toBe(true);
    expect(result.content).toContain('[link redacted]');
  });

  it('should redact external app names', () => {
    const result = service.sanitize('Parlons sur WhatsApp');

    expect(result.isRedacted).toBe(true);
    expect(result.content).toContain('[external contact redacted]');
  });

  it('should keep clean text unchanged', () => {
    const result = service.sanitize('Bonjour, votre colis est prêt.');

    expect(result.isRedacted).toBe(false);
    expect(result.content).toBe('Bonjour, votre colis est prêt.');
  });
});