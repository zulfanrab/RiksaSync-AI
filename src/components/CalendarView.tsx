/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Award, 
  Users, 
  Tag, 
  AlertCircle, 
  Plus, 
  FileDown, 
  PanelRightClose, 
  PanelRightOpen, 
  X, 
  Clock, 
  Edit, 
  Trash2, 
  ExternalLink, 
  Eye 
} from 'lucide-react';
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
  scheduleFiles?: any[];
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
  onQuickAddSchedule,
  scheduleFiles = []
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly'>('monthly');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [activeModalDate, setActiveModalDate] = useState<string | null>(null);

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

  const formatIndonesianFullDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const daysList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthsFull = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${daysList[dateObj.getDay()]}, ${d} ${monthsFull[m - 1]} ${y}`;
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
      let dateCell = `${s.start_date}`;
      if (s.end_date !== s.start_date) {
        dateCell += ` s/d ${s.end_date}`;
      }
      const timeStr = s.is_until_finished 
        ? '\nSampai Selesai' 
        : (s.start_time || s.end_time) 
        ? `\n${s.start_time || '--:--'} - ${s.end_time || '--:--'}` 
        : '';
      dateCell += timeStr;

      const clientCell = `${s.client_name}\nPIC: ${s.pic_name || 'No PIC'}\nPriority: ${s.priority}`;
      let agendaCell = s.agenda_type === 'Survey' ? 'Survey' : s.agenda_type === 'Lainnya' ? (s.manual_agenda || 'Lainnya') : 'Riksa Uji';

      const matchedUnits = s.unit_ids
        .map(uid => units.find(u => u.id === uid)?.unit_name)
        .filter(Boolean)
        .join(', ');
      
      let unitCell = matchedUnits || 'Tanpa Unit';
      if (s.unit_descriptions && s.unit_descriptions.length > 0) {
        unitCell += `\nDetail: ${s.unit_descriptions.join(', ')}`;
      }

      const leadExpert = manpowerList.find(m => m.id === s.lead_expert_id)?.name || 'Unknown Lead';
      const supportTeam = s.support_ids
        .map(sid => manpowerList.find(m => m.id === sid)?.name)
        .filter(Boolean)
        .join(', ');

      const teamCell = `Lead: ${leadExpert}` + (supportTeam ? `\nSupport: ${supportTeam}` : '');

      return [dateCell, clientCell, agendaCell, unitCell, teamCell];
    });

    // 4. Generate AutoTable
    autoTable(doc, {
      startY: 44,
      head: headers,
      body: tableRows,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
      },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: 'bold' },
        1: { cellWidth: 55 },
        2: { cellWidth: 32 },
        3: { cellWidth: 78 },
        4: { cellWidth: 62 },
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);

        const footerLeft = `Halaman ${data.pageNumber} dari ${pageCount}`;
        doc.text(footerLeft, 14, 201);

        const today = new Date();
        const todayStr = `${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()} ${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
        const footerRight = `Laporan resmi dicetak otomatis pada: ${todayStr}`;
        doc.text(footerRight, 283 - doc.getTextWidth(footerRight), 201);
      }
    });

    const cleanPeriodStr = periodeText.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Laporan_Jadwal_Operasional_${cleanPeriodStr}.pdf`);
  };

  // Get active schedules for selected day
  const selectedDaySchedules = getSchedulesForDay(selectedDate);
  const maxBadgesShown = isSidebarOpen ? 2 : 4;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 relative">
      {/* Calendar Grid - Expand to 12 columns when Sidebar is closed */}
      <div className={`${isSidebarOpen ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm transition-all duration-300`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 mb-3 sm:mb-5">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-50 p-1.5 sm:p-2 rounded-lg border border-emerald-100 text-emerald-600 shrink-0">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs sm:text-sm tracking-tight flex items-center gap-2">
                <span>Kalender Jadwal Riksa</span>
                {!isSidebarOpen && (
                  <span className="hidden sm:inline-block text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-extrabold uppercase border border-emerald-200">
                    Mode Fullscreen / TV
                  </span>
                )}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                {viewMode === 'monthly' ? (
                  `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`
                ) : (
                  `Minggu: ${formatIndonesianShortDate(weekDays[0])} - ${formatIndonesianShortDate(weekDays[6])}`
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-between sm:justify-start">
            {/* Toggle Sidebar Button (Desktop only) */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`hidden lg:flex text-[10px] sm:text-xs px-2.5 py-1.5 rounded-lg border font-bold items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                isSidebarOpen
                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 ring-2 ring-emerald-500/20'
              }`}
              title={isSidebarOpen ? 'Sembunyikan Sidebar Riksa Aktif' : 'Tampilkan Sidebar Riksa Aktif'}
            >
              {isSidebarOpen ? (
                <>
                  <PanelRightClose className="h-3.5 w-3.5 text-slate-600" />
                  <span>Sembunyikan Sidebar</span>
                </>
              ) : (
                <>
                  <PanelRightOpen className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Tampilkan Sidebar</span>
                </>
              )}
            </button>

            {/* Tampilan Toggle Buttons */}
            <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('monthly')}
                className={`text-[10px] sm:text-xs font-extrabold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'monthly'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Bulanan
              </button>
              <button
                type="button"
                onClick={() => setViewMode('weekly')}
                className={`text-[10px] sm:text-xs font-extrabold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'weekly'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Mingguan
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 justify-end shrink-0">
              <button
                onClick={handleExportPDF}
                className="text-[10px] sm:text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border border-emerald-700 transition-all font-bold flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                title="Ekspor Jadwal Operasional Aktif ke PDF"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>PDF</span>
              </button>
              <button
                onClick={goToToday}
                className="text-[10px] sm:text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 transition-all font-bold cursor-pointer"
              >
                Hari Ini
              </button>
              <button
                onClick={handlePrev}
                className="p-1 sm:p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all cursor-pointer"
                title={viewMode === 'monthly' ? 'Bulan Sebelumnya' : 'Minggu Sebelumnya'}
              >
                <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                onClick={handleNext}
                className="p-1 sm:p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all cursor-pointer"
                title={viewMode === 'monthly' ? 'Bulan Berikutnya' : 'Minggu Berikutnya'}
              >
                <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'monthly' ? (
          <>
            {/* Day labels */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5 text-center">
              {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d, idx) => (
                <span key={d} className={`text-[9px] sm:text-xs font-extrabold uppercase tracking-wider py-1 ${idx === 0 || idx === 6 ? 'text-slate-400' : 'text-slate-500'}`}>
                  {d}
                </span>
              ))}
            </div>

            {/* Calendar days grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {days.map((day, idx) => {
                const dateStr = formatDateString(day);
                const isSelected = dateStr === selectedDate;
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isToday = formatDateString(new Date()) === dateStr;
                const daySchedules = getSchedulesForDay(dateStr);
                const dayAbsences = absences.filter(a => a.date === dateStr);

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      onSelectDate(dateStr);
                      // Tapping a date with schedules on mobile automatically opens the Date Detail Modal!
                      if (daySchedules.length > 0 && window.innerWidth < 640) {
                        setActiveModalDate(dateStr);
                      }
                    }}
                    className={`p-1 sm:p-2 rounded-lg sm:rounded-xl border cursor-pointer flex flex-col justify-between transition-all group/cell relative ${
                      isSidebarOpen ? 'min-h-[54px] sm:min-h-[76px]' : 'min-h-[72px] sm:min-h-[110px] md:min-h-[130px]'
                    } ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 text-emerald-900 font-bold ring-2 ring-emerald-500/20 shadow-xs'
                        : isToday
                        ? 'bg-slate-100 border-slate-300 text-slate-900 font-bold shadow-xs'
                        : isCurrentMonth
                        ? 'bg-slate-50/20 border-slate-150 text-slate-700 hover:border-emerald-300 hover:bg-slate-50/80 hover:shadow-xs'
                        : 'bg-slate-50/10 border-transparent text-slate-300 hover:text-slate-400'
                    }`}
                  >
                    {/* Date Header */}
                    <div className="flex justify-between items-center w-full pb-0.5 sm:pb-1">
                      <span className={`text-[10px] sm:text-xs font-black ${isToday && !isSelected ? 'text-emerald-600 font-bold' : ''}`}>
                        {day.getDate()}
                      </span>
                      
                      {/* Desktop Cell Actions & Badges (Hidden on mobile to prevent overlapping) */}
                      <div className="hidden sm:flex items-center gap-1">
                        {daySchedules.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectDate(dateStr);
                              setActiveModalDate(dateStr);
                            }}
                            title="Buka rincian lengkap tanggal ini"
                            className="p-0.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-100/80 rounded border border-slate-200/80 shadow-2xs flex items-center justify-center shrink-0 transition-all active:scale-90"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                        )}

                        {onQuickAddSchedule && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onQuickAddSchedule(dateStr);
                            }}
                            title={`Tambah plotting cepat untuk tanggal ${dateStr}`}
                            className="p-0.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded border border-slate-200 shadow-xs flex items-center justify-center shrink-0 transition-all active:scale-90"
                          >
                            <Plus className="h-2.5 w-2.5 font-bold" />
                          </button>
                        )}

                        {dayAbsences.length > 0 && (
                          <span className="text-[8px] bg-rose-50 text-rose-600 px-1 py-0.5 rounded border border-rose-100 font-bold shrink-0" title="Manpower Absen">
                            🚫 {dayAbsences.length}
                          </span>
                        )}

                        {daySchedules.length > 0 && (
                          <span className="text-[8px] sm:text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full border border-slate-200 font-extrabold shrink-0">
                            {daySchedules.length}
                          </span>
                        )}
                      </div>

                      {/* Mobile Cell Badge (Clean, non-clashing) */}
                      <div className="flex sm:hidden items-center gap-0.5 shrink-0">
                        {dayAbsences.length > 0 && (
                          <span className="text-[8px] leading-none text-rose-600 font-bold" title="Manpower Absen">
                            🚫
                          </span>
                        )}
                        {daySchedules.length > 0 && (
                          <span className="text-[8px] leading-none bg-emerald-600 text-white font-extrabold px-1.5 py-0.2 rounded-full">
                            {daySchedules.length}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Schedule Indicators */}
                    <div className="space-y-1 mt-0.5 flex-1 flex flex-col justify-start">
                      {/* For Mobile: clean priority dots */}
                      <div className="flex flex-wrap gap-0.5 justify-center sm:hidden">
                        {daySchedules.map((s) => (
                          <span
                            key={s.id}
                            className={`w-1.5 h-1.5 rounded-full ${getPriorityDot(s.priority)}`}
                            title={`${s.client_name} (${s.priority})`}
                          />
                        ))}
                      </div>

                      {/* For Desktop: full text badges */}
                      <div className="hidden sm:flex flex-col space-y-1">
                        {daySchedules.slice(0, maxBadgesShown).map((s) => {
                          const iconPrefix = s.agenda_type === 'Survey' ? '🔍' : s.agenda_type === 'Lainnya' ? '⚙️' : '⚡';
                          const timeDisplay = s.start_time ? ` (${s.start_time})` : '';

                          return (
                            <div
                              key={s.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectDate(dateStr);
                                setActiveModalDate(dateStr);
                              }}
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border truncate flex items-center justify-between gap-1 transition-all hover:scale-[1.01] hover:shadow-2xs cursor-pointer ${getPriorityColor(s.priority)}`}
                              title={`${s.client_name} - Klik untuk rincian lengkap`}
                            >
                              <span className="truncate">
                                {iconPrefix} {s.client_name}
                              </span>
                              {!isSidebarOpen && (
                                <span className="text-[7.5px] opacity-80 font-mono shrink-0">
                                  {timeDisplay || s.priority}
                                </span>
                              )}
                            </div>
                          );
                        })}

                        {/* Interactive "+N lagi" indicator badge */}
                        {daySchedules.length > maxBadgesShown && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectDate(dateStr);
                              setActiveModalDate(dateStr);
                            }}
                            className="w-full text-[8.5px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-center py-0.5 rounded-md border border-emerald-200 transition-all cursor-pointer shadow-2xs hover:scale-[1.01] mt-0.5"
                            title="Klik untuk melihat rincian seluruh kegiatan pada tanggal ini"
                          >
                            +{daySchedules.length - maxBadgesShown} lagi (Lihat Rincian)
                          </button>
                        )}
                      </div>
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
                  onClick={() => {
                    onSelectDate(dateStr);
                    if (daySchedules.length > 0 && window.innerWidth < 640) {
                      setActiveModalDate(dateStr);
                    }
                  }}
                  className={`flex flex-col border rounded-xl transition-all cursor-pointer p-3 min-h-[200px] sm:min-h-[220px] select-none hover:shadow-sm relative group/weekly ${
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
                      {daySchedules.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDate(dateStr);
                            setActiveModalDate(dateStr);
                          }}
                          className="p-0.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded border border-slate-200 flex items-center justify-center shrink-0 transition-all active:scale-90"
                          title="Buka rincian lengkap tanggal ini"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                      )}

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
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectDate(dateStr);
                              setActiveModalDate(dateStr);
                            }}
                            className={`p-2 rounded-lg border text-[9px] leading-tight space-y-1 transition-all ${agendaColor} hover:border-slate-300 hover:shadow-xs cursor-pointer`}
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

      {/* Selected Day Projects List - Right 4 columns (Collapsible) */}
      <div className={`${isSidebarOpen ? 'lg:col-span-4 flex flex-col gap-4' : 'hidden'} transition-all duration-300`}>
        <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm flex-1 flex flex-col">
          <div className="mb-3 sm:mb-4 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-800 text-xs tracking-wider uppercase">Daftar Riksa Aktif</h4>
              <p className="text-[11px] text-slate-500">Inspeksi untuk tanggal <span className="text-emerald-600 font-mono font-semibold">{selectedDate}</span></p>
            </div>
            <button
              onClick={() => setActiveModalDate(selectedDate)}
              className="text-[9px] bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition-all"
              title="Buka rincian dalam kotak baru"
            >
              <Eye className="h-3 w-3" />
              <span>Modal</span>
            </button>
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

                      {/* Google Drive Linked Files */}
                      {(() => {
                        const files = (scheduleFiles || []).filter(f => f.schedule_id === s.id);
                        if (files.length === 0) return null;
                        return (
                          <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                            <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block">Dokumen Google Drive:</span>
                            <div className="grid grid-cols-1 gap-1">
                              {files.map(file => (
                                <a
                                  key={file.id}
                                  href={file.google_drive_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 p-1 bg-emerald-50/50 hover:bg-emerald-100/50 text-[10px] text-emerald-800 font-semibold border border-emerald-100 rounded-lg truncate transition-all active:scale-95"
                                  title={`${file.file_name} (${file.category})`}
                                >
                                  <span className="shrink-0 text-xs">📁</span>
                                  <span className="truncate flex-1 text-[9px]">{file.file_name}</span>
                                  <span className="text-[7px] bg-emerald-100 text-emerald-800 px-1 rounded uppercase font-bold shrink-0">{file.category}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

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
                          className="text-[9px] font-bold text-slate-600 hover:text-amber-700 bg-slate-50 px-2 py-1 rounded border border-slate-200 transition-all cursor-pointer"
                        >
                          Ubah
                        </button>
                        <button
                          onClick={() => onDeleteSchedule(s.id)}
                          className="text-[9px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded border border-rose-200 transition-all cursor-pointer"
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

      {/* Interactive Date Detail Modal Popup ("Kotak Baru") */}
      {activeModalDate && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 transition-all duration-200 animate-in fade-in"
          onClick={() => setActiveModalDate(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-3.5 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 bg-emerald-100/80 text-emerald-700 rounded-xl border border-emerald-200/80 shrink-0">
                  <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-xs sm:text-base tracking-tight flex items-center gap-2">
                    <span>Rincian Agenda Operasional</span>
                    <span className="text-[10px] bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                      {getSchedulesForDay(activeModalDate).length} Agenda
                    </span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                    {formatIndonesianFullDate(activeModalDate)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveModalDate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
                title="Tutup Modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 space-y-3.5 sm:space-y-4 max-h-[65vh]">
              {/* Schedules List for Active Modal Date */}
              {(() => {
                const daySchedules = getSchedulesForDay(activeModalDate);
                if (daySchedules.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-200 border-dashed">
                      <AlertCircle className="h-10 w-10 text-slate-400 mb-3" />
                      <h4 className="font-bold text-slate-700 text-sm">Tidak ada agenda kegiatan</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">
                        Tidak ada inspeksi atau survey yang dijadwalkan pada {formatIndonesianFullDate(activeModalDate)}.
                      </p>
                    </div>
                  );
                }

                return daySchedules.map((s) => {
                  const leadExpertName = manpowerList.find(m => m.id === s.lead_expert_id)?.name || 'Belum Ditentukan';
                  const supportNames = s.support_ids
                    .map(sid => manpowerList.find(m => m.id === sid)?.name)
                    .filter(Boolean)
                    .join(', ') || 'Tidak ada support';

                  const matchedUnits = s.unit_ids
                    .map(uid => units.find(u => u.id === uid)?.unit_name)
                    .filter(Boolean)
                    .join(' & ');

                  return (
                    <div
                      key={s.id}
                      className="p-3 sm:p-4 bg-slate-50/60 rounded-2xl border border-slate-200/80 hover:border-slate-300 transition-all space-y-3 relative shadow-2xs"
                    >
                      {/* Left Accent Priority Strip */}
                      <div className={`absolute top-0 bottom-0 left-0 w-1.5 rounded-l-2xl ${getPriorityDot(s.priority)}`} />

                      <div className="pl-1.5 sm:pl-2">
                        {/* Top Bar: Title & Priority Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-xs sm:text-base leading-tight">
                              {s.client_name}
                            </h4>
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                              {s.agenda_type === 'Survey' ? (
                                <span className="text-[8.5px] sm:text-[9px] font-extrabold uppercase bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded-md">
                                  🔍 Survey
                                </span>
                              ) : s.agenda_type === 'Lainnya' ? (
                                <span className="text-[8.5px] sm:text-[9px] font-extrabold uppercase bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md" title={s.manual_agenda || 'Kegiatan Lainnya'}>
                                  ⚙️ {s.manual_agenda || 'Lainnya'}
                                </span>
                              ) : (
                                <span className="text-[8.5px] sm:text-[9px] font-extrabold uppercase bg-emerald-50 border border-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded-md">
                                  ⚡ Riksa Uji
                                </span>
                              )}

                              {s.is_until_finished && (
                                <span className="text-[8.5px] sm:text-[9px] font-extrabold uppercase bg-rose-50 border border-rose-200 text-rose-700 px-1.5 py-0.5 rounded-md">
                                  🔄 Sampai Selesainya
                                </span>
                              )}
                            </div>
                          </div>

                          <span className={`text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-lg border shrink-0 ${getPriorityColor(s.priority)}`}>
                            Prioritas {s.priority}
                          </span>
                        </div>

                        {/* Meta details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5 text-xs text-slate-600 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-150">
                          <div className="flex items-center gap-2">
                            <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span><strong className="text-slate-700">PIC Klien:</strong> {s.pic_name || 'Tanpa PIC'}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>
                              <strong className="text-slate-700">Jam Operasional:</strong>{' '}
                              {s.is_until_finished ? 'Sampai Selesai' : (s.start_time || s.end_time) ? `${s.start_time || '--:--'} - ${s.end_time || '--:--'}` : 'Standar'}
                            </span>
                          </div>
                        </div>

                        {/* Units Section */}
                        <div className="mt-2 text-xs bg-emerald-50/70 p-2 sm:p-2.5 rounded-xl border border-emerald-200/80 text-emerald-900 flex items-start gap-2">
                          <Award className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-bold block">Unit Alat Riksa:</span>
                            <span className="font-semibold text-emerald-800">{matchedUnits || 'Tidak ada unit dipilih'}</span>
                          </div>
                        </div>

                        {/* Unit Descriptions */}
                        {s.unit_descriptions && s.unit_descriptions.length > 0 && (
                          <div className="mt-2 p-2 sm:p-2.5 bg-slate-50 border border-slate-200/60 rounded-xl text-xs space-y-1">
                            <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] block">Rincian Deskripsi Unit:</span>
                            <ul className="list-disc list-inside space-y-0.5">
                              {s.unit_descriptions.map((desc, dIdx) => (
                                <li key={dIdx} className="text-slate-700 font-medium">
                                  {desc}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Team Section */}
                        <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-150">
                            <Users className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <div className="truncate">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Lead Expert</span>
                              <span className="font-extrabold text-slate-800 truncate block">{leadExpertName}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-150">
                            <Users className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            <div className="truncate">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Support Manpower</span>
                              <span className="font-semibold text-slate-700 truncate block">{supportNames}</span>
                            </div>
                          </div>
                        </div>

                        {/* Google Drive Attachments */}
                        {(() => {
                          const files = (scheduleFiles || []).filter(f => f.schedule_id === s.id);
                          if (files.length === 0) return null;
                          return (
                            <div className="mt-2.5 pt-2 border-t border-slate-200/60 space-y-1.5">
                              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Dokumen Google Drive Terlampir:</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {files.map(file => (
                                  <a
                                    key={file.id}
                                    href={file.google_drive_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2 bg-emerald-50/80 hover:bg-emerald-100 text-xs text-emerald-900 font-semibold border border-emerald-200 rounded-xl transition-all cursor-pointer truncate active:scale-95"
                                  >
                                    <span className="shrink-0">📁</span>
                                    <span className="truncate flex-1 font-bold">{file.file_name}</span>
                                    <ExternalLink className="h-3 w-3 text-emerald-700 shrink-0" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Log signature */}
                        {(s.created_by || s.updated_by) && (
                          <div className="mt-2.5 text-[10px] text-slate-400 italic flex flex-wrap justify-between items-center gap-1.5 border-t border-slate-100 pt-2">
                            {s.created_by && (
                              <span>Dibuat oleh: <strong className="text-slate-600">{s.created_by}</strong></span>
                            )}
                            {s.updated_by && (
                              <span>Terakhir diedit: <strong className="text-slate-600">{s.updated_by}</strong></span>
                            )}
                          </div>
                        )}

                        {/* Action buttons inside Modal */}
                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setActiveModalDate(null);
                              onEditSchedule(s);
                            }}
                            className="text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>Ubah Jadwal</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveModalDate(null);
                              onDeleteSchedule(s.id);
                            }}
                            className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}

              {/* Absences Section inside Modal */}
              {(() => {
                const dayAbsences = absences.filter(a => a.date === activeModalDate);
                if (dayAbsences.length === 0) return null;

                return (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2 mb-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                      <span>Tim Manpower Tidak Hadir ({dayAbsences.length})</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {dayAbsences.map(abs => {
                        const person = manpowerList.find(m => m.id === abs.manpower_id);
                        const badgeColor = abs.absence_type === 'Sakit' 
                          ? 'bg-rose-50 text-rose-800 border-rose-200' 
                          : abs.absence_type === 'Cuti'
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200';

                        return (
                          <div key={abs.id} className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold ${badgeColor}`}>
                            <span className="truncate">{person?.name || 'Unknown'}</span>
                            <span className="uppercase text-[9px] px-1.5 py-0.5 bg-white/80 rounded-md border border-inherit shrink-0">
                              {abs.absence_type}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2.5">
              {onQuickAddSchedule ? (
                <button
                  onClick={() => {
                    const targetDate = activeModalDate;
                    setActiveModalDate(null);
                    onQuickAddSchedule(targetDate);
                  }}
                  className="text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-xl border border-emerald-700 transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer truncate"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="truncate">Tambah Plotting Tanggal Ini</span>
                </button>
              ) : <div />}

              <button
                onClick={() => setActiveModalDate(null)}
                className="text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-2xs shrink-0"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
