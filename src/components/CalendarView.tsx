/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, MapPin, Award, Users, Tag, AlertCircle, Plus } from 'lucide-react';
import { Schedule, Unit, Manpower } from '../types';

interface CalendarViewProps {
  schedules: Schedule[];
  units: Unit[];
  manpowerList: Manpower[];
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  onEditSchedule: (schedule: Schedule) => void;
  onDeleteSchedule: (id: string) => void;
  onQuickAddSchedule?: (dateStr: string) => void;
}

export default function CalendarView({
  schedules,
  units,
  manpowerList,
  selectedDate,
  onSelectDate,
  onEditSchedule,
  onDeleteSchedule,
  onQuickAddSchedule
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Helper for generating month calendar grid
  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: Date[] = [];
    
    // Fill previous month trailing days
    const startOffset = firstDay.getDay(); // 0 is Sunday
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    // Fill next month leading days
    const endOffset = 42 - days.length; // standard 6-row calendar
    for (let i = 1; i <= endOffset; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  const days = getDaysInMonth(currentMonth);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    onSelectDate(today.toISOString().split('T')[0]);
  };

  const formatDateString = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Check schedules on a given day
  const getSchedulesForDay = (dateStr: string): Schedule[] => {
    return schedules.filter(s => {
      if (s.status === 'Cancelled') return false;
      return dateStr >= s.start_date && dateStr <= s.end_date;
    });
  };

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const getPriorityColor = (priority: 'P1' | 'P2' | 'P3') => {
    switch (priority) {
      case 'P1': return 'bg-red-50 border-red-100 text-red-600 font-bold';
      case 'P2': return 'bg-amber-50 border-amber-100 text-amber-600 font-bold';
      case 'P3': return 'bg-emerald-50 border-emerald-100 text-emerald-600 font-bold';
    }
  };

  const getPriorityDot = (priority: 'P1' | 'P2' | 'P3') => {
    switch (priority) {
      case 'P1': return 'bg-red-500';
      case 'P2': return 'bg-amber-500';
      case 'P3': return 'bg-emerald-500';
    }
  };

  // Get active schedules for selected day
  const selectedDaySchedules = getSchedulesForDay(selectedDate);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Calendar Grid - Left 8 columns */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100 text-emerald-600">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm tracking-tight">Kalender Jadwal Riksa</h3>
              <p className="text-xs text-slate-500">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={goToToday}
              className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-all mr-1.5 font-bold"
            >
              Hari Ini
            </button>
            <button
              onClick={prevMonth}
              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1 mb-1.5 text-center">
          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d, idx) => (
            <span key={d} className={`text-[10px] font-bold uppercase tracking-wider py-1 ${idx === 0 || idx === 6 ? 'text-slate-400' : 'text-slate-500'}`}>
              {d}
            </span>
          ))}
        </div>

        {/* Calendar days grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            const dateStr = formatDateString(day);
            const isSelected = dateStr === selectedDate;
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            const isToday = formatDateString(new Date()) === dateStr;
            const daySchedules = getSchedulesForDay(dateStr);

            return (
              <div
                key={idx}
                onClick={() => onSelectDate(dateStr)}
                className={`min-h-[72px] p-1.5 rounded-lg border cursor-pointer flex flex-col justify-between transition-all group/cell relative ${
                  isSelected
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold ring-1 ring-emerald-500/20'
                    : isToday
                    ? 'bg-slate-100 border-slate-300 text-slate-900 font-bold'
                    : isCurrentMonth
                    ? 'bg-slate-50/20 border-slate-100 text-slate-700 hover:border-slate-200 hover:bg-slate-50/60'
                    : 'bg-slate-50/10 border-transparent text-slate-300 hover:text-slate-400'
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className={`text-xs ${isToday && !isSelected ? 'text-emerald-600 font-bold' : ''}`}>
                    {day.getDate()}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    {/* Quick plus icon button */}
                    {onQuickAddSchedule && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevents selection change
                          onQuickAddSchedule(dateStr);
                        }}
                        title={`Tambah plotting cepat untuk tanggal ${dateStr}`}
                        className="opacity-0 group-hover/cell:opacity-100 focus:opacity-100 transition-opacity p-0.5 bg-emerald-650 hover:bg-emerald-700 text-white rounded-md shadow-sm flex items-center justify-center shrink-0 active:scale-90"
                      >
                        <Plus className="h-2.5 w-2.5 font-bold" />
                      </button>
                    )}

                    {/* Total projects bubble */}
                    {daySchedules.length > 0 && (
                      <span className="text-[8px] bg-slate-50 text-slate-500 px-1 rounded border border-slate-200 font-semibold shrink-0">
                        {daySchedules.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Schedule Indicators */}
                <div className="space-y-0.5 mt-1 max-h-[44px] overflow-hidden">
                  {daySchedules.slice(0, 2).map((s) => (
                    <div
                      key={s.id}
                      className={`text-[8px] font-bold px-1 py-0.2 rounded border truncate ${getPriorityColor(s.priority)}`}
                      title={`${s.client_name} (${s.priority})`}
                    >
                      {s.client_name}
                    </div>
                  ))}
                  {daySchedules.length > 2 && (
                    <div className="text-[7px] text-slate-400 text-center font-medium">
                      +{daySchedules.length - 2} lagi
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Projects List - Right 4 columns */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex-1 flex flex-col">
          <div className="mb-4">
            <h4 className="font-bold text-slate-800 text-xs tracking-wider uppercase">Daftar Riksa Aktif</h4>
            <p className="text-[11px] text-slate-500">Inspeksi untuk tanggal <span className="text-emerald-600 font-mono font-semibold">{selectedDate}</span></p>
          </div>

          <div className="space-y-3 overflow-y-auto flex-1 max-h-[380px] pr-1">
            {selectedDaySchedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center bg-slate-50/50 rounded-xl border border-slate-200 border-dashed h-full">
                <AlertCircle className="h-8 w-8 text-slate-400 mb-2" />
                <p className="text-xs text-slate-500 font-medium">Tidak ada agenda inspeksi</p>
                <p className="text-[10px] text-slate-400 mt-1">Gunakan tombol 'Tambah Plotting' untuk membuat jadwal baru</p>
              </div>
            ) : (
              selectedDaySchedules.map((s) => {
                const leadExpertName = manpowerList.find(m => m.id === s.lead_expert_id)?.name || 'Unknown';
                const supportNames = s.support_ids
                  .map(sid => manpowerList.find(m => m.id === sid)?.name)
                  .filter(Boolean)
                  .join(', ') || 'None';

                const matchedUnits = s.unit_ids
                  .map(uid => units.find(u => u.id === uid)?.unit_name)
                  .filter(Boolean)
                  .join(' & ');

                return (
                  <div
                    key={s.id}
                    className="p-3 bg-slate-50/30 rounded-xl border border-slate-200 hover:bg-slate-50/60 hover:border-slate-300 transition-all space-y-2 relative"
                  >
                    {/* Priority Bar Indicator */}
                    <div className={`absolute top-0 bottom-0 left-0 w-1 rounded-l-xl ${getPriorityDot(s.priority)}`} />

                    <div className="pl-2.5">
                      <div className="flex items-start justify-between gap-1.5">
                        <h5 className="font-bold text-slate-800 text-xs truncate" title={s.client_name}>
                          {s.client_name}
                        </h5>
                        <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded shrink-0 border ${getPriorityColor(s.priority)}`}>
                          {s.priority}
                        </span>
                      </div>

                      {/* Agenda Type & Until Finished Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {s.agenda_type === 'Survey' ? (
                          <span className="text-[8px] font-extrabold uppercase bg-indigo-50 border border-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-md">
                            🔍 Survey
                          </span>
                        ) : s.agenda_type === 'Lainnya' ? (
                          <span className="text-[8px] font-extrabold uppercase bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md truncate max-w-[130px]" title={s.manual_agenda || 'Kegiatan Lainnya'}>
                            ⚙️ {s.manual_agenda || 'Lainnya'}
                          </span>
                        ) : (
                          <span className="text-[8px] font-extrabold uppercase bg-emerald-50 border border-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-md">
                            ⚡ Riksa Uji
                          </span>
                        )}
                        
                        {s.is_until_finished && (
                          <span className="text-[8px] font-extrabold uppercase bg-rose-50 border border-rose-100 text-rose-600 px-1.5 py-0.5 rounded-md">
                            🔄 Sampai Selesainya
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <Tag className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate font-medium">{s.pic_name || 'Tanpa PIC'}</span>
                        </div>
                        {(s.start_time || s.end_time) && (
                          <div className="flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[9px] font-semibold shrink-0">
                            <span>🕒 {s.start_time || '--:--'} - {s.end_time || '--:--'}</span>
                          </div>
                        )}
                      </div>

                      {/* Units */}
                      <div className="mt-2 text-[10px] bg-emerald-50 p-2 rounded-lg border border-emerald-100 text-emerald-800 font-semibold flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span className="truncate" title={matchedUnits}>{matchedUnits || 'No Unit Selected'}</span>
                      </div>

                      {/* Unit Descriptions if any */}
                      {s.unit_descriptions && s.unit_descriptions.length > 0 && (
                        <div className="mt-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[9px] text-slate-500 space-y-0.5">
                          <span className="font-bold text-slate-400 block text-[8px] uppercase tracking-wider">Deskripsi Unit:</span>
                          <ul className="list-disc list-inside space-y-0.5">
                            {s.unit_descriptions.map((desc, dIdx) => (
                              <li key={dIdx} className="truncate font-medium text-slate-600" title={desc}>
                                {desc}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Staff Plot */}
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400 font-sans font-medium">Lead Expert:</span>
                          <span className="text-slate-800 font-bold">{leadExpertName}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400 font-sans font-medium">Support:</span>
                          <span className="text-slate-600 font-medium truncate max-w-[120px]" title={supportNames}>
                            {supportNames}
                          </span>
                        </div>
                      </div>

                      {/* Log creator/updater */}
                      {(s.created_by || s.updated_by) && (
                        <div className="mt-2 text-[9px] text-slate-400 font-sans italic flex flex-wrap justify-between items-center gap-1.5 border-t border-slate-100/50 pt-1.5">
                          {s.created_by && (
                            <span>Oleh: <span className="font-semibold text-slate-500">{s.created_by}</span></span>
                          )}
                          {s.updated_by && (
                            <span>Edit: <span className="font-semibold text-slate-500">{s.updated_by}</span></span>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-end gap-2">
                        <button
                          onClick={() => onEditSchedule(s)}
                          className="text-[9px] font-bold text-slate-600 hover:text-amber-700 bg-slate-50 px-2 py-1 rounded border border-slate-200 transition-all"
                        >
                          Ubah
                        </button>
                        <button
                          onClick={() => onDeleteSchedule(s.id)}
                          className="text-[9px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded border border-rose-200 transition-all"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
