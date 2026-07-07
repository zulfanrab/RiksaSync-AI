/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import { Manpower, Unit, Schedule, DBState } from './src/types';

// Lazy-initialized Gemini Client
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

// Check helper
export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// Local deterministic plotter fallback when Gemini API key is missing
function localDeterministicPlotter(
  newSchedule: {
    client_name: string;
    pic_name: string;
    start_date: string;
    end_date: string;
    unit_ids: string[];
    priority: 'P1' | 'P2' | 'P3';
  },
  dbState: DBState
): {
  recommendedLeadExpertId: string;
  recommendedSupportIds: string[];
  rescheduleAdvice: string;
  reasoning: string;
} {
  const { manpower, units, schedules } = dbState;

  // Find required SKPs for requested units
  const requiredSKPs = Array.from(new Set(
    newSchedule.unit_ids.map(uid => {
      const unit = units.find(u => u.id === uid);
      return unit ? unit.required_skp : '';
    }).filter(Boolean)
  ));

  // Helper to check overlap
  const checkOverlap = (start1: string, end1: string, start2: string, end2: string) => {
    return start1 <= end2 && end1 >= start2;
  };

  // Find experts matching SKPs
  const eligibleExperts = manpower.filter(m => {
    // Lead Expert must have at least one of the required SKPs
    return m.skp.some(license => requiredSKPs.includes(license));
  });

  if (eligibleExperts.length === 0) {
    return {
      recommendedLeadExpertId: '',
      recommendedSupportIds: [],
      rescheduleAdvice: 'Tidak ada ahli internal maupun eksternal dengan SKP yang sesuai untuk unit ini.',
      reasoning: 'System could not find any manpower with matching SKP in the database.'
    };
  }

  // Find experts who are NOT booked on these dates
  const availableExperts = eligibleExperts.filter(expert => {
    const hasConflict = schedules.some(s => {
      if (s.status === 'Cancelled') return false;
      const isBooked = s.lead_expert_id === expert.id || s.support_ids.includes(expert.id);
      return isBooked && checkOverlap(s.start_date, s.end_date, newSchedule.start_date, newSchedule.end_date);
    });
    return !hasConflict;
  });

  let recommendedLeadId = '';
  let advice = '';
  let reason = '';

  if (availableExperts.length > 0) {
    // Pick the first available expert
    recommendedLeadId = availableExperts[0].id;
    advice = `Menyarankan ${availableExperts[0].name} sebagai Lead Expert karena memiliki SKP yang sesuai (${availableExperts[0].skp.join(', ')}) dan tersedia pada tanggal tersebut.`;
    reason = 'Found available qualified lead expert deterministically.';
  } else {
    // No expert available! Let's check if we can reschedule a P3/Medium priority schedule
    const p3Schedules = schedules.filter(s => s.priority === 'P3' && s.status !== 'Cancelled');
    const overlappingP3 = p3Schedules.find(s => {
      const isLeadEligible = eligibleExperts.some(e => e.id === s.lead_expert_id);
      return isLeadEligible && checkOverlap(s.start_date, s.end_date, newSchedule.start_date, newSchedule.end_date);
    });

    if (overlappingP3) {
      recommendedLeadId = overlappingP3.lead_expert_id;
      const expertName = manpower.find(m => m.id === recommendedLeadId)?.name || 'Ahli';
      advice = `[SARAN PENJADWALAN ULANG] Semua ahli dengan SKP yang sesuai sedang bertugas. Direkomendasikan untuk menjadwalkan ulang proyek P3/Medium "${overlappingP3.client_name}" (${overlappingP3.start_date} s/d ${overlappingP3.end_date}) untuk membebaskan Lead Expert ${expertName}.`;
      reason = 'Determined conflict but resolved by suggesting reschedule of P3 project.';
    } else {
      // Pick first qualified expert anyway and request rescheduling
      recommendedLeadId = eligibleExperts[0].id;
      advice = `Semua ahli dengan SKP yang sesuai sedang bertugas dan tidak ada proyek prioritas rendah (P3) yang bisa dikorbankan. Anda harus menjadwalkan ulang proyek darurat ini atau menghubungi ahli eksternal tambahan. Ahli internal yang cocok adalah ${eligibleExperts[0].name}.`;
      reason = 'All experts booked, no low priority project available for swap.';
    }
  }

  // Choose 1-2 support members who are available
  const availableSupport = manpower.filter(m => {
    // Don't pick the selected lead expert
    if (m.id === recommendedLeadId) return false;
    // Don't pick experts unless they have no license/helper roles (Ajay, Arya, Riyan are high priority supports)
    const hasConflict = schedules.some(s => {
      if (s.status === 'Cancelled') return false;
      const isBooked = s.lead_expert_id === m.id || s.support_ids.includes(m.id);
      return isBooked && checkOverlap(s.start_date, s.end_date, newSchedule.start_date, newSchedule.end_date);
    });
    return !hasConflict;
  });

  // Sort available support: Support role / Helper first
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

// AI Smart Plotter using Gemini API
export async function getAiSchedulePlot(
  newSchedule: {
    client_name: string;
    pic_name: string;
    start_date: string;
    end_date: string;
    unit_ids: string[];
    priority: 'P1' | 'P2' | 'P3';
  },
  dbState: DBState
) {
  if (!isGeminiConfigured()) {
    console.log('Gemini API is not configured. Falling back to deterministic local schedule plotter.');
    return localDeterministicPlotter(newSchedule, dbState);
  }

  try {
    const ai = getAIClient();

    const prompt = `
Anda adalah Resource Manager AI bernama RiksaSync AI.
Tugas Anda adalah merencanakan plot manpower secara cerdas untuk proyek inspeksi keselamatan (PJK3) baru.

DATA PROYEK BARU:
- Nama Klien: ${newSchedule.client_name}
- PIC: ${newSchedule.pic_name}
- Tanggal Mulai: ${newSchedule.start_date}
- Tanggal Selesai: ${newSchedule.end_date}
- ID Unit yang diinspeksi: ${JSON.stringify(newSchedule.unit_ids)}
- Prioritas Proyek: ${newSchedule.priority}

DATA UTAMA DATABASE:
1. Daftar Manpower (Ahli dan Support):
${JSON.stringify(dbState.manpower, null, 2)}

2. Daftar Unit dan SKP yang dibutuhkan:
${JSON.stringify(dbState.units, null, 2)}

3. Jadwal Eksisting Saat Ini:
${JSON.stringify(dbState.schedules.filter(s => s.status !== 'Cancelled'), null, 2)}

ATURAN BISNIS PLOTTING:
1. Lead Expert WAJIB memiliki lisensi SKP yang cocok dengan 'required_skp' dari unit yang diinspeksi. Cocokkan unit_ids proyek baru dengan daftar unit untuk menemukan required_skp.
2. Cek ketersediaan (availability): Seseorang dianggap sibuk jika dia bertugas sebagai Lead Expert atau berada di daftar Support pada tanggal yang tumpang tindih (overlap) dengan tanggal proyek baru (${newSchedule.start_date} s/d ${newSchedule.end_date}).
3. Tim Support: Rekomendasikan 1 s/d 2 orang support yang tersedia (bisa Helper/Teknisi/Support yang SKP-nya kosong seperti Ajay, Arya, atau Riyan).
4. ATURAN PENJADWALAN ULANG (CRITICAL):
   Jika semua ahli yang memiliki SKP yang cocok sedang sibuk pada tanggal tersebut:
   - Evaluasi proyek eksisting yang tumpang tindih.
   - Jika ada proyek eksisting dengan prioritas 'P3' (Medium), Anda dapat menyarankan untuk "mengorbankan" / menjadwalkan ulang proyek P3 tersebut guna membebaskan ahlinya untuk proyek darurat/baru ini.
   - Jelaskan saran penjadwal ulang ini secara detail dalam properti 'rescheduleAdvice'. Sebutkan nama klien P3 yang harus dijadwalkan ulang.

Berikan output dalam format JSON sesuai dengan skema yang diberikan.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Anda adalah asisten perencana manpower profesional yang sangat teliti dalam memeriksa jadwal dan SKP.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedLeadExpertId: {
              type: Type.STRING,
              description: 'ID dari Lead Expert yang direkomendasikan.'
            },
            recommendedSupportIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Array ID tim support yang direkomendasikan (1-2 orang).'
            },
            rescheduleAdvice: {
              type: Type.STRING,
              description: 'Saran dalam bahasa Indonesia tentang plot ini. Jika terjadi konflik jadwal, berikan solusi konkret tentang proyek P3 mana yang harus ditunda.'
            },
            reasoning: {
              type: Type.STRING,
              description: 'Alasan teknis singkat atas pemilihan manpower ini berdasarkan kecocokan SKP dan ketersediaan.'
            }
          },
          required: ['recommendedLeadExpertId', 'recommendedSupportIds', 'rescheduleAdvice', 'reasoning']
        }
      }
    });

    const resultText = response.text || '';
    return JSON.parse(resultText);
  } catch (error: any) {
    const isQuotaError = error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('RESOURCE_EXHAUSTED');
    const isUnavailableError = error?.message?.includes('503') || error?.message?.includes('UNAVAILABLE') || error?.message?.includes('demand');
    if (isQuotaError) {
      console.warn('[AI Quota Limit] Gemini API free tier limit reached for Smart Plotter. Utilizing beautiful local deterministic plotter fallback.');
    } else if (isUnavailableError) {
      console.warn('[AI Temp Limit] Gemini API model is experiencing temporary high demand for Smart Plotter. Utilizing local deterministic plotter fallback.');
    } else {
      console.warn('[AI Warn] Gemini Smart Plotter exception caught, falling back:', error?.message || error);
    }
    // Graceful fallback to deterministic local plotter on API failure
    return localDeterministicPlotter(newSchedule, dbState);
  }
}

// Local deterministic dashboard summary fallback
function localDeterministicSummary(dbState: DBState): string {
  const activeSchedules = dbState.schedules.filter(s => s.status !== 'Cancelled');
  const scheduledCount = activeSchedules.filter(s => s.status === 'Scheduled').length;
  const draftCount = activeSchedules.filter(s => s.status === 'Draft').length;
  
  // Find lead expert workload
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

// AI Dashboard Summary using Gemini API
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
    const isQuotaError = error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('RESOURCE_EXHAUSTED');
    const isUnavailableError = error?.message?.includes('503') || error?.message?.includes('UNAVAILABLE') || error?.message?.includes('demand');
    if (isQuotaError) {
      console.warn('[AI Quota Limit] Gemini API free tier limit reached. Utilizing beautiful local deterministic analysis.');
      return 'Ringkasan Operasional (Analisis Lokal - Quota AI Terbatas): ' + localDeterministicSummary(dbState);
    } else if (isUnavailableError) {
      console.warn('[AI Temp Limit] Gemini API model is experiencing temporary high demand. Utilizing local deterministic analysis.');
      return 'Ringkasan Operasional (Analisis Lokal - Model Sangat Sibuk): ' + localDeterministicSummary(dbState);
    }
    console.warn('[AI Warn] Exception caught in generating AI summary, using fallback:', error?.message || error);
    return 'Ringkasan Operasional (Analisis Lokal - Koneksi Terbatas): ' + localDeterministicSummary(dbState);
  }
}
