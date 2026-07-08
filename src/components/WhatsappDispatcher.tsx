/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Share2, Copy, Check, Calendar, Smartphone, Info, Send, Clock, MapPin, Users } from 'lucide-react';
import { Schedule, Manpower, Unit, ManpowerAbsence } from '../types';

interface WhatsappDispatcherProps {
  schedules: Schedule[];
  units: Unit[];
  manpowerList: Manpower[];
  absences: ManpowerAbsence[];
  selectedDate: string; // YYYY-MM-DD
}

export default function WhatsappDispatcher({
  schedules,
  units,
  manpowerList,
  absences = [],
  selectedDate
}: WhatsappDispatcherProps) {
  const [activeTab, setActiveTab] = useState<'today' | 'weekly'>('today');
  const [previewText, setPreviewText] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const getSchedulesForDay = (dateStr: string): Schedule[] => {
    return schedules.filter(s => {
      if (s.status === 'Cancelled') return false;
      return dateStr >= s.start_date && dateStr <= s.end_date;
    });
  };

  const getWeekDays = (dateStr: string): Date[] => {
    const date = new Date(dateStr);
    const day = date.getDay(); // 0 is Sunday, 1 is Monday...
    // Calculate offset to get Monday (1)
    const diffToMonday = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diffToMonday));
    
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      week.push(nextDay);
    }
    return week;
  };

  const formatIndonesianDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatIndonesianShortDate = (d: Date): string => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
  };

  const formatDateString = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const generateTodayText = (): string => {
    const daySchedules = getSchedulesForDay(selectedDate);
    const dayAbsences = absences.filter(a => a.date === selectedDate);
    
    let text = `*AGENDA TIM - HARI INI*\n`;
    text += `📅 ${formatIndonesianDate(selectedDate)}\n`;
    text += `━━━━━━━━━━━━━━━━━━\n\n`;

    if (daySchedules.length === 0) {
      text += `*Status Tim: Standby Operasional*\n`;
      text += `• Tidak ada agenda hari ini. Seluruh tim standby di kantor.\n\n`;
    } else {
      daySchedules.forEach((s, idx) => {
        const agendaLabel = s.agenda_type === 'Lainnya' 
          ? (s.manual_agenda || 'Lainnya') 
          : s.agenda_type || 'Riksa Uji';

        text += `*${idx + 1}. Klien: ${s.client_name}*\n`;
        text += `• Kegiatan: ${agendaLabel}\n`;
        
        // Time
        const timeStr = s.is_until_finished 
          ? '09:00 - Selesai' 
          : (s.start_time || s.end_time) 
          ? `${s.start_time || '--:--'} - ${s.end_time || '--:--'}` 
          : '08:00 - Selesai';
        text += `• Jam: ${timeStr}\n`;

        // PIC Klien
        const picContact = s.pic_name 
          ? `${s.pic_name}${s.pic_phone ? ` (${s.pic_phone})` : ''}` 
          : 'Belum ditentukan';
        text += `• PIC Klien: ${picContact}\n`;

        // Location
        if (s.location) {
          text += `• Lokasi: ${s.location}\n`;
        }

        // Personnel (Combine Lead and Supports, no SKP)
        const lead = manpowerList.find(m => m.id === s.lead_expert_id);
        const supports = s.support_ids
          .map(sid => manpowerList.find(m => m.id === sid)?.name)
          .filter(Boolean);

        const teamMembers: string[] = [];
        if (lead) {
          teamMembers.push(`${lead.name} (Lead)`);
        }
        supports.forEach(name => teamMembers.push(name));

        const teamStr = teamMembers.length > 0 ? teamMembers.join(', ') : 'Belum ditentukan';
        text += `• Tim: ${teamStr}\n`;

        // Unit descriptions if any
        if (s.unit_descriptions && s.unit_descriptions.length > 0) {
          text += `• Deskripsi: ${s.unit_descriptions.join(', ')}\n`;
        } else if (s.unit_ids && s.unit_ids.length > 0) {
          const matchedUnits = s.unit_ids
            .map(uid => units.find(u => u.id === uid)?.unit_name)
            .filter(Boolean)
            .join(' & ');
          if (matchedUnits) {
            text += `• Unit Alat: ${matchedUnits}\n`;
          }
        }
        text += `\n`;
      });
    }

    // Absences Section
    if (dayAbsences.length > 0) {
      text += `*Berhalangan Hadir / Absen:*\n`;
      dayAbsences.forEach(abs => {
        const person = manpowerList.find(m => m.id === abs.manpower_id);
        const reasonStr = abs.reason ? ` (${abs.reason})` : '';
        text += `• ${person?.name || 'Staf'} (${abs.absence_type}${reasonStr})\n`;
      });
      text += `\n`;
    }

    text += `_Note: Tim lapangan jangan lupa bawa kelengkapan peralatan uji. Silakan hubungi PIC Klien sebelum meluncur ke lokasi._\n\n_made by: AksaraSyncAI (Developed by IT)_`;
    
    return text;
  };

  const generateWeeklyText = (): string => {
    const weekDays = getWeekDays(selectedDate);
    const startDateStr = formatDateString(weekDays[0]);
    const endDateStr = formatDateString(weekDays[6]);

    let text = `*REKAP JADWAL MINGGU INI*\n`;
    text += `📅 Periode: *${formatIndonesianShortDate(weekDays[0])}* s/d *${formatIndonesianShortDate(weekDays[6])}*\n`;
    text += `━━━━━━━━━━━━━━━━━━\n\n`;

    let activeDaysCount = 0;

    weekDays.forEach((day) => {
      const dateStr = formatDateString(day);
      const daySchedules = getSchedulesForDay(dateStr);
      
      if (daySchedules.length > 0) {
        activeDaysCount++;
        
        // Short day name and date like "Selasa, 7 Juli"
        const indonesianMonths = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        const indonesianDays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dayLabel = `*${indonesianDays[day.getDay()]}, ${day.getDate()} ${indonesianMonths[day.getMonth()]}*`;
        
        text += `${dayLabel}\n`;
        
        daySchedules.forEach((s) => {
          const agendaLabel = s.agenda_type === 'Lainnya' ? (s.manual_agenda || 'Lainnya') : s.agenda_type || 'Riksa Uji';
          
          const timeStr = s.is_until_finished 
            ? '09:00 - Selesai' 
            : (s.start_time || s.end_time) 
            ? `${s.start_time || '--:--'} - ${s.end_time || '--:--'}` 
            : 'Selesai';

          const lead = manpowerList.find(m => m.id === s.lead_expert_id);
          const leadName = lead ? lead.name : 'Belum Ditugaskan';
          
          text += `• [${agendaLabel}] ${s.client_name} | Jam: ${timeStr} | Lead: ${leadName}\n`;
        });
        text += `\n`;
      }
    });

    if (activeDaysCount === 0) {
      text += `Tidak ada agenda minggu ini. Seluruh tim standby.`;
    }

    text += `\n\n_made by: AksaraSyncAI (Developed by IT)_`;

    return text;
  };

  useEffect(() => {
    if (activeTab === 'today') {
      setPreviewText(generateTodayText());
    } else {
      setPreviewText(generateWeeklyText());
    }
  }, [activeTab, selectedDate, schedules, absences, manpowerList, units]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div id="whatsapp-dispatcher-card" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Title & Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100 text-emerald-600">
            <Smartphone className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm tracking-tight">WhatsApp Dispatcher</h3>
            <p className="text-[11px] text-slate-500">Kirim format rekap jadwal operasional secara instan</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100">
          <Send className="h-2.5 w-2.5" /> WA Ready
        </span>
      </div>

      {/* Button Toggles */}
      <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
        <button
          onClick={() => setActiveTab('today')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'today'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          Hari Ini
        </button>
        <button
          onClick={() => setActiveTab('weekly')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'weekly'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          Minggu Ini
        </button>
      </div>

      {/* Info Context */}
      <div className="flex items-start gap-2 text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium">
        <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
        <p>
          {activeTab === 'today'
            ? `Menghasilkan rekap mendetail untuk hari terpilih: ${formatIndonesianDate(selectedDate)}.`
            : `Menghasilkan rekap mingguan dari Senin s.d. Minggu yang berisi rekap hari-demi-hari.`}
        </p>
      </div>

      {/* Text Preview Box */}
      <div className="space-y-1">
        <div className="flex justify-between items-center px-1">
          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Pratinjau Pesan WA</label>
          <span className="text-[10px] font-mono text-slate-400">format markdown (*bold*, _italic_)</span>
        </div>
        <div className="relative">
          <textarea
            value={previewText}
            readOnly
            className="w-full h-44 p-3 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none select-all leading-relaxed"
          />
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            <span className="text-[8px] uppercase tracking-widest font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {activeTab === 'today' ? 'Today' : 'Weekly'}
            </span>
          </div>
        </div>
      </div>

      {/* Copy / Dispatch Action Button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2 font-bold text-xs py-2.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer ${
          isCopied
            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
            : 'bg-green-500 text-white hover:bg-green-600'
        }`}
      >
        {isCopied ? (
          <>
            <Check className="h-4 w-4 text-white animate-bounce" />
            <span>Berhasil Disalin!</span>
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            <span>Salin untuk WA</span>
          </>
        )}
      </motion.button>
    </div>
  );
}
