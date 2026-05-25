export enum TrustLevel {
  EXPLORER = 'EXPLORER',
  VERIFIED = 'VERIFIED',
  TRUSTED = 'TRUSTED',
  HIGH_TRUST = 'HIGH_TRUST',
}

export interface TrustLevelResult {
  level: TrustLevel;
  score: number;
  signals: string[];
  computationVersion: 'v1';
}
