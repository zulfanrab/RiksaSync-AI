/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, Calendar, User, Save, X, AlertTriangle, Info, HelpCircle, Plus, Trash2 } from 'lucide-react';
import { Schedule, Manpower, Unit } from '../types';

interface ScheduleFormProps {
  initialSchedule?: Schedule | null;
  manpowerList: Manpower[];
  units: Unit[];
  schedules: Schedule[]; // for checking overlap conflicts
  onSave: (scheduleData: Omit<Schedule, 'id'> & { id?: string }) => void;
  onCancel: () => void;
}

export default function ScheduleForm({
  initialSchedule,
  manpowerList,
  units,
  schedules,
  onSave,
  onCancel
}: ScheduleFormProps) {
  // Form States
  const [clientName, setClientName] = useState('');
  const [picName, setPicName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [unitDescriptions, setUnitDescriptions] = useState<string[]>(['']);
  const [leadExpertId, setLeadExpertId] = useState('');
  const [selectedSupportIds, setSelectedSupportIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<'P1' | 'P2' | 'P3'>('P2');
  const [status, setStatus] = useState<Schedule['status']>('Scheduled');

  // New features states
  const [agendaType, setAgendaType] = useState<string>('Riksa Uji');
  const [manualAgenda, setManualAgenda] = useState('');
  const [isUntilFinished, setIsUntilFinished] = useState<boolean>(false);
  const [isTodayChecked, setIsTodayChecked] = useState<boolean>(false);

  // Sync end date with start date if isUntilFinished is true
  useEffect(() => {
    if (isUntilFinished && startDate) {
      setEndDate(startDate);
    }
  }, [startDate, isUntilFinished]);

  // AI Recommendation Feedback State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<{
    recommendedLeadExpertId: string;
    recommendedSupportIds: string[];
    rescheduleAdvice: string;
    reasoning: string;
  } | null>(null);

  // Load initial values if editing
  useEffect(() => {
    if (initialSchedule) {
      setClientName(initialSchedule.client_name || '');
      setPicName(initialSchedule.pic_name || '');
      setStartDate(initialSchedule.start_date || new Date().toISOString().split('T')[0]);
      setEndDate(initialSchedule.end_date || new Date().toISOString().split('T')[0]);
      setStartTime(initialSchedule.start_time || '');
      setEndTime(initialSchedule.end_time || '');
      setSelectedUnitIds(initialSchedule.unit_ids || []);
      setUnitDescriptions(initialSchedule.unit_descriptions && initialSchedule.unit_descriptions.length > 0 ? initialSchedule.unit_descriptions : ['']);
      setLeadExpertId(initialSchedule.lead_expert_id || '');
      setSelectedSupportIds(initialSchedule.support_ids || []);
      setPriority(initialSchedule.priority || 'P2');
      setStatus(initialSchedule.status || 'Scheduled');
      
      // Load new fields
      setAgendaType(initialSchedule.agenda_type || 'Riksa Uji');
      setManualAgenda(initialSchedule.manual_agenda || '');
      setIsUntilFinished(initialSchedule.is_until_finished || false);
      
      const todayStr = new Date().toISOString().split('T')[0];
      setIsTodayChecked(initialSchedule.start_date === todayStr && initialSchedule.end_date === todayStr);
    } else {
      // Clear form
      setClientName('');
      setPicName('');
      const todayStr = new Date().toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
      setStartTime('');
      setEndTime('');
      setSelectedUnitIds([]);
      setUnitDescriptions(['']);
      setLeadExpertId('');
      setSelectedSupportIds([]);
      setPriority('P2');
      setStatus('Scheduled');
      setAiRecommendation(null);
      
      // Reset new fields
      setAgendaType('Riksa Uji');
      setManualAgenda('');
      setIsUntilFinished(false);
      setIsTodayChecked(false);
    }
  }, [initialSchedule]);

  // Handle unit checkbox toggle
  const handleUnitToggle = (unitId: string) => {
    setSelectedUnitIds(prev => {
      const exists = prev.includes(unitId);
      if (exists) {
        return prev.filter(id => id !== unitId);
      } else {
        return [...prev, unitId];
      }
    });
  };

  // Find required SKPs based on selected units
  const requiredSKPs = useMemo(() => {
    const skps = new Set<string>();
    selectedUnitIds.forEach(uid => {
      const unit = units.find(u => u.id === uid);
      if (unit) {
        skps.add(unit.required_skp);
      }
    });
    return Array.from(skps);
  }, [selectedUnitIds, units]);

  // SMART DROP-DOWN FILTER: Filter Lead Experts based on required SKP licenses
  const filteredLeadExperts = useMemo(() => {
    if (requiredSKPs.length === 0) {
      // If no unit is selected, show all experts who have at least one SKP license
      return manpowerList.filter(m => m.skp.length > 0);
    }
    // Filter to only experts whose licenses overlap with ANY of the required SKPs for selected units
    return manpowerList.filter(m => {
      return m.skp.some(license => requiredSKPs.includes(license));
    });
  }, [requiredSKPs, manpowerList]);

  // Reset Lead Expert if they no longer match the filtered list (unless it's empty)
  useEffect(() => {
    if (leadExpertId && filteredLeadExperts.length > 0) {
      const isStillEligible = filteredLeadExperts.some(e => e.id === leadExpertId);
      if (!isStillEligible) {
        setLeadExpertId('');
      }
    }
  }, [filteredLeadExperts, leadExpertId]);

  // Helper: check overlap between two date ranges
  const checkDateOverlap = (s1: string, e1: string, s2: string, e2: string) => {
    return s1 <= e2 && e1 >= s2;
  };

  // Conflict lists: check who is booked on the current dates
  const bookingsForCurrentDates = useMemo(() => {
    if (!startDate || !endDate) return [];
    
    // Filter active schedules (excluding this schedule itself if we are editing)
    const activeSchedules = schedules.filter(s => {
      if (s.status === 'Cancelled') return false;
      if (initialSchedule && s.id === initialSchedule.id) return false;
      return checkDateOverlap(s.start_date, s.end_date, startDate, endDate);
    });

    const bookings: { manId: string; clientName: string; priority: string; isLead: boolean }[] = [];
    activeSchedules.forEach(s => {
      bookings.push({
        manId: s.lead_expert_id,
        clientName: s.client_name,
        priority: s.priority,
        isLead: true
      });
      s.support_ids.forEach(sid => {
        bookings.push({
          manId: sid,
          clientName: s.client_name,
          priority: s.priority,
          isLead: false
        });
      });
    });

    return bookings;
  }, [startDate, endDate, schedules, initialSchedule]);

  // Conflict maps
  const leadExpertConflict = useMemo(() => {
    if (!leadExpertId) return null;
    return bookingsForCurrentDates.find(b => b.manId === leadExpertId) || null;
  }, [leadExpertId, bookingsForCurrentDates]);

  const supportConflictsMap = useMemo(() => {
    const map = new Map<string, typeof bookingsForCurrentDates[0]>();
    selectedSupportIds.forEach(sid => {
      const booking = bookingsForCurrentDates.find(b => b.manId === sid);
      if (booking) map.set(sid, booking);
    });
    return map;
  }, [selectedSupportIds, bookingsForCurrentDates]);

  // AI Sudden Plotter action
  const handleAiAutoPlot = async () => {
    if (!startDate || !endDate || selectedUnitIds.length === 0) {
      setAiError('Mohon isi Tanggal dan pilih minimal 1 Unit sebelum menggunakan AI Auto-Plot.');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiRecommendation(null);

    try {
      const response = await fetch('/api/ai-plotter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName || 'Sudden Inspection',
          pic_name: picName || 'Operator',
          start_date: startDate,
          end_date: endDate,
          unit_ids: selectedUnitIds,
          priority
        })
      });

      if (!response.ok) {
        throw new Error('Gagal memproses rekomendasi AI.');
      }

      const recommendation = await response.json();
      setAiRecommendation(recommendation);

      // Automatically apply the recommendation to the form states!
      if (recommendation.recommendedLeadExpertId) {
        setLeadExpertId(recommendation.recommendedLeadExpertId);
      }
      if (recommendation.recommendedSupportIds && recommendation.recommendedSupportIds.length > 0) {
        setSelectedSupportIds(recommendation.recommendedSupportIds);
      }
    } catch (err: any) {
      setAiError(err.message || 'Gagal berkomunikasi dengan AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddDescriptionRow = () => {
    setUnitDescriptions(prev => [...prev, '']);
  };

  const handleDescriptionChange = (index: number, value: string) => {
    setUnitDescriptions(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleRemoveDescriptionRow = (index: number) => {
    setUnitDescriptions(prev => {
      if (prev.length <= 1) {
        return [''];
      }
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return alert('Mohon isi Nama Klien');
    if (!startDate || !endDate) return alert('Mohon tentukan tanggal');
    if (selectedUnitIds.length === 0) return alert('Mohon pilih minimal satu unit');
    if (!leadExpertId) return alert('Mohon tentukan Lead Expert');

    onSave({
      client_name: clientName,
      pic_name: picName || 'Internal Staff',
      start_date: startDate,
      end_date: endDate,
      start_time: startTime || undefined,
      end_time: endTime || undefined,
      unit_ids: selectedUnitIds,
      unit_descriptions: unitDescriptions.filter(val => val.trim() !== ''),
      lead_expert_id: leadExpertId,
      support_ids: selectedSupportIds,
      priority,
      status,
      agenda_type: agendaType,
      manual_agenda: agendaType === 'Lainnya' ? manualAgenda : undefined,
      is_until_finished: isUntilFinished
    });
  };

  return (
    <form
      onSubmit={handleSaveForm}
      className="bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] md:max-h-[85vh] text-slate-800 overflow-hidden w-full transition-all"
    >
      {/* STICKY HEADER - Always visible on top */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0 bg-white z-10">
        <div>
          <h3 className="font-bold text-slate-800 text-sm md:text-base tracking-tight uppercase">
            {initialSchedule ? 'Ubah Plotting Jadwal' : 'Tambah Plotting Baru'}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Lengkapi data riksa teknik di bawah ini</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-all"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* SCROLLABLE FORM BODY - Clean layout with touch targets optimized for mobile */}
      <div className="overflow-y-auto flex-1 p-5 md:p-6 space-y-5">
        
        {/* Basic Inputs (Klien & PIC) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Nama Klien / Perusahaan</label>
            <input
              type="text"
              required
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="PT Sukses Sejahtera"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 placeholder-slate-400 font-medium h-10"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">PIC Lapangan</label>
            <input
              type="text"
              value={picName}
              onChange={e => setPicName(e.target.value)}
              placeholder="Budi Setiawan"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 placeholder-slate-400 font-medium h-10"
            />
          </div>
        </div>

        {/* Jenis Agenda */}
        <div className="space-y-1.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Jenis Agenda Kegiatan</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'Riksa Uji', label: 'Riksa Uji' },
              { id: 'Survey', label: 'Survey' },
              { id: 'Lainnya', label: 'Lainnya (Manual)' }
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAgendaType(opt.id)}
                className={`px-2.5 py-2 text-[11px] font-extrabold rounded-lg border text-center transition-all ${
                  agendaType === opt.id
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-white border-slate-250 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {agendaType === 'Lainnya' && (
            <div className="mt-2.5">
              <input
                type="text"
                required
                value={manualAgenda}
                onChange={e => setManualAgenda(e.target.value)}
                placeholder="Tuliskan nama kegiatan manual riksa teknik..."
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-850 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-medium h-10"
              />
            </div>
          )}
        </div>

        {/* Date Row with Options */}
        <div className="space-y-2 bg-slate-50/40 p-3.5 rounded-xl border border-slate-200/50">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tanggal Kegiatan</label>
            <div className="flex items-center gap-4">
              {/* Checkbox Hari Ini */}
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-500 hover:text-emerald-600 select-none">
                <input
                  type="checkbox"
                  checked={isTodayChecked}
                  onChange={e => {
                    const checked = e.target.checked;
                    setIsTodayChecked(checked);
                    if (checked) {
                      const todayStr = new Date().toISOString().split('T')[0];
                      setStartDate(todayStr);
                      setEndDate(todayStr);
                    }
                  }}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/10 h-3.5 w-3.5"
                />
                <span>Hari Ini (Survey Cepat)</span>
              </label>

              {/* Checkbox Sampai Selesainya */}
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-500 hover:text-emerald-600 select-none">
                <input
                  type="checkbox"
                  checked={isUntilFinished}
                  onChange={e => {
                    const checked = e.target.checked;
                    setIsUntilFinished(checked);
                    if (checked) {
                      setEndDate(startDate);
                    }
                  }}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/10 h-3.5 w-3.5"
                />
                <span>Sampai Selesainya</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-400 block uppercase">Mulai</span>
              <input
                type="date"
                required
                value={startDate}
                disabled={isTodayChecked}
                onChange={e => {
                  setStartDate(e.target.value);
                  setIsTodayChecked(false); // Uncheck if manually edited
                }}
                className="w-full bg-white border border-slate-200 disabled:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-semibold h-10"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-400 block uppercase">Selesai</span>
              {isUntilFinished ? (
                <input
                  type="text"
                  disabled
                  value="Sampai Selesainya"
                  className="w-full bg-slate-100 border border-slate-200 disabled:opacity-90 rounded-lg px-3 py-2 text-xs text-emerald-700 font-extrabold italic h-10 text-center"
                />
              ) : (
                <input
                  type="date"
                  required
                  value={endDate}
                  disabled={isTodayChecked}
                  onChange={e => {
                    setEndDate(e.target.value);
                    setIsTodayChecked(false); // Uncheck if manually edited
                  }}
                  className="w-full bg-white border border-slate-200 disabled:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-semibold h-10"
                />
              )}
            </div>
          </div>
        </div>

        {/* Optional Time Row (Jam Mulai & Jam Selesai) */}
        <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200/60 space-y-2">
          <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">Opsi Jam Kerja / Riksa (Opsional)</span>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jam Mulai</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-mono h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jam Selesai</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-mono h-9"
              />
            </div>
          </div>
        </div>

        {/* Priority & Status Controls */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Prioritas Riksa</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-semibold h-10"
            >
              <option value="P1">P1 - Critical (Red)</option>
              <option value="P2">P2 - High (Yellow)</option>
              <option value="P3">P3 - Medium (Green)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Status Riksa</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-semibold h-10"
            >
              <option value="Draft">Draft (Rencana)</option>
              <option value="Scheduled">Scheduled (Aktif)</option>
              <option value="Completed">Completed (Selesai)</option>
              <option value="Cancelled">Cancelled (Batal)</option>
            </select>
          </div>
        </div>

        {/* Unit Inspeksi (Checkboxes) - Grid columns single on mobile, double on sm+ */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Unit Alat yang Diinspeksi</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/50 p-3 rounded-xl border border-slate-200">
            {units.map(unit => {
              const isChecked = selectedUnitIds.includes(unit.id);
              return (
                <label
                  key={unit.id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-emerald-50/50 border-emerald-300 text-emerald-900'
                      : 'bg-slate-100/30 border-slate-200 text-slate-600 hover:bg-slate-100/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleUnitToggle(unit.id)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 shrink-0 cursor-pointer"
                  />
                  <div className="text-[11px]">
                    <p className="font-bold leading-tight">{unit.unit_name}</p>
                    <span className="text-[9px] text-[#B8860B] font-mono font-semibold">Lisensi SKP: {unit.required_skp}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Dynamic Detail Deskripsi Unit (Opsional) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Detail Deskripsi Unit (Opsional)
            </label>
            <span className="text-[10px] text-slate-400 font-medium">
              {unitDescriptions.filter(d => d.trim() !== '').length} terisi
            </span>
          </div>

          <div className="space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-200">
            {unitDescriptions.map((desc, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={desc}
                  onChange={e => handleDescriptionChange(index, e.target.value)}
                  placeholder={`Contoh: Bejana Tekan No. Ser_09${index + 1} atau Panel Distribusi`}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 placeholder-slate-400 font-medium h-10"
                />
                
                {index === 0 ? (
                  <button
                    type="button"
                    onClick={handleAddDescriptionRow}
                    title="Tambah Baris"
                    className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all shadow-sm flex items-center justify-center shrink-0 h-10 w-10 active:scale-95"
                  >
                    <Plus className="h-4.5 w-4.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRemoveDescriptionRow(index)}
                    title="Hapus Baris"
                    className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-lg transition-all flex items-center justify-center shrink-0 h-10 w-10 active:scale-95"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                )}
              </div>
            ))}
            <p className="text-[10px] text-slate-400 italic font-sans leading-tight mt-1">
              Tambahkan detail deskripsi spesifik alat (misal: merek, kapasitas, nomor seri, atau kode lokasi) untuk mempermudah tim inspeksi di lapangan.
            </p>
          </div>
        </div>

        {/* AI AUTO-PLOTTER BUTTON */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleAiAutoPlot}
            disabled={aiLoading}
            className="w-full bg-[#D4AF37] hover:bg-[#B8860B] text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-50 h-11"
          >
            <Sparkles className={`h-4 w-4 text-white ${aiLoading ? 'animate-spin' : ''}`} />
            {aiLoading ? 'Mengotomatisasi Plotting via AI...' : 'AI Auto-Plot (Smart Planner)'}
          </button>
          <p className="text-[10px] text-slate-400 text-center mt-1.5 font-sans leading-tight">
            AI akan memeriksa SKP, mencocokkan ketersediaan jadwal, & merekomendasikan personil secara instan!
          </p>
        </div>

        {/* AI Output Alert Area */}
        {aiError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg flex items-start gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{aiError}</span>
          </div>
        )}

        {aiRecommendation && (
          <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-3.5 relative overflow-hidden space-y-2">
            <div className="absolute top-0 right-0 p-1 text-[8px] bg-amber-100 text-[#B8860B] uppercase font-mono tracking-wider rounded-bl border-l border-b border-amber-200 font-bold">
              Rekomendasi AI
            </div>
            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px]">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>Saran Plotting & Penjadwalan Ulang</span>
            </div>
            <p className="text-xs text-slate-700 italic leading-relaxed font-medium">
              "{aiRecommendation.rescheduleAdvice}"
            </p>
            <div className="text-[10px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800">Justifikasi Teknis:</span> {aiRecommendation.reasoning}
            </div>
          </div>
        )}

        {/* SMART DROPDOWN: Lead Expert Selection (Filtered by required SKP) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              Lead Expert (Ahli SKP)
            </label>
            <span className="text-[9px] text-slate-400 font-bold font-mono">
              {filteredLeadExperts.length} qualified
            </span>
          </div>

          {requiredSKPs.length > 0 && (
            <div className="text-[9px] bg-amber-50 text-[#B8860B] px-2 py-1 rounded border border-amber-200 uppercase font-mono font-bold inline-block mb-1">
              Butuh SKP: {requiredSKPs.join(', ')}
            </div>
          )}

          <select
            value={leadExpertId}
            required
            onChange={e => setLeadExpertId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-semibold h-10"
          >
            <option value="">-- Pilih Lead Expert (Disaring Berdasarkan SKP) --</option>
            {filteredLeadExperts.map(expert => (
              <option key={expert.id} value={expert.id}>
                {expert.name} ({expert.role}) - SKP: {expert.skp.join(', ')}
              </option>
            ))}
          </select>

          {/* Warning Badge if Lead Expert has Schedule Conflict */}
          {leadExpertConflict && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2.5 rounded-lg flex items-start gap-2 mt-1 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <span className="font-bold">⚠️ Warning Konflik Jadwal:</span> {manpowerList.find(m => m.id === leadExpertId)?.name} sudah memiliki jadwal riksa aktif pada tanggal ini di <strong className="text-slate-850">"{leadExpertConflict.clientName}"</strong> ({leadExpertConflict.priority}).
              </div>
            </div>
          )}
        </div>

        {/* Support Team Selection - Stacked beautifully on mobile, grid on larger screens */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Daftar Tim Support (Rekomendasi 1-3 orang)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/50 p-3 rounded-xl border border-slate-200">
            {manpowerList
              .filter(m => m.id !== leadExpertId) // cannot be both lead and support
              .map(support => {
                const isChecked = selectedSupportIds.includes(support.id);
                const conflict = supportConflictsMap.get(support.id);
                return (
                  <div
                    key={support.id}
                    className={`p-2.5 rounded-lg border flex flex-col justify-between transition-all ${
                      isChecked
                        ? 'bg-emerald-50/40 border-emerald-300'
                        : 'bg-slate-100/40 border-slate-200 hover:bg-slate-100/80'
                    }`}
                  >
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedSupportIds(prev =>
                            isChecked ? prev.filter(id => id !== support.id) : [...prev, support.id]
                          );
                        }}
                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer shrink-0"
                      />
                      <div className="text-[11px]">
                        <span className="font-bold text-slate-800 block leading-tight">{support.name}</span>
                        <span className="text-[9px] text-slate-500 block mt-1 font-medium">{support.role}</span>
                      </div>
                    </label>

                    {conflict && (
                      <span className="text-[8px] text-amber-700 font-bold bg-amber-50 border border-amber-150 px-1.5 py-0.5 rounded mt-1.5 block truncate" title={`Bentrok di ${conflict.clientName}`}>
                        ⚠️ Bentrok di {conflict.clientName}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

      </div>

      {/* STICKY FOOTER - Always visible on the bottom */}
      <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0 z-10">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all shadow-sm h-10"
        >
          Batalkan
        </button>
        <button
          type="submit"
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 h-10"
        >
          <Save className="h-4 w-4" />
          Simpan Jadwal Plotting
        </button>
      </div>
    </form>
  );
}
