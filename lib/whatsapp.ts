/**
 * lib/whatsapp.ts
 *
 * Pure utility module for WhatsApp deep-link construction and
 * Pakistani phone number normalisation / validation.
 *
 * No React, no server imports — importable from both client and server code.
 */

// ── Phone normalisation ────────────────────────────────────────────────────

/**
 * Normalize a Pakistani phone number to international format WITHOUT the +
 * prefix. wa.me requires: countrycode + number, no +, no spaces, no dashes.
 *
 * INPUT EXAMPLES → OUTPUT:
 *   "03001234567"    → "923001234567"
 *   "3001234567"     → "923001234567"
 *   "+923001234567"  → "923001234567"
 *   "923001234567"   → "923001234567"
 *   "0300-1234567"   → "923001234567"
 *   "0300 123 4567"  → "923001234567"
 */
export function normalizePhoneForWhatsApp(phone: string): string {
  // 1. Strip all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // 2. Already international (92xxxxxxxxxx, length 12)
  if (digits.startsWith('92') && digits.length === 12) return digits;

  // 3. Pakistani local format (0xxxxxxxxxx, length 11)
  if (digits.startsWith('0') && digits.length === 11) return '92' + digits.slice(1);

  // 4. 10-digit without leading 0 (xxxxxxxxxx)
  if (digits.length === 10) return '92' + digits;

  // 5. Best-effort: return stripped digits
  return digits;
}

// ── Phone validation ───────────────────────────────────────────────────────

/**
 * Validate that a phone number looks like a valid Pakistani mobile number.
 *
 * Valid formats after stripping non-digits:
 *   - 11 digits starting with 03   (local)
 *   - 12 digits starting with 923  (international)
 *   - 10 digits starting with 3    (no leading 0)
 *
 * Pakistani mobile prefixes: 030x–035x (Jazz, Zong, Ufone, Telenor, SCOM)
 */
