import { createHash } from 'node:crypto';

export function sha256Hex(plainText: string): string {
  return createHash('sha256').update(plainText, 'utf8').digest('hex');
}

export function generateKeyId(): string {
  return `ck_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function generateKeySecret(): string {
  return `cs_${crypto.randomUUID()}${crypto.randomUUID().slice(0, 8)}`;
}
