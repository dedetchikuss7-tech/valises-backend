import { Injectable } from '@nestjs/common';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailTemplatesService {
  render(
    templateKey: string,
    payload: Record<string, any>,
    unsubscribeToken?: string,
  ): EmailTemplate {
    const unsubscribeBlock = unsubscribeToken
      ? `<p style="font-size:11px;color:#999;margin-top:24px;">
           <a href="https://api.valises.app/unsubscribe?token=${unsubscribeToken}" style="color:#999;">
             Se désabonner
           </a>
         </p>`
      : '';

    const wrap = (title: string, body: string): string => `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9f9f9;">
  <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e5e5;">
    <h2 style="color:#1a1a1a;margin-top:0;">${title}</h2>
    ${body}
    ${unsubscribeBlock}
  </div>
</body>
</html>`;

    switch (templateKey) {
      case 'transaction_created':
        return {
          subject: 'Votre demande de livraison a été créée',
          html: wrap(
            'Demande créée',
            `<p>Bonjour,</p>
            <p>Votre demande de livraison <strong>#${payload.transactionId ?? ''}</strong> a bien été enregistrée.</p>
            <p>Un voyageur va bientôt prendre en charge votre colis.</p>`,
          ),
          text: `Votre demande #${payload.transactionId ?? ''} a été créée. Un voyageur va prendre en charge votre colis.`,
        };

      case 'payment_confirmed':
        return {
          subject: 'Paiement confirmé — votre colis est en route',
          html: wrap(
            'Paiement confirmé',
            `<p>Bonjour,</p>
            <p>Votre paiement pour la transaction <strong>#${payload.transactionId ?? ''}</strong> a été confirmé.</p>
            <p>Le voyageur a accepté de transporter votre colis.</p>`,
          ),
          text: `Paiement confirmé pour la transaction #${payload.transactionId ?? ''}.`,
        };

      case 'delivery_confirmed':
        return {
          subject: 'Livraison confirmée',
          html: wrap(
            'Livraison confirmée ✓',
            `<p>Bonjour,</p>
            <p>Votre colis a été livré avec succès (transaction <strong>#${payload.transactionId ?? ''}</strong>).</p>
            <p>Merci d'utiliser Valises !</p>`,
          ),
          text: `Votre colis (transaction #${payload.transactionId ?? ''}) a été livré avec succès.`,
        };

      case 'dispute_opened':
        return {
          subject: 'Un litige a été ouvert sur votre transaction',
          html: wrap(
            'Litige ouvert',
            `<p>Bonjour,</p>
            <p>Un litige a été ouvert pour la transaction <strong>#${payload.transactionId ?? ''}</strong>.</p>
            <p>Notre équipe va examiner la situation dans les 72 heures.</p>`,
          ),
          text: `Un litige a été ouvert pour la transaction #${payload.transactionId ?? ''}. Réponse dans 72h.`,
        };

      case 'payout_paid':
        return {
          subject: 'Votre virement a été effectué',
          html: wrap(
            'Virement effectué',
            `<p>Bonjour,</p>
            <p>Votre virement a bien été traité.</p>
            ${payload.amountXaf ? `<p>Montant : <strong>${(payload.amountXaf / 100).toLocaleString('fr-FR')} XAF</strong></p>` : ''}`,
          ),
          text: `Votre virement${payload.amountXaf ? ` de ${payload.amountXaf / 100} XAF` : ''} a été effectué.`,
        };

      default:
        return {
          subject: 'Notification Valises',
          html: wrap('Notification', `<p>${payload.message ?? ''}</p>`),
          text: payload.message ?? '',
        };
    }
  }
}
