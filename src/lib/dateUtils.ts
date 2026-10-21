/**
 * Crash-proof Date and Number Utilities
 * Prevents "RangeError: Invalid time value" and "TypeError: toFixed is not a function"
 */

/**
 * Safely parse a date value from string, number, or Date.
 * Handles partial time strings (e.g., "08:30", "08:30:00") and ISO strings.
 */
export function safeParseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Direct parse
    let d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;

    // Handle "YYYY-MM-DD HH:mm:ss" by replacing space with 'T'
    if (trimmed.includes(' ') && !trimmed.includes('T')) {
      d = new Date(trimmed.replace(' ', 'T'));
      if (!isNaN(d.getTime())) return d;
    }

    // Handle time-only like "08:30" or "08:30:00" -> attach today's date
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      const today = new Date().toISOString().split('T')[0];
      d = new Date(`${today}T${trimmed}`);
      if (!isNaN(d.getTime())) return d;
    }
  }

  return null;
}

/**
 * Returns safe YYYY-MM-DD date string. Never throws!
 */
export function safeIsoDate(val: any, fallback: string = ''): string {
  const d = safeParseDate(val);
  if (!d) return fallback;
  try {
    return d.toISOString().split('T')[0];
  } catch {
    return fallback;
  }
}

/**
 * Returns safe full ISO string (e.g. 2026-04-19T08:30:00.000Z). Never throws!
 */
export function safeIsoString(val: any, fallback: string = ''): string {
  const d = safeParseDate(val);
  if (!d) return fallback;
  try {
    return d.toISOString();
  } catch {
    return fallback;
  }
}

/**
 * Returns formatted time string (e.g. "08:30 WIB"). Never throws!
 */
export function safeFormatTime(val: any, fallback: string = '-'): string {
  const d = safeParseDate(val);
  if (!d) return fallback;
  try {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  } catch {
    return fallback;
  }
}

/**
 * Returns formatted full date string (e.g. "Rab, 21 Okt 2026"). Never throws!
 */
export function safeFormatDate(val: any, options?: Intl.DateTimeFormatOptions, fallback: string = '-'): string {
  const d = safeParseDate(val);
  if (!d) return fallback;
  try {
    return d.toLocaleDateString('id-ID', options || { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return fallback;
  }
}

/**
 * Calculates minutes from midnight (0 - 1439). Returns -1 if invalid.
 */
export function safeMinutesOfDay(val: any): number {
  const d = safeParseDate(val);
  if (!d) return -1;
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Safely converts numbers or strings to toFixed decimal format without throwing.
 */
export function safeToFixed(val: any, digits: number = 2, fallback: string = '-'): string {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : val.toFixed(digits);
  }
  const parsed = parseFloat(String(val));
  return isNaN(parsed) ? String(val) : parsed.toFixed(digits);
}
