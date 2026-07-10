/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from '@google/genai';
import webpush from 'web-push';
import { google } from 'googleapis';
import { Readable } from 'stream';

// ── Google Drive API Setup ─────────────────────────────────────────────────
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || '';
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || '';
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '';

let driveConfigStatus = 'Not Configured';
let googleAuth: any = null;

if (GOOGLE_CLIENT_EMAIL && GOOGLE_PRIVATE_KEY) {
  try {
    const formattedKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    googleAuth = new google.auth.JWT({
      email: GOOGLE_CLIENT_EMAIL,
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
    });
    driveConfigStatus = 'Configured Successfully';
    console.log('[Google Drive] Authenticated successfully with Service Account.');
  } catch (err: any) {
    driveConfigStatus = `Error: ${err.message}`;
    console.error('[Google Drive] Configuration failed:', err.message);
  }
} else {
  console.warn('[Google Drive] Credentials not set. Drive uploads will be disabled.');
}

// ── VAPID Setup for Web Push ───────────────────────────────────────────────
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@aksarasync.com';

let pushConfigStatus = 'Not Configured';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    pushConfigStatus = 'Configured Successfully';
    console.log('[Push] VAPID keys configured successfully.');
  } catch (err: any) {
    pushConfigStatus = `Error: ${err.message}`;
    console.error('[Push] VAPID configuration failed:', err.message);
  }
} else {
  console.warn('[Push] VAPID keys not configured. Push notifications will not work.');
}

// --- Type Interfaces ---
export interface Manpower {
  id: string;
  name: string;
  role: string;
  status: 'internal' | 'external';
  skp: string[]; // List of SKP licenses/skills
}

export interface Unit {
  id: string;
  unit_name: string;
  required_skp: string;
}

export interface Schedule {
  id: string;
  client_name: string;
  pic_name: string;
  pic_phone?: string; // Contact PIC
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  start_time?: string; // Optional HH:MM
  end_time?: string;   // Optional HH:MM
  unit_ids?: string[]; // Array of Unit IDs (optional for non-technical)
  lead_expert_id?: string; // Optional for non-technical
  support_ids: string[]; // Array of Support Manpower IDs
  priority: 'P1' | 'P2' | 'P3'; // P1: Critical, P2: High, P3: Medium
  status: 'Draft' | 'Scheduled' | 'Completed' | 'Cancelled';
  unit_descriptions?: string[]; // Optional unit descriptions
  created_by?: string;
  updated_by?: string;
  agenda_type?: string;        // 'Riksa Uji' | 'Meeting' | 'Survey' | 'Lainnya'
  manual_agenda?: string;      // Manual text input for 'Lainnya'
  is_until_finished?: boolean; // Until finished option
  location?: string;           // Meeting or Survey Location
}

export interface AppUser {
  id: string;
  username: string;
  role: string;
}

export interface ManpowerAbsence {
  id: string;
  manpower_id: string;
  date: string; // YYYY-MM-DD
  absence_type: 'Sakit' | 'Cuti' | 'Izin';
  reason?: string;
}

export interface DBState {
  manpower: Manpower[];
  units: Unit[];
  schedules: Schedule[];
  absences: ManpowerAbsence[];
}

// --- Database Manager ---
export class DatabaseManager {
  private supabase: any = null;

  constructor() {
    this.initDatabase();
  }

