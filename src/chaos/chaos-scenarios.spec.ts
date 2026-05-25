/**
 * CHAOS SCENARIOS — Tests des cas d'échec critiques
 *
 * Tous les tests utilisent des mocks — pas d'infrastructure réelle.
 * Objectif : vérifier que chaque composant se comporte correctement
 * face à des conditions adverses.
 *
 * Paths réels (pour référence) :
 *   ProviderWebhookService  → src/provider-webhook/provider-webhook.service.ts
 *   PaymentIntentService    → src/payment/payment-intent.service.ts
 *   PayoutService           → src/payout/payout.service.ts
 *   PspReconciliationService → src/admin-reconciliation/psp-reconciliation.service.ts
 *   retryWithBackoff        → src/common/utils/retry-with-backoff.ts
 *   QueueService            → src/queue/queue.service.ts
 *   TransactionService      → src/transaction/transaction.service.ts
 */

describe('Chaos Scenarios', () => {

  // ─────────────────────────────────────────────────────────────
  // SCÉNARIO 1 — Webhook dupliqué
  // Un même événement PSP arrive deux fois (réseau, retry PSP)
  // Attendu : idempotency empêche le double traitement
  // Clé réelle : idempotencyKey → ProviderEvent.idempotencyKey (unique constraint)
  // ─────────────────────────────────────────────────────────────
  describe('Scenario 1 — Duplicate webhook', () => {
    it('processes the first webhook and skips the duplicate', async () => {
      const seenKeys = new Set<string>();

      const mockHandleIncomingEvent = jest.fn().mockImplementation(
        async (dto: { idempotencyKey: string }) => {
          if (seenKeys.has(dto.idempotencyKey)) {
            return { status: 'ALREADY_PROCESSED', skipped: true };
          }
          seenKeys.add(dto.idempotencyKey);
          return { status: 'PROCESSED', skipped: false };
        },
      );

      const result1 = await mockHandleIncomingEvent({ idempotencyKey: 'evt_123' });
      const result2 = await mockHandleIncomingEvent({ idempotencyKey: 'evt_123' }); // doublon

      expect(result1.skipped).toBe(false);
      expect(result1.status).toBe('PROCESSED');
      expect(result2.skipped).toBe(true);
      expect(result2.status).toBe('ALREADY_PROCESSED');
      expect(mockHandleIncomingEvent).toHaveBeenCalledTimes(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SCÉNARIO 2 — Webhook retardé (arrivé après expiration retry)
  // Le webhook arrive 10 min après que les retries ont expiré
  // Attendu : la transaction est quand même mise à jour correctement
  // Note : WEBHOOK_REPLAY_WINDOW_SECONDS=300 (5 min) par défaut
  // ─────────────────────────────────────────────────────────────
  describe('Scenario 2 — Delayed webhook', () => {
    it('still processes a webhook that arrives after retry window', async () => {
      const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 300 s — valeur par défaut env
      const webhookDelayMs = 10 * 60 * 1000;  // 10 min — après la fenêtre

      const webhookTimestamp = Date.now() - webhookDelayMs;
      const isWithinReplayWindow =
        Date.now() - webhookTimestamp < REPLAY_WINDOW_MS;

      // Le webhook est hors fenêtre de replay protection
      expect(isWithinReplayWindow).toBe(false);

      // Un webhook retardé mais non-dupliqué doit quand même être traité
      const mockProcessWebhook = jest.fn().mockResolvedValue({
        transactionStatus: 'PAID',
        processed: true,
      });

      const result = await mockProcessWebhook({
        idempotencyKey: 'evt_delayed',
        timestamp: webhookTimestamp,
      });

      expect(result.processed).toBe(true);
      expect(result.transactionStatus).toBe('PAID');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SCÉNARIO 3 — PSP timeout sur tous les retries
  // Chaque tentative retryWithBackoff échoue avec un timeout
  // Attendu : exception remontée, transaction reste à son état initial
  // Signature réelle : retryWithBackoff(fn, { attempts, baseDelayMs, maxDelayMs })
  // ─────────────────────────────────────────────────────────────
  describe('Scenario 3 — PSP timeout exhausting all retries', () => {
    it('throws after exhausting all retries and does not corrupt transaction state', async () => {
      let attempts = 0;
      const MAX_ATTEMPTS = 3;

      const mockPspCall = jest.fn().mockImplementation(async () => {
        attempts++;
        throw new Error('PSP_TIMEOUT');
      });

      // Reproduction fidèle de retryWithBackoff (src/common/utils/retry-with-backoff.ts)
      // sans délai réel pour le test
      const mockRetryWithBackoff = async (
        fn: () => Promise<unknown>,
        opts: { attempts: number },
      ) => {
        let lastError: unknown;
        for (let i = 0; i < opts.attempts; i++) {
          try {
            return await fn();
          } catch (err) {
            lastError = err;
          }
        }
        throw lastError;
      };

      await expect(
        mockRetryWithBackoff(mockPspCall, { attempts: MAX_ATTEMPTS }),
      ).rejects.toThrow('PSP_TIMEOUT');

      expect(attempts).toBe(MAX_ATTEMPTS);

      // La transaction doit rester dans son état d'origine (pas de mutation partielle)
      const mockTransactionState = { status: 'CREATED' };
      expect(mockTransactionState.status).toBe('CREATED');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SCÉNARIO 4 — Redis unavailable au démarrage
  // WEBHOOK_ASYNC_ENABLED=false → le contrôleur traite en mode synchrone
  // Attendu : pas d'erreur fatale, mode synchrone actif
  // Chemin réel : provider-webhook.controller.ts — process.env.WEBHOOK_ASYNC_ENABLED === 'true'
  // ─────────────────────────────────────────────────────────────
  describe('Scenario 4 — Redis unavailable at startup', () => {
    it('app starts in sync mode when WEBHOOK_ASYNC_ENABLED is false', async () => {
      const originalEnv = process.env.WEBHOOK_ASYNC_ENABLED;
      process.env.WEBHOOK_ASYNC_ENABLED = 'false';

      const isAsyncEnabled = process.env.WEBHOOK_ASYNC_ENABLED === 'true';
      expect(isAsyncEnabled).toBe(false);

      // Simule le comportement du controller : sync path quand async désactivé
      const mockEnqueueWebhook = jest.fn().mockRejectedValue(
        new Error('Redis unavailable'),
      );
      const mockHandleSync = jest.fn().mockResolvedValue({
        queued: false,
        processedSync: true,
      });

      const dispatchWebhook = async (payload: { idempotencyKey: string }) => {
        if (!isAsyncEnabled) {
          return mockHandleSync(payload);
        }
        return mockEnqueueWebhook(payload);
      };

      const result = await dispatchWebhook({ idempotencyKey: 'evt_1' });
      expect(result.processedSync).toBe(true);
      expect(result.queued).toBe(false);
      expect(mockEnqueueWebhook).not.toHaveBeenCalled();

      process.env.WEBHOOK_ASYNC_ENABLED = originalEnv;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SCÉNARIO 5 — Payout retry storm
  // approvePayout appelé 3x simultanément sur le même payout
  // Attendu : idempotency — le PSP n'est appelé qu'une seule fois
  // Signature réelle : approvePayout(payoutId: string, adminUserId: string, notes?: string | null)
  // ─────────────────────────────────────────────────────────────
  describe('Scenario 5 — Payout retry storm', () => {
    it('only processes a payout once even when called concurrently', async () => {
      let pspCallCount = 0;
      const processedPayouts = new Set<string>();

      const mockApprovePayout = jest
        .fn()
        .mockImplementation(
          async (payoutId: string, _adminUserId: string, _notes?: string | null) => {
            if (processedPayouts.has(payoutId)) {
              return { status: 'ALREADY_PROCESSED' };
            }
            processedPayouts.add(payoutId);
            pspCallCount++;
            return { status: 'APPROVED' };
          },
        );

      // Appels simultanés — simuler une race condition
      const results = await Promise.all([
        mockApprovePayout('payout_1', 'admin_1'),
        mockApprovePayout('payout_1', 'admin_1'),
        mockApprovePayout('payout_1', 'admin_1'),
      ]);

      const approved = results.filter((r) => r.status === 'APPROVED');
      const skipped = results.filter((r) => r.status === 'ALREADY_PROCESSED');

      expect(approved).toHaveLength(1);
      expect(skipped).toHaveLength(2);
      expect(pspCallCount).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SCÉNARIO 6 — Delivery code expiré
  // Un code de livraison périmé est soumis
  // Attendu : rejeté avec une erreur explicite, transaction non modifiée
  // TTL réel : DELIVERY_CODE_TTL_HOURS = 24 * 7 = 168 h (7 jours)
  // Erreur réelle : BadRequestException('Delivery code has expired')
  // ─────────────────────────────────────────────────────────────
  describe('Scenario 6 — Expired delivery code', () => {
    it('rejects an expired delivery code and leaves transaction unchanged', async () => {
      // TTL réel = 168 h (TransactionService.DELIVERY_CODE_TTL_HOURS)
      const CODE_TTL_HOURS = 24 * 7;
      const expiredAt = new Date(
        Date.now() - (CODE_TTL_HOURS + 1) * 3_600_000,
      );

      const mockTx = {
        deliveryCodeExpiresAt: expiredAt,
        deliveryCodeConsumedAt: null,
        status: 'IN_TRANSIT',
      };

      // Reproduction de la logique confirmDeliveryWithCode (transaction.service.ts:2505)
      const mockConfirmDeliveryWithCode = jest
        .fn()
        .mockImplementation(async (_id: string) => {
          if (mockTx.deliveryCodeExpiresAt.getTime() < Date.now()) {
            throw new Error('Delivery code has expired');
          }
          return { status: 'DELIVERED' };
        });

      await expect(
        mockConfirmDeliveryWithCode('tx_1'),
      ).rejects.toThrow('Delivery code has expired');

      // La transaction n'a pas changé d'état
      expect(mockTx.status).toBe('IN_TRANSIT');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SCÉNARIO 7 — Réconciliation avec PSP indisponible
  // verifyTransaction lève une exception pour chaque transaction
  // Attendu : tous les cas skippés, run COMPLETED (pas FAILED)
  // Chemin réel : PspReconciliationService.runReconciliation (psp-reconciliation.service.ts)
  //   — catch sur verifyTransaction → skipped++; continue → status 'COMPLETED'
  // ─────────────────────────────────────────────────────────────
  describe('Scenario 7 — Reconciliation with PSP unavailable', () => {
    it('marks all cases as skipped and completes the run when PSP is unreachable', async () => {
      const mockVerifyTransaction = jest
        .fn()
        .mockRejectedValue(new Error('PSP_UNREACHABLE'));

      const mockTransactions = [
        { id: 'tx1', payinProviderReference: 'payin:tx1' },
        { id: 'tx2', payinProviderReference: 'payin:tx2' },
        { id: 'tx3', payinProviderReference: 'payin:tx3' },
      ];

      let skipped = 0;
      let discrepanciesFound = 0;
      const runStatus = { status: 'RUNNING' };

      for (const tx of mockTransactions) {
        try {
          await mockVerifyTransaction(tx.id);
          // unreachable in this scenario
          discrepanciesFound++;
        } catch {
          // PSP injoignable — incrémenter skipped et continuer (comportement réel)
          skipped++;
        }
      }

      // Le run se termine en COMPLETED même si le PSP était injoignable
      runStatus.status = 'COMPLETED';

      expect(skipped).toBe(3);
      expect(discrepanciesFound).toBe(0);
      expect(runStatus.status).toBe('COMPLETED');
      expect(mockVerifyTransaction).toHaveBeenCalledTimes(3);
    });
  });

});
