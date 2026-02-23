import { Injectable } from '@nestjs/common';
import { DisputeOutcome, DisputeReasonCode, EvidenceLevel } from '@prisma/client';

export interface DisputeMatrixInput {
  reasonCode: DisputeReasonCode;
  evidenceLevel: EvidenceLevel;
  isDelivered: boolean;
  isWithinDeliveryWindow: boolean; // contestation "rapide" post-delivery
}

export interface DisputeRecommendation {
  recommendedOutcome: DisputeOutcome;
  recommendationNotes: string;
  matrixVersion: string;
}

@Injectable()
export class DisputeMatrixService {
  // version de matrice (utile pour évoluer sans casser)
  private readonly version = 'v1';

  recommend(input: DisputeMatrixInput): DisputeRecommendation {
    const { reasonCode, evidenceLevel, isDelivered, isWithinDeliveryWindow } = input;

    // Evidence trop faible => review / reject selon cas
    if (evidenceLevel === EvidenceLevel.NONE) {
      return {
        matrixVersion: this.version,
        recommendedOutcome: DisputeOutcome.REJECT,
        recommendationNotes: 'Evidence level is NONE → reject by default (or request more evidence).',
      };
    }

    // Evidence BASIC => souvent review manuelle
    if (evidenceLevel === EvidenceLevel.BASIC) {
      return {
        matrixVersion: this.version,
        recommendedOutcome: DisputeOutcome.REJECT,
        recommendationNotes: 'Evidence level BASIC → default reject unless admin decides otherwise.',
      };
    }

    // STRONG evidence : appliquer règles
    switch (reasonCode) {
      case DisputeReasonCode.NOT_DELIVERED:
        // Si pas livré : refund recommandé
        if (!isDelivered) {
          return {
            matrixVersion: this.version,
            recommendedOutcome: DisputeOutcome.REFUND_SENDER,
            recommendationNotes: 'NOT_DELIVERED + STRONG evidence + not delivered → refund sender.',
          };
        }
        // Si livré finalement : split/reject selon timing
        return {
          matrixVersion: this.version,
          recommendedOutcome: DisputeOutcome.REJECT,
          recommendationNotes: 'NOT_DELIVERED but transaction shows DELIVERED → reject (delivered).',
        };

      case DisputeReasonCode.DAMAGED:
      case DisputeReasonCode.WRONG_ITEM:
      case DisputeReasonCode.WEIGHT_MISMATCH:
        if (isDelivered && isWithinDeliveryWindow) {
          return {
            matrixVersion: this.version,
            recommendedOutcome: DisputeOutcome.SPLIT,
            recommendationNotes: `${reasonCode} + STRONG evidence + delivered within window → split recommended.`,
          };
        }
        return {
          matrixVersion: this.version,
          recommendedOutcome: DisputeOutcome.REJECT,
          recommendationNotes: `${reasonCode} + STRONG evidence but outside delivery window/unknown → reject by default.`,
        };

      case DisputeReasonCode.LATE_DELIVERY:
        // Si livré, la "lenteur" seule ne justifie pas forcément un refund
        if (isDelivered) {
          return {
            matrixVersion: this.version,
            recommendedOutcome: DisputeOutcome.RELEASE_TO_TRAVELER,
            recommendationNotes: 'LATE_DELIVERY but delivered → release to traveler by default.',
          };
        }
        return {
          matrixVersion: this.version,
          recommendedOutcome: DisputeOutcome.REJECT,
          recommendationNotes: 'LATE_DELIVERY but not delivered → reject (handle as NOT_DELIVERED if applicable).',
        };

      case DisputeReasonCode.NO_SHOW_TRAVELER:
        // voyageur absent : refund sender si preuve forte
        return {
          matrixVersion: this.version,
          recommendedOutcome: DisputeOutcome.REFUND_SENDER,
          recommendationNotes: 'NO_SHOW_TRAVELER + STRONG evidence → refund sender.',
        };

      case DisputeReasonCode.NO_SHOW_SENDER:
        // sender absent : release traveler (si voyageur a été immobilisé)
        return {
          matrixVersion: this.version,
          recommendedOutcome: DisputeOutcome.RELEASE_TO_TRAVELER,
          recommendationNotes: 'NO_SHOW_SENDER + STRONG evidence → release to traveler.',
        };

      case DisputeReasonCode.ILLEGAL_ITEM:
        // cas sensible : par défaut reject (ou freeze/admin manual)
        return {
          matrixVersion: this.version,
          recommendedOutcome: DisputeOutcome.REJECT,
          recommendationNotes: 'ILLEGAL_ITEM → reject by default (manual handling / compliance).',
        };

      case DisputeReasonCode.OTHER:
      default:
        return {
          matrixVersion: this.version,
          recommendedOutcome: DisputeOutcome.REJECT,
          recommendationNotes: 'OTHER/unknown reason → reject by default (needs manual review).',
        };
    }
  }
}