  private initDatabase() {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

    if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('https://')) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        console.log('Supabase client successfully initialized on backend.');
      } catch (err) {
        console.error('Failed to initialize Supabase client:', err);
      }
    } else {
      console.error('Supabase credentials not configured in backend environment.');
    }
  }

  // --- Manpower API ---
  async getManpower(): Promise<Manpower[]> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('manpower').select('*');
    if (error) {
      throw new Error(`Error fetching manpower: ${error.message}`);
    }
    return data as Manpower[];
  }

  async addManpower(person: Omit<Manpower, 'id'>): Promise<Manpower> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('manpower').insert([person]).select();
    if (error) {
      throw new Error(`Error adding manpower: ${error.message}`);
    }
    if (!data || data.length === 0) {
      throw new Error('Failed to insert manpower: No data returned');
    }
    return data[0] as Manpower;
  }

  // --- Units API ---
  async getUnits(): Promise<Unit[]> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('units').select('*');
    if (error) {
      throw new Error(`Error fetching units: ${error.message}`);
    }
    return data as Unit[];
  }

  async addUnit(unit: Omit<Unit, 'id'>): Promise<Unit> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('units').insert([unit]).select();
    if (error) {
      throw new Error(`Error adding unit: ${error.message}`);
    }
    if (!data || data.length === 0) {
      throw new Error('Failed to insert unit: No data returned');
    }
    return data[0] as Unit;
  }

  // --- Schedules API ---
  async getSchedules(): Promise<Schedule[]> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('schedules').select('*');
    if (error) {
      throw new Error(`Error fetching schedules: ${error.message}`);
    }
    return data as Schedule[];
  }

  async addSchedule(schedule: Omit<Schedule, 'id'>): Promise<Schedule> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('schedules').insert([schedule]).select();
    if (error) {
      throw new Error(`Error adding schedule: ${error.message}`);
    }
    if (!data || data.length === 0) {
      throw new Error('Failed to insert schedule: No data returned');
    }
    return data[0] as Schedule;
  }

  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule | null> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('schedules').update(updates).eq('id', id).select();
    if (error) {
      throw new Error(`Error updating schedule: ${error.message}`);
    }
    if (!data || data.length === 0) {
      return null;
    }
    return data[0] as Schedule;
  }

  async deleteSchedule(id: string): Promise<boolean> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { error } = await this.supabase.from('schedules').delete().eq('id', id);
    if (error) {
      throw new Error(`Error deleting schedule: ${error.message}`);
    }
    return true;
  }

  async getAppUsers(): Promise<AppUser[]> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('app_users').select('*');
    if (error) {
      throw new Error(`Error fetching app_users: ${error.message}`);
    }
    return data as AppUser[];
  }

  // --- Absences API ---
  async getAbsences(): Promise<ManpowerAbsence[]> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('manpower_absences').select('*');
    if (error) {
      console.warn(`Error fetching manpower_absences: ${error.message}`);
      return [];
    }
    return data as ManpowerAbsence[];
  }

  async addAbsence(absence: Omit<ManpowerAbsence, 'id'>): Promise<ManpowerAbsence> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('manpower_absences').insert([absence]).select();
    if (error) {
      throw new Error(`Error adding absence: ${error.message}`);
    }
    if (!data || data.length === 0) {
      throw new Error('Failed to insert absence: No data returned');
    }
    return data[0] as ManpowerAbsence;
  }

  async deleteAbsence(manpowerId: string, date: string): Promise<boolean> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { error } = await this.supabase.from('manpower_absences').delete().match({ manpower_id: manpowerId, date });
    if (error) {
      throw new Error(`Error deleting absence: ${error.message}`);
    }
    return true;
  }

  async getFullState(): Promise<DBState> {
    const [manpower, units, schedules, absences] = await Promise.all([
      this.getManpower(),
      this.getUnits(),
      this.getSchedules(),
      this.getAbsences().catch(() => [] as ManpowerAbsence[])
    ]);
    return { manpower, units, schedules, absences };
  }

  isSupabaseConnected(): boolean {
    return !!this.supabase;
  }
}

const dbManager = new DatabaseManager();

// --- AI Engine & Helpers ---
let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

