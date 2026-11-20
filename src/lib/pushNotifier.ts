/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AksaraSync AI - Push Notification Dispatcher
 * Memancarkan Web Push Notification ke seluruh perangkat aktif via endpoint /api/push-send
 */

export interface PushNotificationPayload {
  title?: string;
  body?: string;
  tag?: string;
  table?: 'schedules' | 'manpower_absences';
  type?: 'INSERT' | 'UPDATE' | 'TEST';
  record?: any;
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
