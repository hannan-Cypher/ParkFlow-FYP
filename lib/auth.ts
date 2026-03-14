import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

/**
 * Validate a Pakistani phone number.
 * Accepts: 03001234567, 3001234567, +923001234567, 923001234567 (with optional dashes/spaces)
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
  if (/^923[0-5]\d{8}$/.test(cleaned)) return true;
  if (/^03[0-5]\d{8}$/.test(cleaned)) return true;
  if (/^3[0-5]\d{8}$/.test(cleaned)) return true;
  return false;
}

/**
 * Normalize phone to local storage format: 03001234567
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
  if (cleaned.startsWith('92') && cleaned.length === 12) {
    return '0' + cleaned.slice(2);
  }
  if (cleaned.length === 10 && cleaned.startsWith('3')) {
    return '0' + cleaned;
  }
  return cleaned;
}

/**
 * Generate a cryptographically secure magic link token (64 hex chars).
 */
export function generateMagicToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Detect whether a login identifier is an email or phone number.
 */
export function detectIdentifierType(identifier: string): 'email' | 'phone' | 'unknown' {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) return 'email';
  const cleaned = trimmed.replace(/[\s\-\+\(\)]/g, '');
  if (/^\d{10,12}$/.test(cleaned)) return 'phone';
  return 'unknown';
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Verify password
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Generate session token
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

// Calculate token expiration (7 days from now)
export function getTokenExpiration(): Date {
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + 7);
  return expiration;
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
export function isValidPassword(password: string): {
  valid: boolean;
  message: string;
} {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true, message: 'Password is valid' };
}