function localDeterministicPlotter(
  newSchedule: {
    client_name: string;
    pic_name: string;
    start_date: string;
    end_date: string;
    unit_ids: string[];
    priority: 'P1' | 'P2' | 'P3';
    agenda_type?: string;
  },
  dbState: DBState
): {
  recommendedLeadExpertId: string;
  recommendedSupportIds: string[];
  rescheduleAdvice: string;
  reasoning: string;
} {
  const { manpower, units, schedules } = dbState;
  const isRiksaUji = !newSchedule.agenda_type || newSchedule.agenda_type === 'Riksa Uji';

  const checkOverlap = (start1: string, end1: string, start2: string, end2: string) => {
    return start1 <= end2 && end1 >= start2;
  };

  let eligibleExperts = manpower;
  if (isRiksaUji) {
    const requiredSKPs = Array.from(new Set(
      (newSchedule.unit_ids || []).map(uid => {
        const unit = units.find(u => u.id === uid);
        return unit ? unit.required_skp : '';
      }).filter(Boolean)
    ));
    eligibleExperts = manpower.filter(m => {
      return m.skp.some(license => requiredSKPs.includes(license));
    });
  }

  if (eligibleExperts.length === 0) {
    return {
      recommendedLeadExpertId: '',
      recommendedSupportIds: [],
      rescheduleAdvice: 'Tidak ada ahli internal maupun eksternal dengan SKP yang sesuai untuk unit ini.',
      reasoning: 'System could not find any manpower with matching SKP in the database.'
    };
  }

  const availableExperts = eligibleExperts.filter(expert => {
    const hasConflict = schedules.some(s => {
      if (s.status === 'Cancelled') return false;
      const isBooked = s.lead_expert_id === expert.id || (s.support_ids || []).includes(expert.id);
      return isBooked && checkOverlap(s.start_date, s.end_date, newSchedule.start_date, newSchedule.end_date);
    });
    return !hasConflict;
  });

  let recommendedLeadId = '';
  let advice = '';
  let reason = '';

  if (availableExperts.length > 0) {
    recommendedLeadId = availableExperts[0].id;
    advice = isRiksaUji
      ? `Menyarankan ${availableExperts[0].name} sebagai Lead Expert karena memiliki SKP yang sesuai (${availableExperts[0].skp.join(', ')}) dan tersedia pada tanggal tersebut.`
      : `Menyarankan ${availableExperts[0].name} sebagai penanggung jawab/peserta utama karena tidak memiliki bentrokan jadwal.`;
    reason = 'Menemukan personil yang tersedia sesuai dengan jadwal kosong.';
  } else {
    const p3Schedules = schedules.filter(s => s.priority === 'P3' && s.status !== 'Cancelled');
    const overlappingP3 = p3Schedules.find(s => {
      const isLeadEligible = eligibleExperts.some(e => e.id === s.lead_expert_id);
      return isLeadEligible && checkOverlap(s.start_date, s.end_date, newSchedule.start_date, newSchedule.end_date);
    });

    if (overlappingP3) {
      recommendedLeadId = overlappingP3.lead_expert_id || '';
      const expertName = manpower.find(m => m.id === recommendedLeadId)?.name || 'Ahli';
      advice = `[SARAN PENJADWALAN ULANG] Semua personil yang cocok sedang bertugas. Direkomendasikan untuk menjadwalkan ulang proyek P3/Medium "${overlappingP3.client_name}" (${overlappingP3.start_date} s/d ${overlappingP3.end_date}) untuk membebaskan ${expertName}.`;
      reason = 'Terjadi konflik jadwal dengan proyek prioritas rendah (P3) yang bisa disesuaikan.';
    } else {
      recommendedLeadId = eligibleExperts[0].id;
      advice = `Semua personil yang memenuhi kriteria sedang bertugas dan tidak ada proyek prioritas rendah (P3) yang bisa ditunda. Disarankan menjadwalkan ulang agenda baru ini.`;
      reason = 'Semua personil penuh atau sibuk.';
    }
  }

  const availableSupport = manpower.filter(m => {
    if (m.id === recommendedLeadId) return false;
    const hasConflict = schedules.some(s => {
      if (s.status === 'Cancelled') return false;
      const isBooked = s.lead_expert_id === m.id || (s.support_ids || []).includes(m.id);
      return isBooked && checkOverlap(s.start_date, s.end_date, newSchedule.start_date, newSchedule.end_date);
    });
    return !hasConflict;
  });

  const sortedSupport = [...availableSupport].sort((a, b) => {
    const scoreA = a.skp.length === 0 ? 2 : 1;
    const scoreB = b.skp.length === 0 ? 2 : 1;
    return scoreB - scoreA;
  });

  const recommendedSupportIds = sortedSupport.slice(0, 2).map(s => s.id);

  return {
    recommendedLeadExpertId: recommendedLeadId,
    recommendedSupportIds,
    rescheduleAdvice: advice,
    reasoning: `${reason} (Deterministic Fallback)`
  };
}

