import { Injectable } from '@nestjs/common';

interface PushTemplate {
  title: string;
  body: string;
}

@Injectable()
export class PushTemplatesService {
  render(templateKey: string, payload: Record<string, any>): PushTemplate {
    const txId = payload.transactionId
      ? `#${String(payload.transactionId).slice(-6)}`
      : '';

    switch (templateKey) {
      case 'transaction_created':
        return {
          title: 'Demande créée',
          body: `Votre demande de livraison ${txId} a été enregistrée.`,
        };
      case 'payment_confirmed':
        return {
          title: 'Paiement confirmé',
          body: `Votre paiement ${txId} est confirmé. Le voyageur prend en charge votre colis.`,
        };
      case 'delivery_confirmed':
        return {
          title: 'Livraison confirmée ✓',
          body: `Votre colis ${txId} a été livré avec succès.`,
        };
      case 'dispute_opened':
        return {
          title: 'Litige ouvert',
          body: `Un litige a été ouvert sur la transaction ${txId}. Réponse dans 72h.`,
        };
      case 'payout_paid':
        return {
          title: 'Virement effectué',
          body: payload.amountXaf
            ? `Votre virement de ${Math.round(payload.amountXaf / 100).toLocaleString('fr-FR')} XAF a été traité.`
            : 'Votre virement a été traité.',
        };
      default:
        return {
          title: 'Valises',
          body: payload.message ?? 'Vous avez une nouvelle notification.',
        };
    }
  }
}
