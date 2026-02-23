import { IsEnum, IsOptional } from 'class-validator';
import { EvidenceLevel } from '@prisma/client';

export class GetDisputeRecommendationDto {
  // Permet de simuler une recommandation avec un evidenceLevel donné.
  // Si absent → on prend STRONG par défaut (ou BASIC, au choix).
  @IsOptional()
  @IsEnum(EvidenceLevel)
  evidenceLevel?: EvidenceLevel;
}