export async function getAiSchedulePlot(
  newSchedule: {
    client_name: string;
    pic_name: string;
    start_date: string;
    end_date: string;
    unit_ids: string[];
    priority: 'P1' | 'P2' | 'P3';
    agenda_type?: string;
  },
  dbState: DBState
) {
  if (!isGeminiConfigured()) {
    return localDeterministicPlotter(newSchedule, dbState);
  }

  try {
    const ai = getAIClient();

    const prompt = `
Anda adalah Resource Manager AI bernama AksaraSync AI.
Tugas Anda adalah merencanakan plot manpower secara cerdas untuk proyek baru.

DATA AGENDA/PROYEK BARU:
- Nama Klien: ${newSchedule.client_name}
- PIC: ${newSchedule.pic_name}
- Tanggal Mulai: ${newSchedule.start_date}
- Tanggal Selesai: ${newSchedule.end_date}
- Jenis Agenda: ${newSchedule.agenda_type || 'Riksa Uji'}
- ID Unit yang diinspeksi (jika ada): ${JSON.stringify(newSchedule.unit_ids || [])}
- Prioritas Proyek: ${newSchedule.priority}

DATA UTAMA DATABASE:
1. Daftar Manpower (Ahli dan Support):
${JSON.stringify(dbState.manpower, null, 2)}

2. Daftar Unit dan SKP yang dibutuhkan:
${JSON.stringify(dbState.units, null, 2)}

3. Jadwal Eksisting Saat Ini:
${JSON.stringify(dbState.schedules.filter(s => s.status !== 'Cancelled'), null, 2)}

ATURAN BISNIS PLOTTING:
1. Jika Jenis Agenda adalah 'Riksa Uji':
   Lead Expert WAJIB memiliki lisensi SKP yang cocok dengan 'required_skp' dari unit yang diinspeksi. Cocokkan unit_ids proyek baru dengan daftar unit untuk menemukan required_skp.
2. Jika Jenis Agenda BUKAN 'Riksa Uji' (misalnya 'Meeting', 'Survey', atau 'Lainnya'):
   TIDAK PERLU mengecek kecocokan SKP. Rekomendasikan personel (Lead Expert dan Support) murni berdasarkan siapa saja yang jadwalnya sedang KOSONG (tidak bertugas) pada rentang tanggal tersebut.
3. Cek ketersediaan (availability): Seseorang dianggap sibuk jika dia bertugas sebagai Lead Expert atau berada di daftar Support pada tanggal yang tumpang tindih (overlap) dengan tanggal proyek baru (${newSchedule.start_date} s/d ${newSchedule.end_date}).
4. Tim Support / Peserta: Rekomendasikan 1 s/d 2 orang support/peserta tambahan yang tersedia pada tanggal tersebut.
5. ATURAN PENJADWALAN ULANG (CRITICAL):
   Jika semua personil yang memenuhi kriteria sedang sibuk pada tanggal tersebut:
   - Evaluasi proyek eksisting yang tumpang tindih.
   - Jika ada proyek eksisting dengan prioritas 'P3' (Medium), Anda dapat menyarankan untuk menjadwalkan ulang proyek P3 tersebut guna membebaskan ahlinya untuk agenda prioritas lebih tinggi ini. Sebutkan nama klien P3 secara detail dalam properti 'rescheduleAdvice'.

Berikan output dalam format JSON sesuai dengan skema yang diberikan.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Anda adalah asisten perencana manpower profesional yang sangat teliti dalam memeriksa jadwal, SKP, dan jenis agenda kerja lapangan.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedLeadExpertId: {
              type: Type.STRING,
              description: 'ID dari Lead Expert atau peserta utama yang direkomendasikan.'
            },
            recommendedSupportIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Array ID tim support/peserta yang direkomendasikan (1-2 orang).'
            },
            rescheduleAdvice: {
              type: Type.STRING,
              description: 'Saran dalam bahasa Indonesia tentang plot ini. Jika terjadi konflik jadwal, berikan solusi konkret tentang proyek P3 mana yang harus ditunda.'
            },
            reasoning: {
              type: Type.STRING,
              description: 'Alasan teknis singkat atas pemilihan manpower ini berdasarkan kecocokan SKP (jika Riksa Uji) atau ketersediaan jadwal kosong.'
            }
          },
          required: ['recommendedLeadExpertId', 'recommendedSupportIds', 'rescheduleAdvice', 'reasoning']
        }
      }
    });

    const resultText = response.text || '';
    return JSON.parse(resultText);
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    const isQuota = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
    const isBusy = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('demand');
    
    if (isQuota) {
      console.log('[AI Info] Gemini Smart Plotter quota limit reached. Using local deterministic fallback.');
    } else if (isBusy) {
      console.log('[AI Info] Gemini Smart Plotter model is temporarily busy. Using local deterministic fallback.');
    } else {
      console.log('[AI Info] Gemini Smart Plotter is temporarily unavailable. Using local deterministic fallback.');
    }
    return localDeterministicPlotter(newSchedule, dbState);
  }
}

function localDeterministicSummary(dbState: DBState): string {
  const activeSchedules = dbState.schedules.filter(s => s.status !== 'Cancelled');
  const scheduledCount = activeSchedules.filter(s => s.status === 'Scheduled').length;
  const draftCount = activeSchedules.filter(s => s.status === 'Draft').length;
  
  const expertCounts: Record<string, number> = {};
  activeSchedules.forEach(s => {
    if (s.lead_expert_id) {
      expertCounts[s.lead_expert_id] = (expertCounts[s.lead_expert_id] || 0) + 1;
    }
  });
  
  let busiestExpertName = '';
  let maxCount = 0;
  Object.entries(expertCounts).forEach(([id, count]) => {
    if (count > maxCount) {
      maxCount = count;
      const exp = dbState.manpower.find(m => m.id === id);
      if (exp) {
        busiestExpertName = exp.name;
      }
    }
  });

  const p1Count = activeSchedules.filter(s => s.priority === 'P1').length;

  let text = `Saat ini terdapat ${activeSchedules.length} kegiatan riksa uji aktif (${scheduledCount} terplot, ${draftCount} draf rencana). `;
  if (busiestExpertName) {
    text += `Ahli keselamatan dengan penugasan terbanyak saat ini adalah ${busiestExpertName} (${maxCount} proyek). `;
  }
  if (p1Count > 0) {
    text += `Terdapat ${p1Count} agenda berprioritas tinggi (P1/Critical) yang memerlukan perhatian khusus untuk memastikan kelancaran inspeksi lapangan. `;
  } else {
    text += `Semua agenda terpantau berjalan kondusif dengan tingkat risiko operasional yang terkendali. `;
  }
  text += `Rencana penjadwalan personil terdistribusi optimal untuk mendukung kepatuhan regulasi keselamatan kerja di semua klien PJK3.`;
  return text;
}

export async function getAiDashboardSummary(dbState: DBState): Promise<string> {
  if (!isGeminiConfigured()) {
    return 'Ringkasan Operasional (Lokal): ' + localDeterministicSummary(dbState) + ' (Hubungkan GEMINI_API_KEY di panel Secrets untuk analisis bertenaga AI)';
  }

  try {
    const ai = getAIClient();

    const prompt = `
Analisis data penjadwalan dan manpower berikut. Berikan ringkasan eksekutif mingguan yang singkat, profesional, dan informatif dalam Bahasa Indonesia.

DATA PENJADWALAN:
Schedules: ${JSON.stringify(dbState.schedules, null, 2)}
Manpower: ${JSON.stringify(dbState.manpower, null, 2)}

POIN YANG HARUS DIANGKAT (MAKSIMAL 3-4 KALIMAT):
1. Jumlah total riksa uji yang dijadwalkan/aktif.
2. Siapa ahli (Lead Expert) dengan beban kerja tertinggi minggu ini.
3. Apakah ada potensi konflik atau masalah kapasitas tim (misal proyek P1 yang kritis).
4. Nada bicara: Optimis, profesional, berorientasi solusi manajemen operasi.

Tulis ringkasannya langsung tanpa pengantar seperti "Berikut adalah ringkasan...".
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Anda adalah Direktur Operasional PJK3 yang merangkum status jadwal kerja tim riksa uji.',
      }
    });

    return response.text?.trim() || 'Gagal menghasilkan ringkasan AI.';
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    const isQuota = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
    const isBusy = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('demand');
    
    if (isQuota) {
      console.log('[AI Info] Gemini Dashboard Summary quota limit reached. Using local deterministic fallback.');
      return 'Ringkasan Operasional (Analisis Lokal - Quota AI Terbatas): ' + localDeterministicSummary(dbState);
    } else if (isBusy) {
      console.log('[AI Info] Gemini Dashboard Summary model is temporarily busy. Using local deterministic fallback.');
      return 'Ringkasan Operasional (Analisis Lokal - Model Sangat Sibuk): ' + localDeterministicSummary(dbState);
    } else {
      console.log('[AI Info] Gemini Dashboard Summary is temporarily unavailable. Using local deterministic fallback.');
      return 'Ringkasan Operasional (Analisis Lokal - Koneksi Terbatas): ' + localDeterministicSummary(dbState);
    }
  }
}

