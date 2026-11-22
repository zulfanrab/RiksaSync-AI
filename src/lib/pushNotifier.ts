/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AksaraSync AI - Push Notification Dispatcher & Narrative Formatter
 * Memancarkan Web Push Notification ke seluruh perangkat aktif via endpoint /api/push-send
 */

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const BULAN_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export function formatDateId(isoDateStr?: string): string {
  if (!isoDateStr) return '';
  const parts = isoDateStr.split('-');
  if (parts.length < 3) return isoDateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${day} ${BULAN_ID[monthIdx] || parts[1]} ${year}`;
}

export function formatDateShortId(isoDateStr?: string): string {
  if (!isoDateStr) return '';
  const parts = isoDateStr.split('-');
  if (parts.length < 3) return isoDateStr;
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${day} ${BULAN_SHORT[monthIdx] || parts[1]}`;
}

export interface PushNotificationPayload {
  title?: string;
  body?: string;
  tag?: string;
  table?: 'schedules' | 'manpower_absences';
  type?: 'INSERT' | 'UPDATE' | 'TEST';
  record?: any;
}

/**
 * Format narasi lengkap notifikasi jadwal berdasarkan jenis kegiatannya:
 * - Riksa Uji
 * - Meeting
 * - Survey
 * - Lainnya
 */
