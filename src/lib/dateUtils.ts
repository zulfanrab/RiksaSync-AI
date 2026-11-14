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
  if (!val) return fallback;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val.trim())) {
    return val.trim().substring(0, 10);
  }
  const d = safeParseDate(val);
  if (!d) return fallback;
  try {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
 * Returns safe YYYY-MM-DD date string strictly converted to Asia/Jakarta (WIB) timezone.
 * Handles UTC ISO timestamps from Supabase correctly without off-by-one day bugs.
 */
export function toWibDate(val: any, fallback: string = ''): string {
  if (!val) return fallback;
  const d = safeParseDate(val);
  if (!d) return fallback;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d);
  } catch {
    return safeIsoDate(val, fallback);
  }
}

/**
 * Extracts hour, minute, second and HH:mm in Asia/Jakarta (WIB).
 */
export function getWibTimeParts(val: any): { hour: number; minute: number; second: number; timeStr: string } {
  const d = safeParseDate(val);
  if (!d) return { hour: 0, minute: 0, second: 0, timeStr: '--:--' };
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(d);
    let hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    if (hour === 24) hour = 0;
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const second = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { hour, minute, second, timeStr };
  } catch {
    const hour = d.getHours();
    const minute = d.getMinutes();
    const second = d.getSeconds();
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { hour, minute, second, timeStr };
  }
}

/**
 * Converts a WIB date (YYYY-MM-DD) and time (HH:mm[:ss]) to an accurate UTC ISO string.
 */
export function wibToUtcIso(dateWib: string, timeWib: string): string {
  const timeWithSec = timeWib.includes(':') && timeWib.split(':').length === 2 ? `${timeWib}:00` : timeWib;
  const parsed = safeParseDate(`${dateWib}T${timeWithSec}+07:00`);
  if (parsed && !isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Calculates late minutes based on 09:00 WIB (540 minutes).
 */
export function checkLateMinutesWib(timestampStr: string): number {
  try {
    const parts = getWibTimeParts(timestampStr);
    const totalMinutes = parts.hour * 60 + parts.minute;
    const targetMinute = 9 * 60; // 09:00 WIB
    if (totalMinutes > targetMinute) {
      return totalMinutes - targetMinute;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Formats duration in milliseconds into "Xj Ym" format.
 * Returns "0j 0m" for non-positive values (strictly using digit 0, never letter O).
 */
export function formatDurationHours(durationMs: number): string {
  if (!durationMs || durationMs <= 0 || isNaN(durationMs)) return '0j 0m';
  const totalMinutes = Math.floor(durationMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}j ${mins}m`;
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
