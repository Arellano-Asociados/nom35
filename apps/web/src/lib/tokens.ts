import { createHash, randomBytes } from 'node:crypto';

/** Hash del token de un enlace: solo el hash toca la base de datos. */
export function hashDeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Genera un token URL-safe para un enlace de cuestionario. */
export function generarToken(): string {
  return randomBytes(32).toString('base64url');
}