export function formatScheduleNotification(
  schedule: any,
  eventType: 'INSERT' | 'UPDATE' = 'INSERT',
  manpowerList: any[] = [],
  units: any[] = []
): { title: string; body: string; tag: string; priority: 'P1' | 'P2' | 'P3' } {
  const clientName = (schedule.client_name || 'Klien').trim();
  const agendaType = schedule.agenda_type || 'Riksa Uji';
  const status = schedule.status || 'Scheduled';

  // Format Tanggal
  const startDate = schedule.start_date || '';
  const endDate = schedule.end_date || '';
  let dateStr = startDate ? formatDateId(startDate) : 'Tanggal belum diatur';
  if (startDate && endDate) {
    if (startDate === endDate) {
      dateStr = formatDateId(startDate);
    } else {
      dateStr = `${formatDateShortId(startDate)} - ${formatDateId(endDate)}`;
    }
  }

  // Format Jam
  let timeStr = '09:00 WIB';
  if (schedule.is_until_finished) {
    timeStr = `${schedule.start_time || '09:00'} WIB - Selesai`;
  } else if (schedule.start_time && schedule.end_time) {
    timeStr = `${schedule.start_time} - ${schedule.end_time} WIB`;
  } else if (schedule.start_time) {
    timeStr = `${schedule.start_time} WIB`;
  }

  // Format Tim (Lead & Support)
  const leadObj = manpowerList.find(m => m.id === schedule.lead_expert_id);
  const leadName = leadObj?.name || (schedule.lead_expert_name || (schedule.lead_expert_id ? 'Ahli K3' : ''));
  
  const supportNames: string[] = [];
  if (Array.isArray(schedule.support_ids)) {
    schedule.support_ids.forEach((id: string) => {
      const sup = manpowerList.find(m => m.id === id);
      if (sup) supportNames.push(sup.name);
    });
  } else if (Array.isArray(schedule.support_names)) {
    supportNames.push(...schedule.support_names);
  }

  let timStr = '';
  if (leadName && supportNames.length > 0) {
    timStr = `${leadName} (Lead), ${supportNames.join(', ')}`;
  } else if (leadName) {
    timStr = `${leadName} (Lead)`;
  } else if (supportNames.length > 0) {
    timStr = supportNames.join(', ');
  } else {
    timStr = 'Tim Lapangan';
  }

  // Format Unit (jika ada untuk Riksa Uji)
  let unitStr = '';
  if (Array.isArray(schedule.unit_descriptions) && schedule.unit_descriptions.length > 0) {
    unitStr = schedule.unit_descriptions.filter(Boolean).slice(0, 3).join(', ');
  } else if (Array.isArray(schedule.unit_ids) && schedule.unit_ids.length > 0) {
    const unitNames = schedule.unit_ids
      .map((uid: string) => units.find(u => u.id === uid)?.unit_name)
      .filter(Boolean);
    if (unitNames.length > 0) {
      unitStr = unitNames.slice(0, 3).join(', ');
    }
  }

  let title = '';
  let body = '';
  let tag = 'aksarasync-schedule';
  let priority: 'P1' | 'P2' | 'P3' = 'P3';

  if (eventType === 'INSERT') {
    priority = 'P2';
    if (agendaType === 'Riksa Uji') {
      title = `⚙️ Riksa Uji Baru: ${clientName}`;
      body = `📅 ${dateStr} (${timeStr}) • Tim: ${timStr}${schedule.pic_name ? ` • PIC: ${schedule.pic_name}` : ''}${unitStr ? ` • Unit: ${unitStr}` : ''}`;
      tag = 'aksarasync-schedule-riksa';
    } else if (agendaType === 'Meeting') {
      title = `🤝 Agenda Meeting: ${clientName}`;
      const loc = schedule.location || schedule.client_address || 'Kantor Klien';
      body = `📅 ${dateStr} (${timeStr}) • Lokasi: ${loc} • Tim: ${timStr}${schedule.pic_name ? ` • PIC: ${schedule.pic_name}` : ''}`;
      tag = 'aksarasync-schedule-meeting';
    } else if (agendaType === 'Survey') {
      title = `🔍 Survey Lapangan: ${clientName}`;
      const loc = schedule.location || schedule.client_address || 'Site Klien';
      body = `📅 ${dateStr} (${timeStr}) • Lokasi: ${loc} • Surveyor: ${timStr}${schedule.pic_name ? ` • PIC: ${schedule.pic_name}` : ''}`;
      tag = 'aksarasync-schedule-survey';
    } else {
      const label = schedule.manual_agenda || 'Agenda Baru';
      title = `📌 ${label}: ${clientName}`;
      const loc = schedule.location || schedule.client_address;
      body = `📅 ${dateStr} (${timeStr}) • Klien: ${clientName} • Tim: ${timStr}${loc ? ` • Lokasi: ${loc}` : ''}`;
      tag = 'aksarasync-schedule-other';
    }
  } else {
    // UPDATE flow
    if (status === 'Completed') {
      priority = 'P3';
      title = `✅ Selesai: ${clientName} [${agendaType}]`;
      body = `Pekerjaan ${agendaType} untuk ${clientName} telah rampung diselesaikan oleh tim (${timStr}).`;
      tag = 'aksarasync-schedule-done';
    } else if (status === 'Cancelled') {
      priority = 'P1';
      title = `⚠️ Dibatalkan: ${clientName} [${agendaType}]`;
      body = `Agenda ${agendaType} pada ${dateStr} untuk ${clientName} resmi dibatalkan.`;
      tag = 'aksarasync-schedule-cancel';
    } else {
      priority = 'P2';
      title = `🔄 Reschedule: ${clientName} [${agendaType}]`;
      body = `Jadwal ${agendaType} dialihkan ke tanggal ${dateStr} (${timeStr}) • Tim: ${timStr}. Mohon cek kalender kerja.`;
      tag = 'aksarasync-schedule-update';
    }
  }

  return { title, body, tag, priority };
}

export async function sendPushNotification(payload: PushNotificationPayload): Promise<{ success: boolean; sent?: number; error?: string }> {
  try {
    const res = await fetch('/api/push-send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn('[Push Dispatch] Server responded with error:', res.status, errData);
      return { success: false, error: errData.error || `HTTP ${res.status}` };
    }

    const data = await res.json();
    console.log('[Push Dispatch] Successfully sent push notification:', data);
    return data;
  } catch (err: any) {
    console.warn('[Push Dispatch] Network error dispatching push notification:', err?.message || err);
    return { success: false, error: err?.message || 'Network error' };
  }
}