// --- Express App Setup ---
const app = express();
app.use(express.json());

// --- API Routes ---

// Get current state / status of the system
app.get('/api/status', (req, res) => {
  res.json({
    supabase: dbManager.isSupabaseConnected(),
    gemini: isGeminiConfigured(),
    push: pushConfigStatus,
    drive: driveConfigStatus
  });
});

// App users endpoint
app.get('/api/app_users', async (req, res) => {
  try {
    const users = await dbManager.getAppUsers();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manpower endpoints
app.get('/api/manpower', async (req, res) => {
  try {
    const manpower = await dbManager.getManpower();
    res.json(manpower);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Absences endpoints
app.get('/api/absences', async (req, res) => {
  try {
    const absences = await dbManager.getAbsences();
    res.json(absences);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/absences', async (req, res) => {
  try {
    const newAbsence = await dbManager.addAbsence(req.body);
    res.status(201).json(newAbsence);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/absences', async (req, res) => {
  try {
    const { manpower_id, date } = req.body;
    if (!manpower_id || !date) {
      return res.status(400).json({ error: 'Missing manpower_id or date' });
    }
    await dbManager.deleteAbsence(manpower_id, date);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Units endpoints
app.get('/api/units', async (req, res) => {
  try {
    const units = await dbManager.getUnits();
    res.json(units);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Schedules endpoints
app.get('/api/schedules', async (req, res) => {
  try {
    const schedules = await dbManager.getSchedules();
    res.json(schedules);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/schedules', async (req, res) => {
  try {
    const newSchedule = await dbManager.addSchedule(req.body);
    res.status(201).json(newSchedule);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/schedules/:id', async (req, res) => {
  try {
    const updated = await dbManager.updateSchedule(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/schedules/:id', async (req, res) => {
  try {
    const success = await dbManager.deleteSchedule(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI-Powered Sudden Schedule Plotter endpoint
app.post('/api/ai-plotter', async (req, res) => {
  try {
    const { client_name, pic_name, start_date, end_date, unit_ids, priority, agenda_type } = req.body;
    const isRiksaUji = !agenda_type || agenda_type === 'Riksa Uji';

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Missing required parameters: start_date, end_date' });
    }
    if (isRiksaUji && (!unit_ids || unit_ids.length === 0)) {
      return res.status(400).json({ error: 'Agenda Riksa Uji memerlukan minimal 1 Unit.' });
    }

    const dbState = await dbManager.getFullState();

    const plotRecommendation = await getAiSchedulePlot({
      client_name: client_name || 'Sudden Inspection',
      pic_name: pic_name || 'Operational PIC',
      start_date,
      end_date,
      unit_ids: unit_ids || [],
      priority: priority || 'P1',
      agenda_type: agenda_type || 'Riksa Uji'
    }, dbState);

    res.json(plotRecommendation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Daily/Weekly Summary endpoint (maintained for compatibility, upgraded to utilize full analytical power)
app.get('/api/ai-summary', async (req, res) => {
  try {
    const dbState = await dbManager.getFullState();
    const summary = await getAiDashboardSummary(dbState);
    res.json({ summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Interactive Chatbot endpoint (ON-DEMAND & CHAT-BASED)
app.post('/api/ai-chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const dbState = await dbManager.getFullState();

    if (!isGeminiConfigured()) {
      return res.json({
        reply: `Halo Zulfan! (Koneksi AI Lokal): Saya menerima pertanyaan Anda: "${message}". Untuk mendapatkan analisis cerdas, hubungkan GEMINI_API_KEY di Secrets panel.`
      });
    }

    const ai = getAIClient();

    // Map frontend history to Gemini content structure
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      history.forEach((h: any) => {
        contents.push({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.text }]
        });
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const systemInstruction = `
Anda adalah AksaraSync AI, asisten manajemen operasional PJK3 (Perusahaan Jasa Keselamatan dan Kesehatan Kerja) cerdas.
Pengguna saat ini adalah Zulfan (IT Staff / Support Staff). Sapa dia dengan hangat dan sopan (seperti "Halo Zulfan") ketika memulai percakapan pertama kali.

DATA OPERASIONAL SAAT INI (REAL-TIME DARI DATABASE SUPABASE):
1. Daftar Manpower (Karyawan Ahli & Support):
${JSON.stringify(dbState.manpower, null, 2)}

2. Daftar Unit Alat Teknis K3:
${JSON.stringify(dbState.units, null, 2)}

3. Daftar Jadwal/Agenda Kerja Aktif:
${JSON.stringify(dbState.schedules.filter(s => s.status !== 'Cancelled'), null, 2)}

Tugas Anda:
- Jawab pertanyaan pengguna dengan akurat, tajam, profesional, dan langsung ke intinya berdasarkan data riil di atas.
- Jika pengguna meminta ringkasan (harian, mingguan, atau bulanan), buatlah analisis operasional yang mendalam, berbobot, terstruktur, serta tunjukkan poin-poin krusial (seperti proyek berprioritas tinggi P1, personil yang sibuk atau tumpang tindih, dll.).
- Nada bicara: Optimis, profesional, solutif, amanah, dan berorientasi pada kelancaran operasi K3 di lapangan.
- Gunakan bahasa Indonesia yang baik dan profesional.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemInstruction
      }
    });

    res.json({ reply: response.text || 'Maaf, saya tidak dapat merumuskan jawaban.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Operational Insight endpoint (Weather & Holiday Analyzer)
app.get('/api/ai-operational-insight', async (req, res) => {
  try {
    const dbState = await dbManager.getFullState();

    if (!isGeminiConfigured()) {
      return res.json({
        insight: "### Operational Insight (Lokal)\n\n- **Analisis Cuaca**: Harap waspadai curah hujan yang tinggi bagi tim lapangan yang bertugas di luar ruangan (outdoor). Pastikan personil membawa jas hujan, sepatu safety, dan pelindung alat ukur listrik.\n- **Tanggal Merah**: Hindari memplot jadwal penting pada hari libur nasional resmi Indonesia untuk mencegah bentrokan dengan jadwal pabrik klien.\n\n*(Hubungkan GEMINI_API_KEY di Secrets untuk analisis cerdas Gemini)*"
      });
    }

    const ai = getAIClient();
    const prompt = `
Analisis rentang tanggal dari jadwal kegiatan aktif berikut di Indonesia:
Schedules: ${JSON.stringify(dbState.schedules.filter(s => s.status !== 'Cancelled'), null, 2)}

Tugas Anda:
1. Analisis tanggal-tanggal proyek aktif tersebut.
2. Berikan analisis perkiraan cuaca taktis (misal: kondisi umum iklim/cuaca wilayah tropis Indonesia di rentang bulan-bulan tersebut, kesiapan menghadapi hujan badai, cuaca ekstrem, atau panas terik) dan dampaknya bagi inspektur lapangan.
3. Berikan informasi potensi hari libur nasional atau tanggal merah penting di Indonesia yang perlu diwaspadai agar tidak mengganggu operasional klien atau tim lapangan.
4. Berikan rekomendasi operasional konkret dan tajam (misal: "Siapkan jas hujan & pelindung alat kelistrikan", "Konfirmasi ulang operasional pabrik jika jatuh di akhir pekan", dll.).

Format output: Berikan penjelasan yang rapi menggunakan Markdown, langsung ke pokok bahasan operasional lapangan secara berbobot, tanpa basa-basi pembuka. Gunakan nada bicara asisten operasional senior K3.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Anda adalah Manajer Keselamatan Lapangan & Analis Risiko Operasional K3 senior.'
      }
    });

    res.json({ insight: response.text?.trim() || 'Tidak ada insight operasional yang dihasilkan.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/push-subscribe ─────────────────────────────────────────────
// Receives a PushSubscription object from the browser and stores it in Supabase.
app.post('/api/push-subscribe', async (req, res) => {
  try {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription object.' });
    }

    const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured on server.' });
    }

    const supa = createClient(supabaseUrl, supabaseKey);

    // Upsert: update if endpoint already exists, insert if new
    const { error } = await supa.from('push_subscriptions').upsert(
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh || '',
        auth: subscription.keys?.auth || '',
        user_agent: req.headers['user-agent'] || ''
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      console.error('[Push] Failed to save subscription:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log('[Push] Subscription saved:', subscription.endpoint.substring(0, 60) + '...');
    res.json({ success: true, message: 'Subscription saved.' });
  } catch (err: any) {
    console.error('[Push] push-subscribe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/push-send ───────────────────────────────────────────────────
// Called by Supabase Webhook when schedules or manpower_absences change.
// Fetches all stored subscriptions and sends push to every device.
app.post('/api/push-send', async (req, res) => {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(500).json({ error: 'VAPID keys not configured.' });
    }

    const payload = req.body;
    const table = payload?.table || 'schedules';
    const record = payload?.record || payload?.new || {};
    const eventType = payload?.type || 'INSERT';

    // Build notification content based on event
    let title = '🔔 AksaraSync AI';
    let body = 'Ada pembaruan baru di database.';
    let tag = 'aksarasync-general';

    if (table === 'schedules') {
      const clientName = record.client_name || 'Klien';
      const agendaType = record.agenda_type || 'Riksa Uji';
      if (eventType === 'INSERT') {
        title = '📅 Agenda Baru Masuk!';
        body = `[${agendaType}] ${clientName} — Jadwal baru telah ditambahkan.`;
        tag = 'aksarasync-schedule-new';
      } else if (eventType === 'UPDATE') {
        const status = record.status || '';
        if (status === 'Completed') {
          title = '✅ Agenda Selesai!';
          body = `Pengerjaan untuk ${clientName} telah selesai.`;
          tag = 'aksarasync-schedule-done';
        } else if (status === 'Cancelled') {
          title = '⚠️ Agenda Dibatalkan';
          body = `Jadwal [${agendaType}] ${clientName} dibatalkan.`;
          tag = 'aksarasync-schedule-cancel';
        } else {
          title = '🔄 Agenda Diperbarui';
          body = `Jadwal ${clientName} (${agendaType}) telah diperbarui.`;
          tag = 'aksarasync-schedule-update';
        }
      }
    } else if (table === 'manpower_absences') {
      const absenceType = record.absence_type || 'Izin';
      title = `🏥 Absensi K3: ${absenceType}`;
      body = `Ada pengajuan ${absenceType} baru pada ${record.date || 'hari ini'}.`;
      tag = 'aksarasync-absence';
    }

    const pushPayload = JSON.stringify({ title, body, tag, url: '/' });

    // Fetch all subscriptions from Supabase
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured on server.' });
    }

    const supa = createClient(supabaseUrl, supabaseKey);

    // Simpan notifikasi ke database agar tidak hilang saat app ditutup
    try {
      const { error: logError } = await supa.from('notifications_log').insert([{
        title: title,
        message: body,
        priority: tag === 'aksarasync-schedule-new' ? 'P1' : (tag === 'aksarasync-absence' ? 'P2' : 'P3'),
        is_read: false
      }]);
      if (logError) console.error('[Push] Failed to log notification:', logError.message);
    } catch (e) {
      console.error('[Push] Failed to log notification (exception):', e);
    }

    const { data: subscriptions, error: fetchError } = await supa
      .from('push_subscriptions')
      .select('*');

    if (fetchError) {
      console.error('[Push] Failed to fetch subscriptions:', fetchError.message);
      return res.status(500).json({ error: fetchError.message });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.json({ success: true, sent: 0, message: 'No subscriptions found.' });
    }

    // Send push to all subscriptions in parallel
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        };
        try {
          await webpush.sendNotification(pushSub, pushPayload);
        } catch (pushErr: any) {
          // Remove expired/invalid subscriptions (410 Gone)
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            console.log('[Push] Removing expired subscription:', sub.endpoint.substring(0, 60));
            await supa.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          } else {
            throw pushErr;
          }
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    console.log(`[Push] Sent to ${successCount}/${subscriptions.length} devices.`);
    res.json({ success: true, sent: successCount, total: subscriptions.length });
  } catch (err: any) {
    console.error('[Push] push-send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Google Drive API Helper Functions ────────────────────────────────────────

function bufferToStream(buffer: Buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

async function findOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
  const drive = google.drive({ version: 'v3', auth: googleAuth });
  
  let query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  
  const response = await drive.files.list({
    q: query,
    fields: 'files(id)',
    spaces: 'drive',
  });
  
  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id!;
  }
  
  // Create folder if not exists
  const fileMetadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    fileMetadata.parents = [parentId];
  }
  
  const folder = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id',
  });
  
  return folder.data.id!;
}

async function uploadToGoogleDrive(
  fileName: string,
  mimeType: string,
  base64Data: string,
  clientName: string,
  category: string
): Promise<{ fileId: string; webViewLink: string }> {
  const drive = google.drive({ version: 'v3', auth: googleAuth });
  
  // Find or Create Client Folder
  const clientFolderId = await findOrCreateFolder(clientName, GOOGLE_DRIVE_FOLDER_ID || undefined);
  
  // Find or Create Category Folder
  const categoryFolderId = await findOrCreateFolder(category, clientFolderId);
  
  // Upload File
  const base64Body = base64Data.substring(base64Data.indexOf(',') + 1);
  const buffer = Buffer.from(base64Body, 'base64');
  
  const media = {
    mimeType: mimeType,
    body: bufferToStream(buffer),
  };
  
  const fileMetadata = {
    name: fileName,
    parents: [categoryFolderId],
  };
  
  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink',
  });
  
  const fileId = file.data.id!;
  
  // Set permission to anyone with link can view
  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });
  
  // Get updated file info (with public webViewLink)
  const fileInfo = await drive.files.get({
    fileId: fileId,
    fields: 'webViewLink',
  });
  
  return {
    fileId,
    webViewLink: fileInfo.data.webViewLink!,
  };
}

async function deleteFromGoogleDrive(fileId: string): Promise<void> {
  const drive = google.drive({ version: 'v3', auth: googleAuth });
  await drive.files.delete({
    fileId: fileId,
  });
}

// ── Google Drive API Endpoints ──────────────────────────────────────────────

// Get linked files for a schedule
app.get('/api/schedule-files/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured on server.' });
    }

    const supa = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supa
      .from('schedule_files')
      .select('*')
      .eq('schedule_id', scheduleId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload file to Google Drive and log in Supabase
app.post('/api/upload-drive', async (req, res) => {
  try {
    if (!googleAuth) {
      return res.status(500).json({ error: 'Google Drive integration is not configured.' });
    }

    const { fileName, mimeType, base64Data, clientName, category, scheduleId } = req.body;
    if (!fileName || !mimeType || !base64Data || !clientName || !category) {
      return res.status(400).json({ error: 'Missing required parameters (fileName, mimeType, base64Data, clientName, category).' });
    }

    // 1. Upload to Google Drive
    const uploadResult = await uploadToGoogleDrive(
      fileName,
      mimeType,
      base64Data,
      clientName,
      category
    );

    // 2. Insert metadata into Supabase
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured on server.' });
    }

    const supa = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supa.from('schedule_files').insert([{
      schedule_id: scheduleId || null,
      file_name: fileName,
      file_size: Math.round((base64Data.length * 3) / 4),
      category,
      google_drive_link: uploadResult.webViewLink,
      google_file_id: uploadResult.fileId
    }]).select();

    if (error) {
      // Clean up Google Drive file if Supabase insertion fails
      await deleteFromGoogleDrive(uploadResult.fileId).catch(() => {});
      return res.status(500).json({ error: `Failed to insert file metadata: ${error.message}` });
    }

    res.json({ success: true, file: data[0] });
  } catch (err: any) {
    console.error('[Google Drive] Upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete file from Google Drive and Supabase
app.post('/api/delete-drive', async (req, res) => {
  try {
    if (!googleAuth) {
      return res.status(500).json({ error: 'Google Drive integration is not configured.' });
    }

    const { fileId } = req.body;
    if (!fileId) {
      return res.status(400).json({ error: 'Missing required parameter: fileId.' });
    }

    const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured on server.' });
    }

    const supa = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supa
      .from('schedule_files')
      .select('google_file_id')
      .eq('id', fileId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'File metadata not found in database.' });
    }

    // Delete from Google Drive
    await deleteFromGoogleDrive(data.google_file_id);

    // Delete from Supabase
    const { error: deleteError } = await supa.from('schedule_files').delete().eq('id', fileId);
    if (deleteError) {
      return res.status(500).json({ error: `Failed to delete metadata: ${deleteError.message}` });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[Google Drive] Delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export { app };
export default app;
