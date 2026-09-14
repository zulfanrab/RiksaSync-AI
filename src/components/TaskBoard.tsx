import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TeamTask, Manpower, QuickLink } from '../types';
import { Plus, Clock, User, AlertCircle, CheckCircle2, ChevronRight, X, Loader, Trash2, Calendar, FileText, Link as LinkIcon, ExternalLink, Archive, LayoutDashboard } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TaskBoardProps {
  tasks: TeamTask[];
  quickLinks: QuickLink[];
  manpowerList: Manpower[];
  activeUser: string | null;
  onRefreshAll: () => Promise<void>;
}

export default function TaskBoard({ tasks, quickLinks, manpowerList, activeUser, onRefreshAll }: TaskBoardProps) {
  const [activeTab, setActiveTab] = useState<'board' | 'archive'>('board');
  
  // Task Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Task Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<'P1' | 'P2' | 'P3'>('P2');
  const [category, setCategory] = useState<'Notulensi' | 'Laporan Bulanan' | 'Survey' | 'Lainnya'>('Notulensi');
  const [recurrence, setRecurrence] = useState<'None' | 'Daily' | 'Weekly' | 'Monthly'>('None');
  const [visibility, setVisibility] = useState<'Public' | 'Private'>('Public');

  // Quick Link Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkEmoji, setLinkEmoji] = useState('🔗');

  const openNewTaskModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setAssigneeId(manpowerList[0]?.id || '');
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
    setAssigneeId(task.assignee_id);
    setDueDate(task.due_date);
    setDueTime(task.due_time || '');
    setPriority(task.priority);
    setCategory(task.category);
    setRecurrence(task.recurrence || 'None');
    setVisibility(task.visibility || 'Public');
    setIsModalOpen(true);
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !assigneeId || !dueDate) {
      alert('Mohon lengkapi judul, deskripsi, penerima tugas, dan tanggal tenggat.');
      return;
    }

    setIsSaving(true);
    try {
      const taskData = {
        title,
        description,
        assignee_id: assigneeId,
        due_date: dueDate,
        due_time: dueTime || null,
        priority,
        status: editingTask ? editingTask.status : 'To Do',
        category,
        recurrence,
        visibility,
      };

      if (editingTask) {
        const { error } = await supabase.from('team_tasks').update(taskData).eq('id', editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('team_tasks').insert([{ ...taskData, created_by: activeUser || 'System' }]);
        if (error) throw error;
      }

      await onRefreshAll();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Gagal menyimpan tugas: ${err.message}`);
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

      const updateData: any = { status: newStatus };
      if (newStatus === 'Cancelled' && reason) {
        updateData.cancel_reason = reason;
      }

      const { error } = await supabase.from('team_tasks').update(updateData).eq('id', id);
      if (error) throw error;

      // Auto-generate recurring task if marked as Done
      if (newStatus === 'Done' && task.recurrence && task.recurrence !== 'None') {
        let newDueDate = new Date(task.due_date);
        if (task.recurrence === 'Daily') newDueDate.setDate(newDueDate.getDate() + 1);
        else if (task.recurrence === 'Weekly') newDueDate.setDate(newDueDate.getDate() + 7);
        else if (task.recurrence === 'Monthly') newDueDate.setMonth(newDueDate.getMonth() + 1);

        const newTask = {
          title: task.title,
          description: task.description,
          assignee_id: task.assignee_id,
          due_date: newDueDate.toISOString().split('T')[0],
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
    try {
      const { error } = await supabase.from('quick_links').insert([{
        title: linkTitle,
        url: linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`,
        emoji: linkEmoji,
        created_by: activeUser || 'System'
      }]);
      if (error) throw error;
      await onRefreshAll();
      setIsLinkModalOpen(false);
      setLinkTitle('');
      setLinkUrl('');
      setLinkEmoji('🔗');
    } catch (err: any) {
      alert(`Gagal menyimpan link: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Group tasks by status and filter by visibility
  const visibleTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.visibility === 'Private') {
        const assignee = manpowerList.find(m => m.id === t.assignee_id);
        return t.created_by === activeUser || assignee?.name === activeUser;
      }
      return true;
    });
  }, [tasks, activeUser, manpowerList]);

  const activeColumns = [
    { id: 'To Do', title: '📋 To Do', color: 'bg-slate-100 border-slate-200 text-slate-700' },
    { id: 'In Progress', title: '⏳ In Progress', color: 'bg-amber-50 border-amber-200 text-amber-800' }
  ];

  const archivedTasks = visibleTasks.filter(t => t.status === 'Done' || t.status === 'Cancelled');

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            Workspace & Tugas Tim
          </h2>
          <p className="text-xs text-slate-500 mt-1">Kelola notulensi, jadwal meeting, dan tugas administrasi tim.</p>
        </div>
        <button
          onClick={openNewTaskModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Tambah Tugas
        </button>
      </div>

      {/* Quick Links Bar */}
      <div className="bg-slate-50/50 border-b border-slate-200 px-5 py-3 flex items-center gap-3 overflow-x-auto shrink-0 hide-scrollbar">
        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
          <LinkIcon className="h-3 w-3" />
          Quick Links
        </div>
        <div className="h-4 w-px bg-slate-300 mx-1 shrink-0" />
        
        {quickLinks.map(link => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-indigo-700 transition-all shrink-0 group"
          >
            <span>{link.emoji}</span>
            <span>{link.title}</span>
            <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-indigo-500" />
          </a>
        ))}

        <button
          onClick={() => setIsLinkModalOpen(true)}
          className="flex items-center gap-1 bg-slate-100 hover:bg-indigo-50 border border-slate-200 border-dashed hover:border-indigo-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-indigo-600 transition-all shrink-0"
        >
          <Plus className="h-3 w-3" />
          Tambah
        </button>
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
          Board Aktif
        </button>
        <button
          onClick={() => setActiveTab('archive')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'archive' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Archive className="h-4 w-4" />
          Arsip Tugas
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === 'board' ? (
        <div className="flex-1 overflow-x-auto p-5 bg-slate-50/50">
          <div className="flex gap-5 h-full">
            {activeColumns.map(col => (
              <div key={col.id} className="w-[320px] flex flex-col h-full">
                <div className={`px-4 py-2.5 rounded-t-xl border-t border-l border-r font-bold text-sm flex items-center justify-between ${col.color}`}>
                  {col.title}
                  <span className="bg-white/50 px-2 py-0.5 rounded-full text-[10px]">{visibleTasks.filter(t => t.status === col.id).length}</span>
                </div>
                <div className={`flex-1 p-3 border-b border-l border-r rounded-b-xl overflow-y-auto space-y-3 ${col.color.split(' ')[0].replace('50', '50/50')}`}>
                  {visibleTasks.filter(t => t.status === col.id).map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      manpowerList={manpowerList}
                      onClick={() => openEditTaskModal(task)}
                      onStatusChange={(status, reason) => handleUpdateStatus(task.id, status as any, reason)}
                    />
                  ))}
                  {visibleTasks.filter(t => t.status === col.id).length === 0 && (
                    <div className="text-center p-5 border border-dashed border-slate-300 rounded-xl text-slate-400 text-xs font-medium">
                      Belum ada tugas di kolom ini.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
          <div className="max-w-4xl mx-auto space-y-3">
            {archivedTasks.length === 0 ? (
              <div className="text-center p-10 bg-white border border-slate-200 rounded-2xl">
                <Archive className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700">Belum Ada Arsip</h3>
                <p className="text-xs text-slate-500 mt-1">Tugas yang selesai atau dibatalkan akan tampil di sini.</p>
              </div>
            ) : (
              archivedTasks.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()).map(task => (
                <div key={task.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-all cursor-pointer" onClick={() => openEditTaskModal(task)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                        task.status === 'Done' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'
                      }`}>
                        {task.status === 'Done' ? 'Selesai' : 'Dibatalkan'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {task.category}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-800">{task.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{task.description}</p>
                    
                    {task.status === 'Cancelled' && task.cancel_reason && (
                      <div className="mt-2 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 p-2 rounded-lg">
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                        Alasan Batal: <span className="font-medium">{task.cancel_reason}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-4">
                    <div className="text-[10px]">
                      <p className="text-slate-400 font-bold uppercase mb-0.5">Penerima</p>
                      <p className="font-bold text-slate-700 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {manpowerList.find(m => m.id === task.assignee_id)?.name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modals... */}
      {/* 1. Task Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  {editingTask ? <EditIcon className="h-5 w-5 text-indigo-600" /> : <Plus className="h-5 w-5 text-indigo-600" />}
                  {editingTask ? 'Edit Tugas' : 'Buat Tugas Baru'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-200/50 hover:bg-slate-200 rounded-full transition-all">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <form id="task-form" onSubmit={handleSubmitTask} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Judul Tugas</label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-semibold"
                      placeholder="Contoh: Buat Laporan Bulanan Agustus"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Deskripsi / Notulensi</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={5}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                      placeholder="Tuliskan detail instruksi, notulensi meeting, atau catatan survey..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Ditugaskan Kepada</label>
                      <select
                        value={assigneeId}
                        onChange={e => setAssigneeId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
                        required
                      >
                        <option value="">Pilih Pengguna...</option>
                        {manpowerList.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Kategori</label>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Notulensi">Notulensi</option>
                        <option value="Laporan Bulanan">Laporan Bulanan</option>
                        <option value="Survey">Survey</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Prioritas</label>
                      <select
                        value={priority}
                        onChange={e => setPriority(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="P1">P1 - Tinggi (Mendesak)</option>
                        <option value="P2">P2 - Sedang</option>
                        <option value="P3">P3 - Rendah</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Perulangan (Reminder)</label>
                      <select
                        value={recurrence}
                        onChange={e => setRecurrence(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="None">Tidak Diulang</option>
                        <option value="Daily">Harian</option>
                        <option value="Weekly">Mingguan</option>
                        <option value="Monthly">Bulanan</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Privasi Tugas</label>
                      <select
                        value={visibility}
                        onChange={e => setVisibility(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Public">Public (Semua bisa lihat)</option>
                        <option value="Private">Private (Hanya Pembuat & Penerima)</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-slate-700 block mb-1">Tenggat Waktu</label>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={e => setDueDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
                          required
                        />
                      </div>
                      <div className="w-24">
                        <label className="text-xs font-bold text-slate-700 block mb-1">Jam (Ops)</label>
                        <input
                          type="time"
                          value={dueTime}
                          onChange={e => setDueTime(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                {editingTask ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(editingTask.id)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 px-3 py-2 hover:bg-rose-50 rounded-xl transition-all"
                    disabled={isSaving}
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus Tugas
                  </button>
                ) : <div />}
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-200/50 rounded-xl transition-all"
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-indigo-600" />
                  Tambah Quick Link
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
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Judul Link</label>
                      <input
                        type="text"
                        value={linkTitle}
                        onChange={e => setLinkTitle(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                        placeholder="Contoh: Google Drive Inspeksi"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">URL / Link</label>
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                      placeholder="https://drive.google.com/..."
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
  const assignee = manpowerList.find(m => m.id === task.assignee_id);
  
  // Calculate if overdue
  const isOverdue = task.status !== 'Done' && task.status !== 'Cancelled' && new Date(task.due_date) < new Date(new Date().toISOString().split('T')[0]);
  
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

  return (
    <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group flex flex-col gap-2 relative">
      <div className="flex justify-between items-start cursor-pointer" onClick={onClick}>
        <div className="flex flex-col gap-1 w-full">
          <div className="flex justify-between items-start gap-2 mb-1">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${priorityColors[task.priority]}`}>
              {task.priority}
            </span>
            <div className="flex items-center gap-1">
              {task.visibility === 'Private' && (
                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md" title="Private Task">
                  🔒
                </span>
              )}
              {task.recurrence !== 'None' && (
                <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100" title={`Berulang: ${task.recurrence}`}>
                  🔁
                </span>
              )}
              <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {task.category}
              </span>
            </div>
          </div>
          <h4 className="font-bold text-sm text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">
            {task.title}
          </h4>
        </div>
      </div>
      
      <div className="text-[11px] text-slate-500 line-clamp-2 cursor-pointer mb-1" onClick={onClick}>
        {task.description}
      </div>

      <div className="flex flex-col gap-2 mt-auto border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Penerima Tugas */}
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-slate-100/80 px-2 py-1 rounded-lg">
            <User className="h-3 w-3 text-slate-400" />
            <span className="truncate max-w-[80px]">{assignee?.name || 'Unknown'}</span>
          </div>

          {/* Tenggat Waktu */}
          <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg ${isOverdue ? 'text-rose-600 bg-rose-50 border border-rose-100' : 'text-slate-500 bg-slate-100/80'}`}>
            {isOverdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
            {new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            {task.due_time && ` • ${task.due_time}`}
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          {/* Ditugaskan oleh (Activity Log) */}
          <div className="text-[9px] text-slate-400 font-medium flex items-center gap-1">
            <span>Oleh:</span>
            <span className="font-bold text-slate-500">{task.created_by || 'System'}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancelTask}
              className="text-[10px] font-bold text-rose-500 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 px-2.5 py-1 rounded-md transition-all shadow-xs"
              title="Batalkan atau gagalkan tugas"
            >
              Batalkan
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(nextStatus);
              }}
              className="bg-indigo-50 hover:bg-indigo-600 border border-indigo-100 hover:border-indigo-600 text-indigo-600 hover:text-white text-[10px] font-bold px-3 py-1 rounded-md flex items-center gap-1 transition-all shadow-xs"
              title={nextStatusLabel}
            >
              {task.status === 'Done' ? 'Buka Lagi' : task.status === 'In Progress' ? 'Selesaikan' : 'Mulai'}
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple edit icon
function EditIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  );
}
