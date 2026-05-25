export function renderNotificationText(
  eventType: string,
  data: Record<string, any> = {},
): string {
  switch (eventType) {
    case 'TRANSACTION_CREATED':
      return `Votre demande de transport a été créée. Référence : ${data.transactionId ?? ''}.`;

    case 'PAYMENT_CONFIRMED':
      return `Paiement confirmé pour votre transaction ${data.transactionId ?? ''}. Le voyageur a été notifié.`;

    case 'DELIVERY_CONFIRMED':
      return `Livraison confirmée pour la transaction ${data.transactionId ?? ''}. Le paiement va être traité.`;

    case 'DISPUTE_OPENED':
      return `Un litige a été ouvert sur la transaction ${data.transactionId ?? ''}. Notre équipe va examiner votre dossier.`;

    case 'PAYOUT_PAID':
      return `Votre paiement de ${data.amount ?? ''} XAF a été envoyé. Référence : ${data.payoutId ?? ''}.`;

    default:
      return `Mise à jour sur votre compte Valises.`;
  }
}
