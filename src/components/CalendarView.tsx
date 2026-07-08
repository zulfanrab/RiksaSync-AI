/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, MapPin, Award, Users, Tag, AlertCircle, Plus, FileDown } from 'lucide-react';
import { Schedule, Unit, Manpower, ManpowerAbsence } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CalendarViewProps {
  schedules: Schedule[];
  units: Unit[];
  manpowerList: Manpower[];
  absences: ManpowerAbsence[];
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
  absences = [],
  selectedDate,
  onSelectDate,
  onEditSchedule,
  onDeleteSchedule,
  onQuickAddSchedule
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly'>('monthly');

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

  const formatIndonesianShortDate = (d: Date): string => {
    const daysList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    return `${daysList[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
  };

  const days = getDaysInMonth(currentMonth);
  const weekDays = getWeekDays(selectedDate);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevWeek = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 7);
    const prevStr = formatDateString(prev);
    onSelectDate(prevStr);
    setCurrentMonth(prev);
  };

  const nextWeek = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 7);
    const nextStr = formatDateString(next);
    onSelectDate(nextStr);
    setCurrentMonth(next);
  };

  const handlePrev = () => {
    if (viewMode === 'monthly') {
      prevMonth();
    } else {
      prevWeek();
    }
  };

  const handleNext = () => {
    if (viewMode === 'monthly') {
      nextMonth();
    } else {
      nextWeek();
    }
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

  const indonesianDaysShort = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

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

  // PDF Export Generator (PT Aksara Riksa Perdana Corporate Standard)
  const handleExportPDF = () => {
    let activeSchedules: Schedule[] = [];
    let periodeText = '';
    
    if (viewMode === 'monthly') {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDayStr = formatDateString(new Date(year, month, 1));
      const lastDayStr = formatDateString(new Date(year, month + 1, 0));
      
      activeSchedules = schedules.filter(s => {
        if (s.status === 'Cancelled') return false;
        return s.start_date <= lastDayStr && s.end_date >= firstDayStr;
      });
      periodeText = `${monthNames[month]} ${year}`;
    } else {
      const firstDayStr = formatDateString(weekDays[0]);
      const lastDayStr = formatDateString(weekDays[6]);
      
      activeSchedules = schedules.filter(s => {
        if (s.status === 'Cancelled') return false;
        return s.start_date <= lastDayStr && s.end_date >= firstDayStr;
      });
      periodeText = `${formatIndonesianShortDate(weekDays[0])} s.d. ${formatIndonesianShortDate(weekDays[6])}`;
    }

    // Sort schedules by starting date
    activeSchedules.sort((a, b) => a.start_date.localeCompare(b.start_date));

    // Initialize document
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Header / Kop Surat (Landscape Width is 297mm)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('PT AKSARA RIKSA PERDANA', 14, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text('PJK3 Bidang Pemeriksaan dan Pengujian Teknik K3', 14, 20);

    // Right aligned Document Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    const docTitle = 'LAPORAN JADWAL OPERASIONAL';
    doc.text(docTitle, 283 - doc.getTextWidth(docTitle), 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const docPeriod = `Periode: ${periodeText}`;
    doc.text(docPeriod, 283 - doc.getTextWidth(docPeriod), 20);

    // Header Horizontal Divider Line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.4);
    doc.line(14, 24, 283, 24);

    // 2. Executive Summary Bar (Metrics Shaded Box)
    const totalAgendas = activeSchedules.length;
    const p1Agendas = activeSchedules.filter(s => s.priority === 'P1').length;
    const p2Agendas = activeSchedules.filter(s => s.priority === 'P2').length;
    const p3Agendas = activeSchedules.filter(s => s.priority === 'P3').length;

    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.roundedRect(14, 28, 269, 12, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('RINGKASAN EKSEKUTIF OPERASIONAL:', 18, 36);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Total Agenda:', 76, 36);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${totalAgendas} Kegiatan`, 95, 36);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Prioritas Tinggi (P1):', 128, 36);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38); // red-600
    doc.text(`${p1Agendas} Proyek`, 157, 36);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Prioritas Sedang (P2):', 184, 36);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(217, 119, 6); // amber-600
    doc.text(`${p2Agendas} Proyek`, 215, 36);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Prioritas Rendah (P3):', 238, 36);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text(`${p3Agendas} Proyek`, 269, 36);

    // 3. Prepare data for the autoTable
    const headers = [['Tanggal & Jam', 'Klien & PIC', 'Jenis Agenda', 'Deskripsi Alat / Lokasi', 'Tim Penugasan']];
    
    const tableRows = activeSchedules.map(s => {
      // Date and time layout
      let dateCell = `${s.start_date}`;
      if (s.end_date !== s.start_date) {
        dateCell += ` s/d ${s.end_date}`;
      }
      const timeStr = s.is_until_finished 
        ? '\nSampai Selesai' 
        : (s.start_time || s.end_time) 
        ? `\n🕒 ${s.start_time || '--:--'} - ${s.end_time || '--:--'}` 
        : '\nJam Kerja Standar';
      const fullDateCell = dateCell + timeStr;

      // Client & PIC details
      const picStr = s.pic_name ? `\nPIC: ${s.pic_name}` : '';
      const clientCell = `${s.client_name}${picStr}`;

      // Agenda categorization details
      let agendaCell = s.agenda_type || 'Riksa Uji';
      if (s.agenda_type === 'Lainnya' && s.manual_agenda) {
        agendaCell = `${s.manual_agenda}`;
      }
      agendaCell = `[${s.priority}] ${agendaCell}`;

      // Matched inspected items / location
      const matchedUnits = s.unit_ids
        .map(uid => units.find(u => u.id === uid)?.unit_name)
        .filter(Boolean)
        .join(' & ') || 'Tanpa Unit';
      
      const unitDescs = s.unit_descriptions && s.unit_descriptions.length > 0
        ? `\nDetail Unit:\n- ${s.unit_descriptions.join('\n- ')}`
        : '';
      const fullUnitCell = matchedUnits + unitDescs;

      // Allocated manpower
      const leadName = manpowerList.find(m => m.id === s.lead_expert_id)?.name || 'Belum Ditentukan';
      const supportNames = s.support_ids
        .map(sid => manpowerList.find(m => m.id === sid)?.name)
        .filter(Boolean)
        .join(', ') || 'Tanpa Support';
      const teamCell = `Lead: ${leadName}\nSupport: ${supportNames}`;

      return [fullDateCell, clientCell, agendaCell, fullUnitCell, teamCell];
    });

    // 4. Executing Autotable (No Signature Block below table, officially automated)
    autoTable(doc, {
      head: headers,
      body: tableRows,
      startY: 45,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42], // Deep Navy Charcoal / slate-900
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
        valign: 'middle'
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [51, 65, 85], // slate-700
        valign: 'top',
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 42 }, // Tanggal & Jam
        1: { cellWidth: 52 }, // Klien & PIC
        2: { cellWidth: 42 }, // Jenis Agenda
        3: { cellWidth: 70 }, // Deskripsi Alat
        4: { cellWidth: 63 }  // Tim Penugasan
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // slate-50
      },
      styles: {
        lineColor: [226, 232, 240], // slate-200
        lineWidth: 0.15
      },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184); // slate-400
        
        // Footer Left: page tracker
        const footerLeft = `RiksaSync AI - Halaman ${data.pageNumber} dari ${pageCount}`;
        doc.text(footerLeft, 14, 201);

        // Footer Right: print date
        const todayStr = new Date().toLocaleDateString('id-ID', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const footerRight = `Laporan resmi dicetak otomatis pada: ${todayStr}`;
        doc.text(footerRight, 283 - doc.getTextWidth(footerRight), 201);
      }
    });

    // Save document
    const cleanPeriodStr = periodeText.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Laporan_Jadwal_Operasional_${cleanPeriodStr}.pdf`);
  };

  // Get active schedules for selected day
  const selectedDaySchedules = getSchedulesForDay(selectedDate);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Calendar Grid - Left 8 columns */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100 text-emerald-600">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm tracking-tight">Kalender Jadwal Riksa</h3>
              <p className="text-xs text-slate-500">
                {viewMode === 'monthly' ? (
                  `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`
                ) : (
                  `Minggu dari ${formatIndonesianShortDate(weekDays[0])} s.d. ${formatIndonesianShortDate(weekDays[6])}`
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            {/* Tampilan Toggle Buttons */}
            <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('monthly')}
                className={`text-[10px] font-extrabold px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'monthly'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Tampilan Bulanan
              </button>
              <button
                type="button"
                onClick={() => setViewMode('weekly')}
                className={`text-[10px] font-extrabold px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'weekly'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Tampilan Mingguan
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleExportPDF}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg border border-emerald-700 transition-all mr-1 font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                title="Ekspor Jadwal Operasional Aktif ke PDF (Laporan Resmi Landscape)"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>Ekspor PDF</span>
              </button>
              <button
                onClick={goToToday}
                className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-all mr-1 font-bold"
              >
                Hari Ini
              </button>
              <button
                onClick={handlePrev}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all"
                title={viewMode === 'monthly' ? 'Bulan Sebelumnya' : 'Minggu Sebelumnya'}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all"
                title={viewMode === 'monthly' ? 'Bulan Berikutnya' : 'Minggu Berikutnya'}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'monthly' ? (
          <>
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
                            className="p-0.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded border border-slate-200 shadow-xs flex items-center justify-center shrink-0 transition-all active:scale-90"
                          >
                            <Plus className="h-2.5 w-2.5 font-bold" />
                          </button>
                        )}

                        {/* Total absences bubble */}
                        {absences.filter(a => a.date === dateStr).length > 0 && (
                          <span className="text-[8px] bg-rose-50 text-rose-600 px-1 py-0.5 rounded border border-rose-100 font-bold shrink-0" title="Manpower Absen">
                            🚫 {absences.filter(a => a.date === dateStr).length}
                          </span>
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
          </>
        ) : (
          /* Weekly Cards Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 min-h-[300px]">
            {weekDays.map((day, idx) => {
              const dateStr = formatDateString(day);
              const isSelected = dateStr === selectedDate;
              const isToday = formatDateString(new Date()) === dateStr;
              const daySchedules = getSchedulesForDay(dateStr);
              const dayName = indonesianDaysShort[day.getDay()];
              const dateLabel = `${day.getDate()} ${monthNames[day.getMonth()].slice(0, 3)}`;

              return (
                <div
                  key={idx}
                  onClick={() => onSelectDate(dateStr)}
                  className={`flex flex-col border rounded-xl transition-all cursor-pointer p-3 min-h-[220px] select-none hover:shadow-sm relative group/weekly ${
                    isSelected
                      ? 'bg-emerald-50/40 border-emerald-500 ring-1 ring-emerald-500/20 text-emerald-900 font-medium'
                      : isToday
                      ? 'bg-slate-100/80 border-slate-300 text-slate-900 font-medium shadow-sm'
                      : 'bg-slate-50/20 border-slate-100 text-slate-700 hover:border-slate-200 hover:bg-slate-50/60'
                  }`}
                >
                  {/* Today highlight pill */}
                  {isToday && (
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[7px] font-extrabold uppercase px-1.5 py-0.2 rounded-full tracking-wider border border-white">
                      Hari Ini
                    </span>
                  )}

                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100/80">
                    <div>
                      <h4 className={`text-xs font-black ${isToday ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {dayName}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono font-medium">{dateLabel}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {onQuickAddSchedule && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickAddSchedule(dateStr);
                          }}
                          className="p-0.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded border border-slate-200 flex items-center justify-center shrink-0 transition-all active:scale-90"
                          title="Tambah plotting cepat"
                        >
                          <Plus className="h-2.5 w-2.5 font-bold" />
                        </button>
                      )}
                      
                      {absences.filter(a => a.date === dateStr).length > 0 && (
                        <span className="text-[7px] bg-rose-50 text-rose-600 px-1 py-0.2 rounded border border-rose-100 font-bold" title="Manpower Absen">
                          🚫 {absences.filter(a => a.date === dateStr).length}
                        </span>
                      )}

                      {daySchedules.length > 0 && (
                        <span className="text-[8px] bg-slate-100 text-slate-600 px-1 rounded-full border border-slate-200/50 font-bold">
                          {daySchedules.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Agendas List */}
                  <div className="flex-1 space-y-2 overflow-y-auto max-h-[190px] pr-0.5 scrollbar-thin">
                    {daySchedules.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                        <p className="text-[9px] text-slate-400 font-sans italic">Tidak ada agenda</p>
                      </div>
                    ) : (
                      daySchedules.map((s) => {
                        const leadExpert = manpowerList.find(m => m.id === s.lead_expert_id);
                        
                        let agendaColor = 'border-emerald-200 bg-emerald-50/50 text-emerald-800';
                        if (s.agenda_type === 'Survey') {
                          agendaColor = 'border-indigo-200 bg-indigo-50/50 text-indigo-800';
                        } else if (s.agenda_type === 'Lainnya') {
                          agendaColor = 'border-slate-200 bg-slate-100/60 text-slate-700';
                        }

                        const timeText = s.is_until_finished 
                          ? 'Selesai' 
                          : (s.start_time || s.end_time) 
                          ? `${s.start_time || '--:--'}` 
                          : 'Standar';

                        return (
                          <div
                            key={s.id}
                            className={`p-2 rounded-lg border text-[9px] leading-tight space-y-1 transition-all ${agendaColor} hover:border-slate-300 hover:shadow-xs`}
                            title={`${s.client_name} - Lead: ${leadExpert?.name || 'No Lead'}`}
                          >
                            <div className="font-extrabold truncate text-slate-800">{s.client_name}</div>
                            <div className="flex items-center justify-between text-[8px] text-slate-500 font-medium">
                              <span className="font-mono">🕒 {timeText}</span>
                              <span className="truncate max-w-[65px] font-sans font-bold text-slate-600">
                                {leadExpert ? leadExpert.name.split(' ')[0] : 'None'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

          {/* Absensi Hari Ini Section */}
          {(() => {
            const selectedDayAbsences = absences.filter(a => a.date === selectedDate);
            if (selectedDayAbsences.length === 0) return null;
            return (
              <div className="mt-4 pt-4 border-t border-slate-150">
                <h4 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                  <span>Tim Tidak Hadir ({selectedDayAbsences.length})</span>
                </h4>
                <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                  {selectedDayAbsences.map(abs => {
                    const person = manpowerList.find(m => m.id === abs.manpower_id);
                    const badgeColor = abs.absence_type === 'Sakit' 
                      ? 'bg-rose-50 text-rose-700 border-rose-200/60' 
                      : abs.absence_type === 'Cuti'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200/60'
                      : 'bg-amber-50 text-amber-700 border-amber-200/60';

                    return (
                      <div key={abs.id} className={`p-2 rounded-xl border flex items-center justify-between text-xs font-semibold ${badgeColor}`}>
                        <span className="font-bold truncate max-w-[120px]">{person?.name || 'Unknown'}</span>
                        <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                          <span className="uppercase tracking-wider font-extrabold text-[8px] px-1 py-0.2 bg-white/70 rounded-md border border-inherit">
                            {abs.absence_type}
                          </span>
                          {abs.reason && (
                            <span className="text-slate-500 font-medium italic truncate max-w-[100px]" title={abs.reason}>
                              "{abs.reason}"
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
