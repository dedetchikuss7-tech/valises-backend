import { EmailTemplatesService } from './email-templates.service';

describe('EmailTemplatesService', () => {
  let service: EmailTemplatesService;

  beforeEach(() => {
    service = new EmailTemplatesService();
  });

  describe('render', () => {
    it('renders transaction_created with transactionId in subject and body', () => {
      const result = service.render('transaction_created', { transactionId: 'tx-001' });

      expect(result.subject).toContain('créée');
      expect(result.html).toContain('tx-001');
      expect(result.text).toContain('tx-001');
    });

    it('renders payment_confirmed with transactionId', () => {
      const result = service.render('payment_confirmed', { transactionId: 'tx-002' });

      expect(result.subject).toContain('Paiement');
      expect(result.html).toContain('tx-002');
      expect(result.text).toContain('tx-002');
    });

    it('renders delivery_confirmed with transactionId', () => {
      const result = service.render('delivery_confirmed', { transactionId: 'tx-003' });

      expect(result.subject).toContain('Livraison');
      expect(result.html).toContain('tx-003');
      expect(result.text).toContain('tx-003');
    });

    it('renders dispute_opened with transactionId', () => {
      const result = service.render('dispute_opened', { transactionId: 'tx-004' });

      expect(result.subject).toContain('litige');
      expect(result.html).toContain('tx-004');
      expect(result.text).toContain('72');
    });

    it('renders payout_paid with amount when provided', () => {
      const result = service.render('payout_paid', { amountXaf: 5000000 });

      expect(result.subject).toContain('virement');
      expect(result.html).toContain('50');
      expect(result.text).toContain('50');
    });

    it('renders payout_paid without amount when not provided', () => {
      const result = service.render('payout_paid', {});

      expect(result.subject).toContain('virement');
      expect(result.html).toBeDefined();
      expect(result.text).toBeDefined();
    });

    it('falls back to generic template for unknown key', () => {
      const result = service.render('unknown_event', { message: 'Hello' });

      expect(result.subject).toBe('Notification Valises');
      expect(result.html).toContain('Hello');
      expect(result.text).toBe('Hello');
    });

    it('includes unsubscribe link in HTML when token is provided', () => {
      const result = service.render('transaction_created', {}, 'abc123');

      expect(result.html).toContain('abc123');
      expect(result.html).toContain('désabonner');
    });

    it('does not include unsubscribe block when token is absent', () => {
      const result = service.render('transaction_created', {});

      expect(result.html).not.toContain('désabonner');
    });

    it('returns valid HTML structure for all 5 event types', () => {
      const keys = [
        'transaction_created',
        'payment_confirmed',
        'delivery_confirmed',
        'dispute_opened',
        'payout_paid',
      ];

      for (const key of keys) {
        const result = service.render(key, { transactionId: 'tx-x' });
        expect(result.html).toContain('<!DOCTYPE html>');
        expect(result.subject.length).toBeGreaterThan(5);
        expect(result.text.length).toBeGreaterThan(5);
      }
    });
  });
});
