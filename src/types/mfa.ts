export interface MfaFactor {
  id: string;
  friendly_name: string | null;
  factor_type: 'totp' | 'phone';
  status: 'verified' | 'unverified';
  created_at: string;
  updated_at: string;
}

export interface MfaFactorList {
  totp: MfaFactor[];
  phone: MfaFactor[];
}

export interface MfaEnrollData {
  factorId: string;
  qrSvg: string;
  secret: string;
}

export type MfaEnrollStep = 'intro' | 'qr' | 'verify' | 'recovery' | 'done';
