import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TeamTask, Manpower, QuickLink, TaskCategory } from '../types';
import { 
  Plus, Clock, User, Users, AlertCircle, AlertTriangle, CheckCircle2, 
  ChevronRight, X, Loader, Trash2, Calendar, FileText, Link as LinkIcon, 
  ExternalLink, Archive, LayoutDashboard, Search, Bold, List, 
  ListOrdered, CheckSquare, Sparkles, Filter 
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TaskBoardProps {
  tasks: TeamTask[];
  quickLinks: QuickLink[];
  manpowerList: Manpower[];
  activeUser: string | null;
  onRefreshAll: () => Promise<void>;
}

export const TASK_CATEGORIES: { id: TaskCategory; label: string; icon: string; badgeColor: string }[] = [
  { id: 'Notulensi', label: 'Notulensi', icon: '📝', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'Laporan Bulanan', label: 'Laporan Bulanan', icon: '📊', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'Buat Surat', label: 'Buat Surat / Admin', icon: '✉️', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'Ketemu Klien', label: 'Ketemu Klien / Meeting', icon: '🤝', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'Riksa Uji', label: 'Riksa Uji / Lapangan', icon: '🔍', badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { id: 'Survey', label: 'Survey & Observasi', icon: '📍', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'Follow-up', label: 'Follow-up / Penagihan', icon: '📞', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'Lainnya', label: 'Lainnya', icon: '📌', badgeColor: 'bg-slate-50 text-slate-700 border-slate-200' },
];

export function formatIndonesianDateWithDay(dateStr: string, timeStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dayName = d.toLocaleDateString('id-ID', { weekday: 'long' });
    const formattedDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${dayName}, ${formattedDate}${timeStr ? ` • ${timeStr} WIB` : ''}`;
  } catch (e) {
    return dateStr;
  }
}

export function formatCreatedInfo(createdDateStr?: string, createdBy?: string | null): string {
  if (!createdDateStr) return createdBy ? `Oleh ${createdBy}` : 'Oleh Sistem';
  try {
    const d = new Date(createdDateStr);
    const dayName = d.toLocaleDateString('id-ID', { weekday: 'long' });
    const dateFormatted = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeFormatted = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `Diposting: ${dayName}, ${dateFormatted} • ${timeFormatted} WIB${createdBy ? ` oleh ${createdBy}` : ''}`;
  } catch (e) {
    return createdBy ? `Oleh: ${createdBy}` : 'Sistem';
  }
}

export function getDeadlineCountdown(dueDate: string, dueTime?: string | null, status?: string) {
  if (status === 'Done') {
    return {
      text: 'Selesai',
      type: 'done',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold',
      timeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: 'check'
    };
  }
  if (status === 'Cancelled') {
    return {
      text: 'Dibatalkan',
      type: 'cancelled',
      badgeClass: 'bg-slate-100 text-slate-500 border-slate-200 font-semibold',
      timeClass: 'text-slate-500 bg-slate-100 border-slate-200',
      icon: 'cancelled'
    };
  }

  const now = new Date();
  const [year, month, day] = dueDate.split('-').map(Number);
  let hours = 23, minutes = 59;
  if (dueTime) {
    const [h, m] = dueTime.split(':').map(Number);
    if (!isNaN(h)) hours = h;
    if (!isNaN(m)) minutes = m;
  }
  const target = new Date(year, month - 1, day, hours, minutes, 0);
  const diffMs = target.getTime() - now.getTime();

  if (diffMs < 0) {
    // Overdue / Terlewat
    const diffHours = Math.abs(Math.floor(diffMs / (1000 * 60 * 60)));
    const diffDays = Math.floor(diffHours / 24);
    const text = diffDays >= 1 ? `Terlewat ${diffDays} hari!` : diffHours >= 1 ? `Terlewat ${diffHours} jam!` : `Baru saja terlewat!`;
    return {
      text,
      type: 'overdue',
      badgeClass: 'bg-rose-600 text-white font-extrabold animate-pulse shadow-xs',
      timeClass: 'text-rose-700 bg-rose-50 border-rose-300 font-bold',
      icon: 'alert'
    };
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // < 24 jam -> Mendesak (Amber/Orange)
  if (diffHours < 24) {
    const remMinutes = diffMinutes % 60;
    const text = diffHours > 0 ? `Tersisa ${diffHours} jam ${remMinutes}m` : `Tersisa ${remMinutes} menit!`;
    return {
      text,
      type: 'urgent',
      badgeClass: 'bg-amber-500 text-white font-bold shadow-xs',
      timeClass: 'text-amber-800 bg-amber-50 border-amber-300 font-bold',
      icon: 'urgent'
    };
  }

  // 1 - 2 hari -> Mendekati (Kuning/Amber soft)
  if (diffDays <= 2) {
    return {
      text: `${diffDays} hari lagi`,
      type: 'warning',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
      timeClass: 'text-amber-700 bg-amber-50 border-amber-200 font-semibold',
      icon: 'clock'
    };
  }

  // > 2 hari -> Aman (Netral / Hijau soft)
  return {
    text: `${diffDays} hari lagi`,
    type: 'normal',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 font-medium',
    timeClass: 'text-slate-600 bg-slate-100/80 border-slate-200',
    icon: 'calendar'
  };
}

export default function TaskBoard({ tasks, quickLinks, manpowerList, activeUser, onRefreshAll }: TaskBoardProps) {
  const [activeTab, setActiveTab] = useState<'board' | 'archive'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  
  // Task Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Task Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<'P1' | 'P2' | 'P3'>('P2');
  const [category, setCategory] = useState<TaskCategory>('Notulensi');
  const [recurrence, setRecurrence] = useState<'None' | 'Daily' | 'Weekly' | 'Monthly'>('None');
  const [visibility, setVisibility] = useState<'Public' | 'Private'>('Public');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Quick Link Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkEmoji, setLinkEmoji] = useState('🔗');

  const openNewTaskModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setAssigneeIds(manpowerList[0]?.id ? [manpowerList[0].id] : []);
    setDueDate(new Date().toISOString().split('T')[0]);
    setDueTime('');
    setPriority('P2');
    setCategory('Notulensi');
    setRecurrence('None');
    setVisibility('Public');
    setIsModalOpen(true);
  };

  const openEditTaskModal = (task: TeamTask) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    
    // Support multi-assignee fallback
    const loadedAssignees = task.assignee_ids && task.assignee_ids.length > 0 
      ? task.assignee_ids 
      : (task.assignee_id ? [task.assignee_id] : []);
    setAssigneeIds(loadedAssignees);

    setDueDate(task.due_date);
    setDueTime(task.due_time || '');
    setPriority(task.priority);
    setCategory((task.category as TaskCategory) || 'Lainnya');
    setRecurrence(task.recurrence || 'None');
    setVisibility(task.visibility || 'Public');
    setIsModalOpen(true);
  };

  // Helper formatting for Word/Docs toolbar in description
  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = description.substring(start, end);
    
    if (prefix === '• ' || prefix === '1. ' || prefix === '☐ ') {
      if (selectedText.length > 0) {
        const lines = selectedText.split('\n');
        const formatted = lines.map((line, idx) => {
          const p = prefix === '1. ' ? `${idx + 1}. ` : prefix;
          return `${p}${line.replace(/^([•☐\-]|\d+\.)\s*/, '')}`;
        }).join('\n');
        const newVal = description.substring(0, start) + formatted + description.substring(end);
        setDescription(newVal);
      } else {
        const newVal = description.substring(0, start) + prefix + description.substring(end);
        setDescription(newVal);
      }
    } else {
      const newVal = description.substring(0, start) + prefix + (selectedText || 'teks penting') + suffix + description.substring(end);
      setDescription(newVal);
    }
    setTimeout(() => {
      textarea.focus();
    }, 50);
  };

  const insertTemplate = (type: 'notulensi' | 'instruksi') => {
    let templateText = '';
    if (type === 'notulensi') {
      templateText = `📌 Topik / Agenda:\n• \n\n💬 Hasil Pembahasan:\n• \n\n✅ Tindak Lanjut (Action Items):\n1. `;
    } else {
      templateText = `🎯 Tujuan Tugas:\n• \n\n📋 Langkah Kerja:\n1. \n2. \n3. \n\n📎 Berkas / Output yang Diharapkan:\n• `;
    }
    setDescription(prev => prev ? `${prev}\n\n${templateText}` : templateText);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Smart Enter handling (Auto continuation for bullets, numbers, and checklists)
  const handleKeyDownDescription = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const textarea = e.currentTarget;
      const { selectionStart, value } = textarea;
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = value.substring(lineStart, selectionStart);

      // Check bullet '• '
      if (currentLine.startsWith('• ')) {
        e.preventDefault();
        if (currentLine.trim() === '•') {
          const newVal = value.substring(0, lineStart) + value.substring(selectionStart);
          setDescription(newVal);
          setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = lineStart; }, 0);
        } else {
          const newVal = value.substring(0, selectionStart) + '\n• ' + value.substring(selectionStart);
          setDescription(newVal);
          setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = selectionStart + 3; }, 0);
        }
        return;
      }

      // Check number '1. ', '2. ', etc.
      const matchNum = currentLine.match(/^(\d+)\.\s/);
      if (matchNum) {
        e.preventDefault();
        const num = parseInt(matchNum[1], 10);
        if (currentLine.trim() === `${num}.`) {
          const newVal = value.substring(0, lineStart) + value.substring(selectionStart);
          setDescription(newVal);
          setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = lineStart; }, 0);
        } else {
          const nextNumStr = `\n${num + 1}. `;
          const newVal = value.substring(0, selectionStart) + nextNumStr + value.substring(selectionStart);
          setDescription(newVal);
          setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = selectionStart + nextNumStr.length; }, 0);
        }
        return;
      }

      // Check checklist '☐ '
      if (currentLine.startsWith('☐ ')) {
        e.preventDefault();
        if (currentLine.trim() === '☐') {
          const newVal = value.substring(0, lineStart) + value.substring(selectionStart);
          setDescription(newVal);
          setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = lineStart; }, 0);
        } else {
          const newVal = value.substring(0, selectionStart) + '\n☐ ' + value.substring(selectionStart);
          setDescription(newVal);
          setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = selectionStart + 3; }, 0);
        }
        return;
      }
    }
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || assigneeIds.length === 0 || !dueDate) {
      alert('Mohon lengkapi judul, deskripsi, minimal 1 penerima tugas, dan tanggal tenggat.');
      return;
    }

    setIsSaving(true);
    try {
      const primaryAssignee = assigneeIds[0] || manpowerList[0]?.id || '';
      const taskData: any = {
        title: title.trim(),
        description: description.trim(),
        assignee_id: primaryAssignee,
        assignee_ids: assigneeIds,
        due_date: dueDate,
        due_time: dueTime || null,
        priority,
        status: editingTask ? editingTask.status : 'To Do',
        category,
        recurrence,
        visibility,
        updated_at: new Date().toISOString()
      };

      if (editingTask) {
        // Update
        const { error } = await supabase.from('team_tasks').update(taskData).eq('id', editingTask.id);
        if (error) {
          // Fallback if assignee_ids column doesn't exist yet on Supabase table
          if (error.message?.includes('assignee_ids') || error.message?.includes('category')) {
            const fallbackData = { ...taskData };
            delete fallbackData.assignee_ids;
            const { error: retryErr } = await supabase.from('team_tasks').update(fallbackData).eq('id', editingTask.id);
            if (retryErr) throw retryErr;
          } else {
            throw error;
          }
        }
      } else {
        // Insert
        const insertPayload = { ...taskData, created_by: activeUser || 'System' };
        const { error } = await supabase.from('team_tasks').insert([insertPayload]);
        if (error) {
          // Fallback if assignee_ids column doesn't exist yet
          if (error.message?.includes('assignee_ids') || error.message?.includes('category')) {
            const fallbackPayload = { ...insertPayload };
            delete fallbackPayload.assignee_ids;
            const { error: retryErr } = await supabase.from('team_tasks').insert([fallbackPayload]);
            if (retryErr) throw retryErr;
          } else {
            throw error;
          }
        }
      }

      await onRefreshAll();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Gagal menyimpan tugas: ${err.message || String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus tugas ini secara permanen?')) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('team_tasks').delete().eq('id', id);
      if (error) throw error;
      await onRefreshAll();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Gagal menghapus tugas: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'To Do' | 'In Progress' | 'Done' | 'Cancelled', reason?: string) => {
    try {
      const task = tasks.find(t => t.id === id);
      if (!task) return;

      const updateData: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === 'Cancelled' && reason) {
        updateData.cancel_reason = reason;
      }

      const { error } = await supabase.from('team_tasks').update(updateData).eq('id', id);
      if (error) throw error;

      // Auto-generate recurring task if marked as Done
      if (newStatus === 'Done' && task.recurrence && task.recurrence !== 'None') {
        const [y, m, d] = task.due_date.split('-').map(Number);
        const newDueDate = new Date(y, m - 1, d);
        if (task.recurrence === 'Daily') newDueDate.setDate(newDueDate.getDate() + 1);
        else if (task.recurrence === 'Weekly') newDueDate.setDate(newDueDate.getDate() + 7);
        else if (task.recurrence === 'Monthly') newDueDate.setMonth(newDueDate.getMonth() + 1);

        const nextYear = newDueDate.getFullYear();
        const nextMonth = String(newDueDate.getMonth() + 1).padStart(2, '0');
        const nextDay = String(newDueDate.getDate()).padStart(2, '0');

        const newTask = {
          title: task.title,
          description: task.description,
          assignee_id: task.assignee_id,
          assignee_ids: task.assignee_ids || [task.assignee_id],
          due_date: `${nextYear}-${nextMonth}-${nextDay}`,
          due_time: task.due_time,
          priority: task.priority,
          status: 'To Do',
          category: task.category,
          recurrence: task.recurrence,
          visibility: task.visibility,
          created_by: 'System (Auto-Recurring)'
        };
        await supabase.from('team_tasks').insert([newTask]);
      }

      await onRefreshAll();
    } catch (err: any) {
      alert(`Gagal memindahkan tugas: ${err.message}`);
    }
  };

  const handleSaveQuickLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle || !linkUrl) return;
    setIsSaving(true);

    const newLink: QuickLink = {
      id: 'ql-' + Date.now(),
      title: linkTitle.trim(),
      url: linkUrl.startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`,
      emoji: linkEmoji || '🔗',
      created_by: activeUser || 'System',
      created_at: new Date().toISOString()
    };

    try {
      // 1. Try to save to Supabase
      const { error } = await supabase.from('quick_links').insert([{
        title: newLink.title,
        url: newLink.url,
        emoji: newLink.emoji,
        created_by: newLink.created_by
      }]);

      if (error) {
        console.warn('Supabase quick_links insert note (saved locally):', error.message);
        const local = JSON.parse(localStorage.getItem('local_quick_links') || '[]');
        localStorage.setItem('local_quick_links', JSON.stringify([newLink, ...local]));
      }

      await onRefreshAll();
      setIsLinkModalOpen(false);
      setLinkTitle('');
      setLinkUrl('');
      setLinkEmoji('🔗');
    } catch (err: any) {
      console.warn('Fallback save quick link locally:', err);
      const local = JSON.parse(localStorage.getItem('local_quick_links') || '[]');
      localStorage.setItem('local_quick_links', JSON.stringify([newLink, ...local]));
      await onRefreshAll();
      setIsLinkModalOpen(false);
      setLinkTitle('');
      setLinkUrl('');
      setLinkEmoji('🔗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteQuickLink = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Hapus tautan ini?')) return;
    try {
      if (!id.startsWith('ql-')) {
        await supabase.from('quick_links').delete().eq('id', id);
      }
      const local = JSON.parse(localStorage.getItem('local_quick_links') || '[]');
      localStorage.setItem('local_quick_links', JSON.stringify(local.filter((l: any) => l.id !== id)));
      await onRefreshAll();
    } catch (err) {
      console.warn('Delete quick link error:', err);
    }
  };

  // Filter tasks by privacy, category, and search query
  const visibleTasks = useMemo(() => {
    return tasks.filter(t => {
      // 1. Privacy filter
      if (t.visibility === 'Private') {
        const isAssigned = (t.assignee_ids && t.assignee_ids.length > 0)
          ? t.assignee_ids.some(id => {
              const m = manpowerList.find(mp => mp.id === id);
              return m?.name === activeUser;
            })
          : manpowerList.find(m => m.id === t.assignee_id)?.name === activeUser;
        const isCreator = t.created_by === activeUser;
        if (!isAssigned && !isCreator) return false;
      }

      // 2. Category filter
      if (selectedCategoryFilter !== 'All' && t.category !== selectedCategoryFilter) {
        return false;
      }

      // 3. Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(query);
        const matchesDesc = t.description.toLowerCase().includes(query);
        const matchesCategory = (t.category || '').toLowerCase().includes(query);
        const matchesAssignees = (t.assignee_ids || [t.assignee_id]).some(id => {
          const m = manpowerList.find(mp => mp.id === id);
          return m?.name.toLowerCase().includes(query);
        });
        if (!matchesTitle && !matchesDesc && !matchesCategory && !matchesAssignees) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, activeUser, manpowerList, selectedCategoryFilter, searchQuery]);

  const activeColumns = [
    { id: 'To Do', title: '📋 To Do', color: 'bg-slate-100 border-slate-200 text-slate-700' },
    { id: 'In Progress', title: '⏳ In Progress', color: 'bg-amber-50 border-amber-200 text-amber-800' }
  ];

  const archivedTasks = visibleTasks.filter(t => t.status === 'Done' || t.status === 'Cancelled');

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            Workspace & Kelola Tugas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Pantau notulensi, jadwal meeting, surat menyurat, dan tugas lapangan tim.</p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari tugas, PIC, notulensi..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 pl-9 pr-3 py-1.5 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={openNewTaskModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Tugas</span>
          </button>
        </div>
      </div>

      {/* Quick Links Bar */}
      <div className="bg-slate-50/50 border-b border-slate-200 px-5 py-2.5 flex items-center gap-3 overflow-x-auto shrink-0 hide-scrollbar">
        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
          <LinkIcon className="h-3 w-3" />
          Akses Cepat
        </div>
        <div className="h-4 w-px bg-slate-300 mx-1 shrink-0" />
        
        {quickLinks.map(link => (
          <div
            key={link.id}
            className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-xs px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-indigo-700 transition-all shrink-0 group"
          >
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5"
            >
              <span>{link.emoji}</span>
              <span>{link.title}</span>
              <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-indigo-500" />
            </a>
            <button
              onClick={(e) => handleDeleteQuickLink(link.id, e)}
              className="opacity-0 group-hover:opacity-100 hover:text-rose-600 text-slate-400 p-0.5 rounded transition-all cursor-pointer"
              title="Hapus tautan ini"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        <button
          onClick={() => setIsLinkModalOpen(true)}
          className="flex items-center gap-1 bg-white hover:bg-indigo-50 border border-slate-200 border-dashed hover:border-indigo-300 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-indigo-600 transition-all shrink-0"
        >
          <Plus className="h-3 w-3" />
          Tambah Tautan
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="px-5 py-2.5 border-b border-slate-200 bg-white flex items-center gap-2 overflow-x-auto shrink-0 hide-scrollbar">
        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0 mr-1">
          <Filter className="h-3.5 w-3.5" />
          Kategori:
        </span>
        <button
          onClick={() => setSelectedCategoryFilter('All')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
            selectedCategoryFilter === 'All'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Semua ({visibleTasks.length})
        </button>
        {TASK_CATEGORIES.map(cat => {
          const count = tasks.filter(t => t.category === cat.id).length;
          const isSelected = selectedCategoryFilter === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryFilter(isSelected ? 'All' : cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex px-5 border-b border-slate-200 bg-white shrink-0">
        <button
          onClick={() => setActiveTab('board')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'board' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          Board Aktif ({visibleTasks.filter(t => t.status === 'To Do' || t.status === 'In Progress').length})
        </button>
        <button
          onClick={() => setActiveTab('archive')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'archive' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Archive className="h-4 w-4" />
          Riwayat & Arsip ({archivedTasks.length})
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === 'board' ? (
        <div className="flex-1 overflow-x-auto p-5 bg-slate-50/50">
          <div className="flex gap-5 h-full">
            {activeColumns.map(col => {
              const colTasks = visibleTasks.filter(t => t.status === col.id);
              return (
                <div key={col.id} className="w-[340px] flex flex-col h-full shrink-0">
                  <div className={`px-4 py-2.5 rounded-t-xl border-t border-l border-r font-bold text-sm flex items-center justify-between shadow-xs ${col.color}`}>
                    <span>{col.title}</span>
                    <span className="bg-white/80 px-2 py-0.5 rounded-full text-xs font-bold">{colTasks.length}</span>
                  </div>
                  <div className={`flex-1 p-3 border-b border-l border-r rounded-b-xl overflow-y-auto space-y-3.5 ${col.color.split(' ')[0].replace('50', '50/50')}`}>
                    {colTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        manpowerList={manpowerList}
                        onClick={() => openEditTaskModal(task)}
                        onStatusChange={(status, reason) => handleUpdateStatus(task.id, status as any, reason)}
                      />
                    ))}
                    {colTasks.length === 0 && (
                      <div className="text-center p-6 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 text-xs font-medium">
                        Tidak ada tugas di kolom ini.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
          <div className="max-w-4xl mx-auto space-y-3">
            {archivedTasks.length === 0 ? (
              <div className="text-center p-12 bg-white border border-slate-200 rounded-2xl shadow-xs">
                <Archive className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700">Belum Ada Arsip Tugas</h3>
                <p className="text-xs text-slate-500 mt-1">Tugas yang sudah selesai atau dibatalkan akan otomatis tersimpan rapi di sini.</p>
              </div>
            ) : (
              archivedTasks
                .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
                .map(task => {
                  const assignees = manpowerList.filter(m => (task.assignee_ids || [task.assignee_id]).includes(m.id));
                  return (
                    <div 
                      key={task.id} 
                      className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-all cursor-pointer group" 
                      onClick={() => openEditTaskModal(task)}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`mt-0.5 p-2 rounded-lg shrink-0 ${task.status === 'Done' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {task.status === 'Done' ? <CheckCircle2 className="h-5 w-5" /> : <X className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${task.status === 'Done' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {task.status === 'Done' ? 'SELESAI' : 'DIBATALKAN'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {task.category}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatIndonesianDateWithDay(task.due_date, task.due_time)}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                            {task.title}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 whitespace-pre-line">{task.description}</p>
                          
                          {task.cancel_reason && (
                            <div className="mt-2 text-xs bg-rose-50 border border-rose-200 text-rose-700 p-2 rounded-lg font-medium">
                              <strong>Alasan Batal:</strong> {task.cancel_reason}
                            </div>
                          )}

                          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                            <span>PIC: <strong className="text-slate-600">{assignees.map(a => a.name).join(', ') || 'Unknown'}</strong></span>
                            <span>•</span>
                            <span>{formatCreatedInfo(task.created_at, task.created_by)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(task.id, 'To Do');
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-all"
                        >
                          Buka Kembali
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}
      {/* 1. Task Modal (Create & Edit) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Header Modal */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    {editingTask ? <EditIcon className="h-5 w-5 text-indigo-600" /> : <Plus className="h-5 w-5 text-indigo-600" />}
                    {editingTask ? 'Edit Detail Tugas' : 'Buat Tugas / Notulensi Baru'}
                  </h3>
                  {editingTask && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatCreatedInfo(editingTask.created_at, editingTask.created_by)}
                    </p>
                  )}
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-200/60 hover:bg-slate-200 rounded-full transition-all">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body Form */}
              <div className="p-6 overflow-y-auto flex-1">
                <form id="task-form" onSubmit={handleSubmitTask} className="space-y-4">
                  {/* Judul */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Judul Tugas / Agenda</label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-semibold"
                      placeholder="Contoh: Buat Surat Pengantar Riksa Uji PT ABC"
                      required
                    />
                  </div>

                  {/* Deskripsi dengan Word/Docs Toolbar */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-indigo-600" />
                        Deskripsi / Notulensi / Instruksi
                      </label>
                      <span className="text-[10px] text-slate-400">Tekan Enter pada list untuk auto-numbering</span>
                    </div>

                    {/* Format Toolbar */}
                    <div className="bg-slate-100 border border-slate-200 border-b-0 rounded-t-xl px-2.5 py-1.5 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => insertFormatting('• ')}
                        className="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 transition-all shadow-xs"
                        title="Buat Daftar Poin (Bullet List)"
                      >
                        <List className="h-3.5 w-3.5" />
                        <span>Pointing</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => insertFormatting('1. ')}
                        className="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 transition-all shadow-xs"
                        title="Buat Daftar Bernomor (Numbered List)"
                      >
                        <ListOrdered className="h-3.5 w-3.5" />
                        <span>Numbering</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => insertFormatting('☐ ')}
                        className="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 transition-all shadow-xs"
                        title="Buat To-Do Checklist"
                      >
                        <CheckSquare className="h-3.5 w-3.5" />
                        <span>Checklist</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => insertFormatting('**', '**')}
                        className="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-700 flex items-center gap-1 transition-all shadow-xs"
                        title="Teks Tebal (Bold)"
                      >
                        <Bold className="h-3.5 w-3.5" />
                        <span>Tebal</span>
                      </button>

                      <div className="h-4 w-px bg-slate-300 mx-1" />

                      {/* Template Cepat */}
                      <button
                        type="button"
                        onClick={() => insertTemplate('notulensi')}
                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                        title="Sisipkan Format Notulensi Rapat"
                      >
                        <Sparkles className="h-3 w-3" />
                        Template Notulensi
                      </button>

                      <button
                        type="button"
                        onClick={() => insertTemplate('instruksi')}
                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                        title="Sisipkan Format Tugas Kerja"
                      >
                        <Sparkles className="h-3 w-3" />
                        Template Tugas
                      </button>
                    </div>

                    <textarea
                      ref={textareaRef}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      onKeyDown={handleKeyDownDescription}
                      rows={6}
                      className="w-full bg-white border border-slate-200 rounded-b-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-sans leading-relaxed"
                      placeholder="Tuliskan poin-poin notulensi rapat, daftar pemeriksaan, instruksi kerja, atau nomor surat..."
                      required
                    />
                  </div>

                  {/* Multi Assignee Picker */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-indigo-600" />
                        Penerima Tugas (Bisa Memilih Lebih Dari 1 Orang)
                      </label>
                      <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                        {assigneeIds.length} penerima dipilih
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      {manpowerList.map(m => {
                        const isSelected = assigneeIds.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (assigneeIds.length > 1) {
                                  setAssigneeIds(assigneeIds.filter(id => id !== m.id));
                                }
                              } else {
                                setAssigneeIds([...assigneeIds, m.id]);
                              }
                            }}
                            className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-all border ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold shrink-0 border ${isSelected ? 'bg-white text-indigo-600 border-white' : 'border-slate-300 bg-slate-50'}`}>
                              {isSelected ? '✓' : ''}
                            </div>
                            <div className="truncate">
                              <div className="font-bold truncate">{m.name}</div>
                              <div className={`text-[10px] truncate ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                                {m.role}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Kategori, Prioritas, & Perulangan */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Kategori Tugas</label>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value as TaskCategory)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
                      >
                        {TASK_CATEGORIES.map(c => (
                          <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Prioritas</label>
                      <select
                        value={priority}
                        onChange={e => setPriority(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
                      >
                        <option value="P1">🔴 P1 - Tinggi (Mendesak)</option>
                        <option value="P2">🟡 P2 - Sedang (Normal)</option>
                        <option value="P3">🟢 P3 - Rendah (Santai)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Perulangan</label>
                      <select
                        value={recurrence}
                        onChange={e => setRecurrence(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
                      >
                        <option value="None">Tidak Diulang</option>
                        <option value="Daily">Harian</option>
                        <option value="Weekly">Mingguan</option>
                        <option value="Monthly">Bulanan</option>
                      </select>
                    </div>
                  </div>

                  {/* Tenggat Waktu & Privasi */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Tenggat Tanggal
                          <span className="text-[10px] font-semibold text-indigo-600 ml-1">
                            ({formatIndonesianDateWithDay(dueDate).split(',')[0]})
                          </span>
                        </label>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={e => setDueDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
                          required
                        />
                      </div>
                      <div className="w-28">
                        <label className="text-xs font-bold text-slate-700 block mb-1">Jam (WIB)</label>
                        <input
                          type="time"
                          value={dueTime}
                          onChange={e => setDueTime(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Visibilitas</label>
                      <select
                        value={visibility}
                        onChange={e => setVisibility(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
                      >
                        <option value="Public">Public (Semua Tim)</option>
                        <option value="Private">Private (Hanya PIC)</option>
                      </select>
                    </div>
                  </div>

                  {/* Preview Tenggat Tanggal Lengkap */}
                  <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 flex items-center gap-2 text-xs text-indigo-900">
                    <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span>Tenggat Pengerjaan: <strong>{formatIndonesianDateWithDay(dueDate, dueTime)}</strong></span>
                  </div>
                </form>
              </div>

              {/* Footer Modal */}
              <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                {editingTask ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(editingTask.id)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 px-3 py-2 hover:bg-rose-50 rounded-xl transition-all"
                    disabled={isSaving}
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus
                  </button>
                ) : <div />}
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-200/60 rounded-xl transition-all"
                    disabled={isSaving}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    form="task-form"
                    disabled={isSaving}
                    className="px-6 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isSaving ? <Loader className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {editingTask ? 'Simpan Perubahan' : 'Buat Tugas'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Quick Link Modal */}
      <AnimatePresence>
        {isLinkModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-indigo-600" />
                  Tambah Tautan Cepat
                </h3>
                <button onClick={() => setIsLinkModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-200/50 hover:bg-slate-200 rounded-full transition-all">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6">
                <form id="link-form" onSubmit={handleSaveQuickLink} className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-16">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Emoji</label>
                      <input
                        type="text"
                        value={linkEmoji}
                        onChange={e => setLinkEmoji(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-center text-sm focus:outline-none focus:border-indigo-500"
                        maxLength={2}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Nama Tautan</label>
                      <input
                        type="text"
                        value={linkTitle}
                        onChange={e => setLinkTitle(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                        placeholder="Contoh: Template Surat PT ABC"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">URL / Link Web</label>
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                      placeholder="https://docs.google.com/..."
                      required
                    />
                  </div>
                </form>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-200/50 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="link-form"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan Link'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Subcomponent for individual task card
function TaskCard({ task, manpowerList, onClick, onStatusChange }: { 
  task: TeamTask, 
  manpowerList: Manpower[], 
  onClick: () => void,
  onStatusChange: (status: string, reason?: string) => void
}) {
  // Multi-assignees resolution
  const assignees = useMemo(() => {
    const ids = task.assignee_ids && task.assignee_ids.length > 0 
      ? task.assignee_ids 
      : (task.assignee_id ? [task.assignee_id] : []);
    return manpowerList.filter(m => ids.includes(m.id));
  }, [task, manpowerList]);

  // Deadline countdown and color info
  const deadlineInfo = useMemo(() => {
    return getDeadlineCountdown(task.due_date, task.due_time, task.status);
  }, [task.due_date, task.due_time, task.status]);

  const priorityColors: Record<string, string> = {
    'P1': 'bg-rose-100 text-rose-700 border-rose-200',
    'P2': 'bg-amber-100 text-amber-700 border-amber-200',
    'P3': 'bg-emerald-100 text-emerald-700 border-emerald-200'
  };

  const nextStatusMap: Record<string, 'To Do' | 'In Progress' | 'Done'> = {
    'To Do': 'In Progress',
    'In Progress': 'Done',
    'Done': 'To Do'
  };

  const nextStatus = nextStatusMap[task.status];
  const nextStatusLabel = nextStatus === 'In Progress' ? 'Mulai Kerjakan' : nextStatus === 'Done' ? 'Selesaikan' : 'Kembalikan';

  const handleCancelTask = (e: React.MouseEvent) => {
    e.stopPropagation();
    const reason = window.prompt("Masukkan alasan mengapa tugas ini dibatalkan atau gagal:");
    if (reason !== null && reason.trim() !== '') {
      onStatusChange('Cancelled', reason.trim());
    }
  };

  const categoryObj = TASK_CATEGORIES.find(c => c.id === task.category);

  return (
    <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all group flex flex-col gap-2.5 relative">
      {/* Top Header Card */}
      <div className="flex justify-between items-start cursor-pointer" onClick={onClick}>
        <div className="flex flex-col gap-1.5 w-full">
          <div className="flex justify-between items-start gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${priorityColors[task.priority] || 'bg-slate-100'}`}>
                {task.priority}
              </span>
              
              {/* Category Pill */}
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${categoryObj?.badgeColor || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                <span>{categoryObj?.icon || '📌'}</span>
                <span>{task.category}</span>
              </span>

              {task.visibility === 'Private' && (
                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md" title="Private Task">
                  🔒
                </span>
              )}
              {task.recurrence && task.recurrence !== 'None' && (
                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100" title={`Berulang: ${task.recurrence}`}>
                  🔁
                </span>
              )}
            </div>

            {/* Countdown Badge */}
            <div className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${deadlineInfo.badgeClass}`}>
              {deadlineInfo.type === 'overdue' && <AlertTriangle className="h-3 w-3" />}
              {deadlineInfo.type === 'urgent' && <Clock className="h-3 w-3" />}
              <span>{deadlineInfo.text}</span>
            </div>
          </div>

          {/* Title */}
          <h4 className="font-bold text-sm text-slate-800 leading-snug group-hover:text-indigo-600 transition-colors">
            {task.title}
          </h4>
        </div>
      </div>
      
      {/* Description Snippet with formatted breaks */}
      <div className="text-[11px] text-slate-500 line-clamp-2 cursor-pointer whitespace-pre-line leading-relaxed font-normal" onClick={onClick}>
        {task.description}
      </div>

      {/* Info Details & Actions Footer */}
      <div className="flex flex-col gap-2.5 mt-auto border-t border-slate-100 pt-2.5">
        {/* Row 1: Assignees & Due Date */}
        <div className="flex flex-col gap-1.5">
          {/* Multiple Assignees Display */}
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 bg-slate-100/80 px-2 py-1 rounded-lg">
            {assignees.length > 1 ? <Users className="h-3.5 w-3.5 text-indigo-600 shrink-0" /> : <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
            <span className="truncate">
              {assignees.length > 0 
                ? assignees.map(a => a.name).join(', ') 
                : 'Belum ditentukan'}
            </span>
            {assignees.length > 1 && (
              <span className="ml-auto text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.2 rounded-full shrink-0">
                {assignees.length} PIC
              </span>
            )}
          </div>

          {/* Tenggat Waktu (Hari + Tanggal + Jam) */}
          <div className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg border transition-all ${deadlineInfo.timeClass}`}>
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-semibold">
              {formatIndonesianDateWithDay(task.due_date, task.due_time)}
            </span>
          </div>
        </div>

        {/* Row 2: Posting info & Action Buttons */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100/80">
          {/* Kapan diposting & pembuat */}
          <div className="text-[9px] text-slate-400 font-medium truncate max-w-[150px]" title={formatCreatedInfo(task.created_at, task.created_by)}>
            {formatCreatedInfo(task.created_at, task.created_by)}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleCancelTask}
              className="text-[10px] font-bold text-rose-500 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 px-2 py-1 rounded-md transition-all shadow-xs"
              title="Batalkan tugas"
            >
              Batal
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(nextStatus);
              }}
              className="bg-indigo-50 hover:bg-indigo-600 border border-indigo-100 hover:border-indigo-600 text-indigo-600 hover:text-white text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 transition-all shadow-xs"
              title={nextStatusLabel}
            >
              <span>{task.status === 'Done' ? 'Buka Lagi' : task.status === 'In Progress' ? 'Selesai' : 'Mulai'}</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  );
}
