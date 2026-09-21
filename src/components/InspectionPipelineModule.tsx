/**
 * InspectionPipelineModule.tsx
 * Modul: ⚙️ Progress Pemeriksaan (Pipeline Teknis & Operasional)
 * Mengelola pipeline pasca-deal hingga Suket terbit
 */

import React, { useState, useMemo } from 'react';
import {
  ClipboardList, FileText, Wrench, Calendar, CheckCircle2, Clock,
  Plus, Edit3, Trash2, ExternalLink, X, Save, RefreshCcw,
  ChevronRight, ArrowRight, Building2, Phone, AlertTriangle, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InspectionJob, InspectionStage, Manpower } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const STAGES: InspectionStage[] = ['Penawaran', 'SPK Diterima', 'Penjadwalan', 'Pelaksanaan', 'Laporan', 'Suket Terbit'];

const STAGE_CONFIG: Record<InspectionStage, { icon: React.ElementType; color: string; bg: string; border: string; desc: string }> = {
  'Penawaran':    { icon: FileText,       color: 'text-sky-600',     bg: 'bg-sky-50',     border: 'border-sky-200',     desc: 'Draf penawaran dikirim ke klien' },
  'SPK Diterima': { icon: ClipboardList,  color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  desc: 'Surat Perintah Kerja sudah diterima' },
  'Penjadwalan':  { icon: Calendar,       color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   desc: 'Tanggal pelaksanaan sedang dijadwalkan' },
  'Pelaksanaan':  { icon: Wrench,         color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200',  desc: 'Inspeksi/riksa uji sedang berlangsung' },
  'Laporan':      { icon: ClipboardList,  color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200',  desc: 'Laporan teknis sedang disusun' },
  'Suket Terbit': { icon: CheckCircle2,   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', desc: 'Sertifikat Disnaker sudah terbit' },
};

const EQUIPMENT_TYPES = ['PTP', 'PAA', 'Elevator & Eskalator', 'PUBT', 'Instalasi Listrik', 'Angkur & TKPK', 'Lainnya'];

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============================================================
// JOB FORM MODAL
// ============================================================
interface JobFormProps {
  initial?: InspectionJob;
  manpowerList?: Manpower[];
  onClose: () => void;
  onSave: (job: Partial<InspectionJob>) => Promise<void>;
}

function JobForm({ initial, manpowerList = [], onClose, onSave }: JobFormProps) {
  const [clientName, setClientName] = useState(initial?.client_name || '');
  const [picName, setPicName] = useState(initial?.pic_name || '');
  const [picPhone, setPicPhone] = useState(initial?.pic_phone || '');
  const [eqName, setEqName] = useState(initial?.equipment_name || '');
  const [eqType, setEqType] = useState(initial?.equipment_type || 'PAA');
  const [stage, setStage] = useState<InspectionStage>(initial?.stage || 'Penawaran');
  const [dueDate, setDueDate] = useState(initial?.due_date || '');
  const [scheduledDate, setScheduledDate] = useState(initial?.scheduled_date || '');
  const [completedDate, setCompletedDate] = useState(initial?.completed_date || '');
  const [assignedLead, setAssignedLead] = useState(initial?.assigned_lead || '');
  const [offerUrl, setOfferUrl] = useState(initial?.offer_doc_url || '');
  const [spkUrl, setSpkUrl] = useState(initial?.spk_doc_url || '');
  const [reportUrl, setReportUrl] = useState(initial?.report_doc_url || '');
  const [suketUrl, setSuketUrl] = useState(initial?.suket_doc_url || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !eqName.trim()) { setError('Nama PT dan Nama Alat wajib diisi.'); return; }
    setError(''); setIsLoading(true);
    try {
      await onSave({
        ...(initial || {}),
        client_name: clientName, pic_name: picName, pic_phone: picPhone,
        equipment_name: eqName, equipment_type: eqType, stage,
        due_date: dueDate, scheduled_date: scheduledDate, completed_date: completedDate,
        assigned_lead: assignedLead, offer_doc_url: offerUrl,
        spk_doc_url: spkUrl, report_doc_url: reportUrl, suket_doc_url: suketUrl,
        notes,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan job.');
    } finally { setIsLoading(false); }
  };

  const StageIcon = STAGE_CONFIG[stage].icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '95vh' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-900 to-indigo-700 text-white">
          <div>
            <h2 className="text-sm font-black">{initial ? '✏️ Edit Job Pemeriksaan' : '➕ Job Pemeriksaan Baru'}</h2>
            <p className="text-[10px] text-indigo-200 mt-0.5">Pipeline teknis & operasional pasca-deal</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto" style={{ maxHeight: 'calc(95vh - 120px)' }}>
          <div className="p-6 space-y-5">
            {/* Stage Selector */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">Stage Pipeline</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {STAGES.map(s => {
                  const cfg = STAGE_CONFIG[s];
                  const Icon = cfg.icon;
                  return (
                    <button
                      type="button" key={s}
                      onClick={() => setStage(s)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                        stage === s ? `${cfg.border} ${cfg.bg} ${cfg.color}` : 'border-slate-100 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[9px] font-bold leading-tight">{s}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Client Info */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5" /> Data Klien
                </h3>
                <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nama PT *"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-300 outline-none" />
                <input value={picName} onChange={e => setPicName(e.target.value)} placeholder="Nama PIC"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-300 outline-none" />
                <input value={picPhone} onChange={e => setPicPhone(e.target.value)} placeholder="No. WA PIC" type="tel"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-300 outline-none" />
              </div>

              {/* Equipment Info */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5" /> Data Alat
                </h3>
                <input value={eqName} onChange={e => setEqName(e.target.value)} placeholder="Nama Alat *"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-300 outline-none" />
                <select value={eqType} onChange={e => setEqType(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-indigo-300 outline-none cursor-pointer">
                  {EQUIPMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  placeholder="Jatuh tempo suket asli"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-300 outline-none cursor-pointer" />
              </div>
            </div>

            {/* Dates & Manpower */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Tgl Rencana Pelaksanaan</label>
                <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-300 outline-none cursor-pointer" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Tgl Selesai Aktual</label>
                <input type="date" value={completedDate} onChange={e => setCompletedDate(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-300 outline-none cursor-pointer" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Ahli Utama (Lead)</label>
                <select value={assignedLead} onChange={e => setAssignedLead(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-indigo-300 outline-none cursor-pointer">
                  <option value="">— Belum ditentukan —</option>
                  {manpowerList.filter(m => m.status === 'internal').map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Documents */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <ExternalLink className="h-3.5 w-3.5 text-sky-500" /> Link Dokumen Google Drive
              </h3>
              <input value={offerUrl} onChange={e => setOfferUrl(e.target.value)} placeholder="🔗 Link Surat Penawaran"
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-sky-300 outline-none" />
              <input value={spkUrl} onChange={e => setSpkUrl(e.target.value)} placeholder="🔗 Link SPK / Kontrak"
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-sky-300 outline-none" />
              <input value={reportUrl} onChange={e => setReportUrl(e.target.value)} placeholder="🔗 Link Laporan Teknis"
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-sky-300 outline-none" />
              <input value={suketUrl} onChange={e => setSuketUrl(e.target.value)} placeholder="🔗 Link Suket / Sertifikat Baru"
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-sky-300 outline-none" />
            </div>

            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Catatan tambahan tentang job ini..." rows={2}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:ring-2 focus:ring-indigo-300 outline-none" />

            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-3 bg-slate-50">
            <button type="button" onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-100 transition-all cursor-pointer">Batal</button>
            <button type="submit" disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer shadow-md">
              {isLoading ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {initial ? 'Simpan Perubahan' : 'Buat Job Pemeriksaan'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ============================================================
// KANBAN COLUMN
// ============================================================
interface KanbanColumnProps {
  stage: InspectionStage;
  jobs: InspectionJob[];
  manpowerList: Manpower[];
  onEdit: (job: InspectionJob) => void;
  onDelete: (jobId: string) => void;
  onMoveStage: (jobId: string, newStage: InspectionStage) => void;
}

function KanbanColumn({ stage, jobs, manpowerList, onEdit, onDelete, onMoveStage }: KanbanColumnProps) {
  const cfg = STAGE_CONFIG[stage];
  const Icon = cfg.icon;
  const stageIdx = STAGES.indexOf(stage);
  const nextStage = stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1] : null;

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} flex flex-col min-h-[200px]`} style={{ minWidth: '260px' }}>
      {/* Column Header */}
      <div className={`flex items-center gap-2 px-4 py-3 border-b ${cfg.border}`}>
        <Icon className={`h-4 w-4 ${cfg.color}`} />
        <span className={`text-xs font-black ${cfg.color}`}>{stage}</span>
        <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{jobs.length}</span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto" style={{ maxHeight: '500px' }}>
        {jobs.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[10px] text-slate-400">Tidak ada job</p>
          </div>
        )}
        {jobs.map(job => {
          const lead = manpowerList.find(m => m.id === job.assigned_lead);
          return (
            <motion.div key={job.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow group space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-black text-slate-800 leading-tight">{job.client_name}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">{job.equipment_name} · {job.equipment_type}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => onEdit(job)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer" title="Edit">
                    <Edit3 className="h-3 w-3 text-slate-400" />
                  </button>
                  <button onClick={() => { if (confirm(`Hapus job ini?`)) onDelete(job.id); }}
                    className="p-1 hover:bg-red-50 rounded-lg cursor-pointer" title="Hapus">
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </button>
                </div>
              </div>

              {/* PIC & Dates */}
              <div className="space-y-1">
                {job.pic_name && (
                  <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
                    <Phone className="h-2.5 w-2.5" />{job.pic_name} {job.pic_phone ? `· ${job.pic_phone}` : ''}
                  </div>
                )}
                {job.due_date && (
                  <div className="flex items-center gap-1.5 text-[9px] text-amber-600">
                    <AlertTriangle className="h-2.5 w-2.5" />Jatuh tempo: {formatDate(job.due_date)}
                  </div>
                )}
                {job.scheduled_date && (
                  <div className="flex items-center gap-1.5 text-[9px] text-indigo-500">
                    <Calendar className="h-2.5 w-2.5" />Rencana: {formatDate(job.scheduled_date)}
                  </div>
                )}
                {lead && (
                  <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
                    <Wrench className="h-2.5 w-2.5" />Lead: {lead.name}
                  </div>
                )}
              </div>

              {/* Documents */}
              <div className="flex flex-wrap gap-1.5">
                {job.offer_doc_url && <a href={job.offer_doc_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[9px] bg-sky-50 text-sky-600 border border-sky-100 px-1.5 py-0.5 rounded-md font-medium hover:bg-sky-100 transition-colors">📄 Penawaran</a>}
                {job.spk_doc_url && <a href={job.spk_doc_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-md font-medium hover:bg-indigo-100 transition-colors">📋 SPK</a>}
                {job.report_doc_url && <a href={job.report_doc_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[9px] bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-md font-medium hover:bg-purple-100 transition-colors">📊 Laporan</a>}
                {job.suket_doc_url && <a href={job.suket_doc_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded-md font-medium hover:bg-emerald-100 transition-colors">🏆 Suket</a>}
              </div>

              {/* Move to next stage */}
              {nextStage && (
                <button
                  onClick={() => onMoveStage(job.id, nextStage)}
                  className="w-full flex items-center justify-center gap-1 text-[9px] font-bold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 py-1.5 rounded-lg border border-dashed border-slate-200 hover:border-indigo-200 transition-all cursor-pointer"
                >
                  Maju ke {nextStage} <ArrowRight className="h-2.5 w-2.5" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// MAIN INSPECTION PIPELINE MODULE
// ============================================================
interface InspectionPipelineModuleProps {
  jobs: InspectionJob[];
  manpowerList: Manpower[];
  activeUser: string;
  onRefresh: () => Promise<void>;
}

export default function InspectionPipelineModule({
  jobs, manpowerList, activeUser, onRefresh
}: InspectionPipelineModuleProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<InspectionJob | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Group jobs by stage
  const jobsByStage = useMemo(() => {
    const grouped: Record<InspectionStage, InspectionJob[]> = {
      'Penawaran': [], 'SPK Diterima': [], 'Penjadwalan': [], 'Pelaksanaan': [], 'Laporan': [], 'Suket Terbit': []
    };
    jobs.forEach(j => { if (grouped[j.stage]) grouped[j.stage].push(j); });
    return grouped;
  }, [jobs]);

  const stats = useMemo(() => {
    const done = jobs.filter(j => j.stage === 'Suket Terbit').length;
    const inProgress = jobs.filter(j => j.stage !== 'Suket Terbit').length;
    return { total: jobs.length, done, inProgress };
  }, [jobs]);

  const handleSave = async (jobData: Partial<InspectionJob>) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase tidak terkonfigurasi.');
    if (editingJob) {
      const { error } = await supabase.from('inspection_jobs').update({ ...jobData, updated_at: new Date().toISOString(), updated_by: activeUser }).eq('id', editingJob.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('inspection_jobs').insert([{ ...jobData, created_by: activeUser }]);
      if (error) throw new Error(error.message);
    }
    await onRefresh();
    setEditingJob(null);
    setIsFormOpen(false);
  };

  const handleDelete = async (jobId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from('inspection_jobs').delete().eq('id', jobId);
    if (error) { alert('Gagal hapus: ' + error.message); return; }
    await onRefresh();
  };

  const handleMoveStage = async (jobId: string, newStage: InspectionStage) => {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from('inspection_jobs').update({ stage: newStage, updated_at: new Date().toISOString(), updated_by: activeUser }).eq('id', jobId);
    if (error) { alert('Gagal pindah stage: ' + error.message); return; }
    await onRefresh();
  };

  const exportJobsCSV = () => {
    const rows = [['Nama PT', 'PIC', 'No WA', 'Nama Alat', 'Tipe', 'Stage', 'Jatuh Tempo', 'Rencana', 'Lead', 'Penawaran', 'SPK', 'Laporan', 'Suket']];
    jobs.forEach(j => {
      const lead = manpowerList.find(m => m.id === j.assigned_lead);
      rows.push([j.client_name, j.pic_name, j.pic_phone || '', j.equipment_name, j.equipment_type, j.stage, j.due_date || '', j.scheduled_date || '', lead?.name || '', j.offer_doc_url || '', j.spk_doc_url || '', j.report_doc_url || '', j.suket_doc_url || '']);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `progress_pemeriksaan_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Job Aktif', value: stats.total, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
          { label: 'Sedang Proses', value: stats.inProgress, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Suket Terbit', value: stats.done, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} className={`${bg} border ${border} rounded-2xl p-4`}>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`text-2xl font-black font-mono ${color} mt-1`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('kanban')}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'kanban' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
            🗂️ Kanban
          </button>
          <button onClick={() => setViewMode('table')}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
            📋 Tabel
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportJobsCSV}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer">
            <Download className="h-3.5 w-3.5" />Export
          </button>
          <button onClick={() => { setEditingJob(null); setIsFormOpen(true); }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer">
            <Plus className="h-3.5 w-3.5" />Tambah Job
          </button>
        </div>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4" style={{ minWidth: `${STAGES.length * 280}px` }}>
            {STAGES.map(stage => (
              <div key={stage} className="flex-1" style={{ minWidth: '260px' }}>
                <KanbanColumn
                  stage={stage}
                  jobs={jobsByStage[stage]}
                  manpowerList={manpowerList}
                  onEdit={job => { setEditingJob(job); setIsFormOpen(true); }}
                  onDelete={handleDelete}
                  onMoveStage={handleMoveStage}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {jobs.length === 0 ? (
            <div className="py-20 text-center">
              <ClipboardList className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">Belum ada job pemeriksaan</p>
              <p className="text-xs text-slate-300 mt-1">Job akan muncul otomatis saat status klien diubah ke "Deal" di modul Retensi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Klien & Alat', 'Stage', 'Jatuh Tempo', 'Rencana', 'Lead', 'Dokumen', 'Aksi'].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(job => {
                    const cfg = STAGE_CONFIG[job.stage];
                    const StageIcon = cfg.icon;
                    const lead = manpowerList.find(m => m.id === job.assigned_lead);
                    return (
                      <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold text-slate-800">{job.client_name}</p>
                          <p className="text-[9px] text-slate-400">{job.equipment_name} · {job.equipment_type}</p>
                          <p className="text-[9px] text-slate-400">{job.pic_name} {job.pic_phone ? `· ${job.pic_phone}` : ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                            <StageIcon className="h-3 w-3" />{job.stage}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-amber-600 font-medium">{formatDate(job.due_date)}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{formatDate(job.scheduled_date)}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{lead?.name || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {job.offer_doc_url && <a href={job.offer_doc_url} target="_blank" rel="noreferrer" className="text-[9px] bg-sky-50 text-sky-600 border border-sky-100 px-1.5 py-0.5 rounded-md font-medium">Penawaran</a>}
                            {job.spk_doc_url && <a href={job.spk_doc_url} target="_blank" rel="noreferrer" className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-md font-medium">SPK</a>}
                            {job.report_doc_url && <a href={job.report_doc_url} target="_blank" rel="noreferrer" className="text-[9px] bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-md font-medium">Laporan</a>}
                            {job.suket_doc_url && <a href={job.suket_doc_url} target="_blank" rel="noreferrer" className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded-md font-medium">Suket</a>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingJob(job); setIsFormOpen(true); }}
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg cursor-pointer"><Edit3 className="h-3 w-3" /></button>
                            <button onClick={() => { if (confirm('Hapus job?')) handleDelete(job.id); }}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg cursor-pointer"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <JobForm
            initial={editingJob || undefined}
            manpowerList={manpowerList}
            onClose={() => { setIsFormOpen(false); setEditingJob(null); }}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