export function validatePakistaniPhone(phone: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const digits = phone.replace(/\D/g, '');

  let local = digits; // will hold the 10-digit local part (3xxxxxxxxx)

  if (digits.startsWith('92') && digits.length === 12) {
    local = digits.slice(2); // strip country code
  } else if (digits.startsWith('0') && digits.length === 11) {
    local = digits.slice(1); // strip leading 0
  } else if (digits.length === 10 && digits.startsWith('3')) {
    local = digits;
  } else {
    return {
      valid: false,
      normalized: digits,
      error: 'Enter a valid Pakistani mobile number (e.g. 0300 1234567)',
    };
  }

  // Must be 10 digits starting with 3
  if (!/^3\d{9}$/.test(local)) {
    return {
      valid: false,
      normalized: digits,
      error: 'Enter a valid Pakistani mobile number (e.g. 0300 1234567)',
    };
  }

  // Check operator prefix (30x–35x)
  const prefix = parseInt(local.slice(0, 2), 10);
  if (prefix < 30 || prefix > 35) {
    return {
      valid: false,
      normalized: digits,
      error: 'Unrecognised Pakistani mobile prefix. Valid: 030x–035x',
    };
  }

  return { valid: true, normalized: '92' + local };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatEntryTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-PK', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

// ── WhatsApp deep-link builders ────────────────────────────────────────────

/**
 * Build a WhatsApp deep link for a NEW customer receiving their first ticket.
 * Includes full onboarding message with instructions.
 *
 * @param baseUrl  - e.g. window.location.origin  (pass at call time on client)
 */
export function buildWhatsAppTicketLink(
  phone: string,
  ticket: {
    sessionId: string;
    licensePlate: string;
    venueName: string;
    slotNumber?: string;
    entryTime: string;
    ratePerHour: number;
    smsCode: string;
    venuePhone?: string;
    magicToken?: string | null;
  },
  baseUrl: string = ''
): string {
  const normalized = normalizePhoneForWhatsApp(phone);
  const safeSessionId = ticket.sessionId.replace(/-/g, '');
  const ticketUrl = ticket.magicToken
    ? `${baseUrl}/ticket/${safeSessionId}?token=${ticket.magicToken}`
    : `${baseUrl}/ticket/${safeSessionId}`;

  const lines: string[] = [
    'Assalam-o-Alaikum! 👋',
    '🅿️ ParkFlow — Your Parking Ticket',
    '',
    `🚗 Vehicle: ${ticket.licensePlate}`,
    `📍 Venue: ${ticket.venueName}`,
    ...(ticket.slotNumber ? [`🎫 Slot: ${ticket.slotNumber}`] : []),
    `⏰ Checked in: ${formatEntryTime(ticket.entryTime)}`,
    `💰 Rate: PKR ${ticket.ratePerHour}/hr`,
    '',
    `🔑 SMS Code: ${ticket.smsCode}`,
    "(Use this code if you don't have internet — show to valet)",
    '',
    '📲 View ticket & request car retrieval:',
    ticketUrl,
    '',
    ...(ticket.venuePhone ? [`📞 Venue helpline: ${ticket.venuePhone}`] : []),
    '',
    'Apni gaari lene ke liye upar ticket link use karein ya SMS code valet ko dikhayein. Shukriya! 🙏',
  ];

  const message = lines.join('\n');
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

/**
 * Build a WhatsApp deep link to invite a new STAFF member.
 * Admin clicks this link → WhatsApp opens with pre-filled invitation message.
 */
export function buildWhatsAppStaffInviteLink(
  phone: string,
  name: string | null,
  magicLink: string
): string {
  const normalized = normalizePhoneForWhatsApp(phone);
  const greeting = name ? `Hi ${name}` : 'Hi there';

  const lines: string[] = [
    `${greeting}! 👋`,
    '',
    "You've been invited to join *ParkFlow* as a staff member.",
    '',
    '🅿️ ParkFlow — AI-Powered Valet Parking',
    '',
    'Click the link below to set up your account and get started:',
    magicLink,
    '',
    '⚠️ This link expires in 48 hours.',
    '',
    'If you have any questions, contact your manager. Shukriya! 🙏',
  ];

  const message = lines.join('\n');
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

/**
 * Build a shorter WhatsApp deep link for a RETURNING customer.
 * They know the system — just the essentials.
 *
 * @param baseUrl  - e.g. window.location.origin  (pass at call time on client)
 */
export function buildWhatsAppReturningLink(
  phone: string,
  ticket: {
    sessionId: string;
    licensePlate: string;
    venueName: string;
    slotNumber?: string;
    ratePerHour: number;
    smsCode: string;
    venuePhone?: string;
    magicToken?: string | null;
  },
  baseUrl: string = ''
): string {
  const normalized = normalizePhoneForWhatsApp(phone);
  const safeSessionId = ticket.sessionId.replace(/-/g, '');
  const ticketUrl = ticket.magicToken
    ? `${baseUrl}/ticket/${safeSessionId}?token=${ticket.magicToken}`
    : `${baseUrl}/ticket/${safeSessionId}`;

  const venueSlot = [ticket.venueName, ticket.slotNumber ? `Slot ${ticket.slotNumber}` : '']
    .filter(Boolean)
    .join(' | ');

  const lines: string[] = [
    'Assalam-o-Alaikum! 👋',
    `🅿️ ParkFlow — ${ticket.licensePlate} checked in`,
    `📍 ${venueSlot}`,
    `💰 PKR ${ticket.ratePerHour}/hr`,
    '',
    `🔑 SMS Code: ${ticket.smsCode}`,
    '',
    `📲 Ticket: ${ticketUrl}`,
    '',
    ...(ticket.venuePhone ? [`📞 Helpline: ${ticket.venuePhone}`] : []),
  ];

  const message = lines.join('\n');
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
