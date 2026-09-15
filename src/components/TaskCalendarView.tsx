import React, { useState, useMemo } from 'react';
import { TeamTask, Manpower } from '../types';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Plus, Clock, User, AlertTriangle, CheckCircle2, MessageSquare, Send 
} from 'lucide-react';
import { TASK_CATEGORIES, getDeadlineCountdown, formatIndonesianDateWithDay } from './TaskBoard';

interface TaskCalendarViewProps {
  tasks: TeamTask[];
  manpowerList: Manpower[];
  onSelectTask: (task: TeamTask) => void;
  onAddTaskOnDate: (dateStr: string) => void;
  onSendWhatsappReminder: (task: TeamTask) => void;
}

export default function TaskCalendarView({
  tasks,
  manpowerList,
  onSelectTask,
  onAddTaskOnDate,
  onSendWhatsappReminder
}: TaskCalendarViewProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0 - 11

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  // Build calendar matrix (Monday-based)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Day of week: 0 (Sun) to 6 (Sat). We want Monday (1) as 0, Sunday (0) as 6
    let startingDay = firstDayOfMonth.getDay() - 1;
    if (startingDay === -1) startingDay = 6;

    const daysInMonth = lastDayOfMonth.getDate();

    // Previous month padding
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    for (let i = startingDay - 1; i >= 0; i--) {
      const pDay = prevMonthLastDay - i;
      const m = currentMonth === 0 ? 12 : currentMonth;
      const y = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: pDay, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: i, isCurrentMonth: true });
    }

    // Next month padding to fill complete grid of 35 or 42
    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const m = currentMonth === 11 ? 1 : currentMonth + 2;
      const y = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: i, isCurrentMonth: false });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Index tasks by due_date
  const tasksByDate = useMemo(() => {
    const map: Record<string, TeamTask[]> = {};
    tasks.forEach(task => {
      if (!map[task.due_date]) {
        map[task.due_date] = [];
      }
      map[task.due_date].push(task);
    });
    return map;
  }, [tasks]);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const priorityBadgeClasses: Record<string, string> = {
    'P1': 'bg-rose-500 text-white',
    'P2': 'bg-amber-500 text-white',
    'P3': 'bg-emerald-500 text-white'
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-4 sm:p-5 overflow-y-auto">
      {/* Calendar Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              {monthNames[currentMonth]} {currentYear}
            </h3>
            <p className="text-xs text-slate-500">
              Kalender khusus deadline & notulensi tugas tim RiksaSync
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition-all"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1 text-xs font-bold text-slate-700 hover:bg-white rounded-lg transition-all"
            >
              Bulan Ini
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition-all"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => onAddTaskOnDate(todayStr)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Tugas Baru</span>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col flex-1">
        {/* Day of week headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-extrabold text-slate-500 py-2.5">
          {daysOfWeek.map((day, idx) => (
            <div key={day} className={idx >= 5 ? 'text-rose-500' : ''}>
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 auto-rows-fr flex-1 divide-x divide-y divide-slate-100 min-h-[580px]">
          {calendarDays.map((cell, idx) => {
            const dateTasks = tasksByDate[cell.dateStr] || [];
            const isToday = cell.dateStr === todayStr;

            return (
              <div
                key={cell.dateStr + '-' + idx}
                className={`min-h-[110px] p-2 flex flex-col transition-colors group relative ${
                  cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/40 text-slate-300'
                } hover:bg-indigo-50/20`}
              >
                {/* Cell Header */}
                <div className="flex justify-between items-center mb-1.5">
                  <span
                    className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                      isToday
                        ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                        : cell.isCurrentMonth
                        ? 'text-slate-700'
                        : 'text-slate-300'
                    }`}
                  >
                    {cell.dayNum}
                  </span>

                  {/* Add Task on this day button on hover */}
                  <button
                    onClick={() => onAddTaskOnDate(cell.dateStr)}
                    className="opacity-0 group-hover:opacity-100 text-indigo-600 hover:bg-indigo-50 p-1 rounded-md transition-all text-[10px] font-bold flex items-center gap-0.5"
                    title={`Tambah tugas untuk ${cell.dateStr}`}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                {/* Task Chips on this day */}
                <div className="flex-1 space-y-1 overflow-y-auto max-h-[100px] hide-scrollbar">
                  {dateTasks.map(task => {
                    const deadlineInfo = getDeadlineCountdown(task.due_date, task.due_time, task.status);
                    const categoryObj = TASK_CATEGORIES.find(c => c.id === task.category);
                    const isDone = task.status === 'Done';
                    const isCancelled = task.status === 'Cancelled';

                    return (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask(task)}
                        className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer group/task flex flex-col gap-0.5 shadow-2xs ${
                          isDone
                            ? 'bg-emerald-50/80 border-emerald-200 opacity-70 hover:opacity-100'
                            : isCancelled
                            ? 'bg-slate-100 border-slate-200 opacity-50'
                            : deadlineInfo.type === 'overdue'
                            ? 'bg-rose-50 border-rose-300 hover:border-rose-400'
                            : deadlineInfo.type === 'urgent'
                            ? 'bg-amber-50 border-amber-300 hover:border-amber-400'
                            : 'bg-white border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-[10px]">{categoryObj?.icon || '📌'}</span>
                            <span className={`text-[9px] font-extrabold px-1 rounded ${priorityBadgeClasses[task.priority] || 'bg-slate-500 text-white'}`}>
                              {task.priority}
                            </span>
                          </div>

                          {/* Quick WA Reminder Button on task chip */}
                          {!isDone && !isCancelled && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSendWhatsappReminder(task);
                              }}
                              className="opacity-0 group-hover/task:opacity-100 hover:bg-emerald-100 text-emerald-700 p-0.5 rounded transition-all shrink-0"
                              title="Kirim pengingat WhatsApp"
                            >
                              <Send className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>

                        <div className={`text-[11px] font-bold line-clamp-1 leading-tight ${isDone ? 'line-through text-slate-400' : 'text-slate-800 group-hover/task:text-indigo-600'}`}>
                          {task.title}
                        </div>

                        {task.due_time && (
                          <div className="text-[9px] text-slate-400 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            <span>{task.due_time} WIB</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend & Instructions */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-bold text-slate-700">Keterangan:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>P1 (Mendesak)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>P2 (Sedang)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>P3 (Rendah)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-200 border border-rose-400" />
            <span>Terlewat (Overdue)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-200 border border-amber-400" />
            <span>Deadline Hari Ini</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 italic">
          💡 Tips: Klik tanggal untuk langsung membuat tugas pada hari tersebut.
        </div>
      </div>
    </div>
  );
}
