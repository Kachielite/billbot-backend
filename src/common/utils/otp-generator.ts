import crypto from 'crypto';

export function generateOtp(length = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function generateInviteCode(): string {
  const words = ['MOLEFI', 'TUNDE', 'EMEKA', 'KEMI', 'AMARA', 'KOFI', 'ABENA', 'SOLA'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${num}`;
}
