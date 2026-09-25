/**
 * InspectionPipelineModule.tsx
 * Modul: ⚙️ Progress Pemeriksaan (Pipeline Teknis & Operasional)
 * Mengelola pipeline pasca-deal hingga Suket terbit
 */

import React, { useState, useMemo } from 'react';
import {
  ClipboardList, FileText, Wrench, Calendar, CheckCircle2, Clock,
  Plus, Edit3, Trash2, ExternalLink, X, Save, RefreshCcw,
  ChevronRight, ArrowRight, Building2, Phone, AlertTriangle, Download, Handshake, Landmark, MessageSquare, Send
, FileSpreadsheet, Filter, Search} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InspectionJob, InspectionStage, Manpower, JobNote } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { exportInspectionToExcel, exportInspectionToPDF, filterByDate, MONTHS, YEARS } from '../lib/exportUtils';

const STAGES: InspectionStage[] = ['Penawaran', 'Negosiasi', 'Penjadwalan', 'Pelaksanaan', 'Laporan', 'Proses Disnaker', 'Suket Terbit'];

const STAGE_CONFIG: Record<InspectionStage, { icon: React.ElementType; color: string; bg: string; border: string; desc: string }> = {
  'Penawaran':       { icon: FileText,       color: 'text-sky-600',     bg: 'bg-sky-50',     border: 'border-sky-200',     desc: 'Draf penawaran dikirim ke klien' },
  'Negosiasi':       { icon: Handshake,      color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  desc: 'Proses negosiasi penawaran harga' },
  'Penjadwalan':     { icon: Calendar,       color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   desc: 'Tanggal pelaksanaan sedang dijadwalkan' },
  'Pelaksanaan':     { icon: Wrench,         color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200',  desc: 'Inspeksi/riksa uji sedang berlangsung' },
  'Laporan':         { icon: ClipboardList,  color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200',  desc: 'Laporan teknis sedang disusun' },
  'Proses Disnaker': { icon: Landmark,       color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200',    desc: 'Pengurusan berkas di dinas terkait' },
  'Suket Terbit':    { icon: CheckCircle2,   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', desc: 'Sertifikat Disnaker sudah terbit' },
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
  activeUser?: string;
  onClose: () => void;
  onSave: (job: Partial<InspectionJob>) => Promise<void>;
  onNoteToTask?: (note: JobNote) => void;
}

function JobForm({ initial, manpowerList = [], activeUser = 'Admin', onClose, onSave, onNoteToTask }: JobFormProps) {
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
  const [jobNotes, setJobNotes] = useState<JobNote[]>(() => {
    try {
      if (initial?.notes && initial.notes.startsWith('[')) {
        return JSON.parse(initial.notes);
      }
    } catch(e) {}
    if (initial?.notes) {
      return [{
        id: `note-legacy-${Date.now()}`,
        text: initial.notes,
        created_at: new Date().toISOString(),
        created_by: 'Sistem (Migrasi)'
      }];
    }
    return [];
  });
  const [newNoteText, setNewNoteText] = useState('');

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    const note: JobNote = {
      id: `note-${Date.now()}`,
      text: newNoteText.trim(),
      created_at: new Date().toISOString(),
      created_by: activeUser
    };
    setJobNotes([...jobNotes, note]);
    setNewNoteText('');
  };
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // if (!clientName.trim() || !eqName.trim()) { setError('Nama PT dan Nama Alat wajib diisi.'); return; }
    setError(''); setIsLoading(true);
    try {
      await onSave({
        ...(initial || {}),
        client_name: clientName, pic_name: picName, pic_phone: picPhone,
        equipment_name: eqName, equipment_type: eqType, stage,
        due_date: dueDate, scheduled_date: scheduledDate, completed_date: completedDate,
        assigned_lead: assignedLead, offer_doc_url: offerUrl,
        spk_doc_url: spkUrl, report_doc_url: reportUrl, suket_doc_url: suketUrl,
        notes: JSON.stringify(jobNotes),
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

            
            {/* DISCUSSION TIMELINE */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-indigo-500" /> Diskusi & Catatan Progres
              </h3>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-3">
                {jobNotes.length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-2">Belum ada catatan.</p>
                ) : (
                  jobNotes.map(n => (
                    <div key={n.id} className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm relative group">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[9px] font-bold text-slate-700">{n.created_by}</span>
                        <span className="text-[8px] text-slate-400">{new Date(n.created_at).toLocaleString('id-ID')}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">{n.text}</p>
                      
                      {n.linked_task_id ? (
                        <div className="mt-2 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-flex items-center gap-1 border border-emerald-100">
                          <CheckCircle2 className="h-3 w-3" /> Telah ditugaskan
                        </div>
                      ) : (
                        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => onNoteToTask && onNoteToTask(n)}
                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors inline-flex items-center gap-1 border border-indigo-100 cursor-pointer">
                            <Plus className="h-3 w-3" /> Jadikan Tugas
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input value={newNoteText} onChange={e => setNewNoteText(e.target.value)}
                  onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleAddNote(); } }}
                  placeholder="Ketik catatan baru..."
                  className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-300 outline-none" />
                <button type="button" onClick={handleAddNote} disabled={!newNoteText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

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
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  // Group jobs by stage
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchSearch = !search || job.client_name?.toLowerCase().includes(search.toLowerCase()) || job.equipment_name.toLowerCase().includes(search.toLowerCase());
      const matchDate = filterByDate(job.due_date, selectedMonth, selectedYear);
      return matchSearch && matchDate;
    });
  }, [jobs, search, selectedMonth, selectedYear]);

  const jobsByStage = useMemo(() => {
    const grouped: Record<InspectionStage, InspectionJob[]> = {
      'Penawaran': [], 'Negosiasi': [], 'Penjadwalan': [], 'Pelaksanaan': [], 'Laporan': [], 'Proses Disnaker': [], 'Suket Terbit': []
    };
    filteredJobs.forEach(j => { if (grouped[j.stage]) grouped[j.stage].push(j); });
    return grouped;
  }, [filteredJobs]);

  const stats = useMemo(() => {
    const done = jobs.filter(j => j.stage === 'Suket Terbit').length;
    const inProgress = jobs.filter(j => j.stage !== 'Suket Terbit').length;
    return { total: jobs.length, done, inProgress };
  }, [jobs]);

  
  const handleNoteToTask = async (note: JobNote) => {
    if (!editingJob) return;
    if (!isSupabaseConfigured || !supabase) {
      alert('Supabase tidak terkonfigurasi. Tidak dapat membuat tugas.');
      return;
    }

    try {
      // 1. Create a task in tasks table
      const taskData = {
        title: `Tindak Lanjut: ${editingJob.client_name} - ${editingJob.equipment_name}`,
        description: `Berdasarkan catatan diskusi pada tahap "${editingJob.stage}":\n\n"${note.text}"\n\nMohon segera ditindaklanjuti.`,
        assignee_id: editingJob.assigned_lead || manpowerList[0]?.id || '',
        assignee_ids: editingJob.assigned_lead ? [editingJob.assigned_lead] : (manpowerList[0] ? [manpowerList[0].id] : []),
        due_date: new Date().toISOString().split('T')[0],
        priority: 'P2',
        status: 'To Do',
        category: 'Follow Up',
        recurrence: 'None',
        visibility: 'Public',
        created_by: activeUser
      };

      const { data: newTask, error: taskError } = await supabase.from('team_tasks').insert([taskData]).select('id').single();
      if (taskError) throw new Error(taskError.message);

      // 2. Update the note in the current job
      let currentNotes = [];
      try {
        if (editingJob.notes && editingJob.notes.startsWith('[')) {
          currentNotes = JSON.parse(editingJob.notes);
        }
      } catch(e) {}
      
      const updatedNotes = currentNotes.map((n: JobNote) => 
        n.id === note.id ? { ...n, linked_task_id: newTask.id } : n
      );

      // 3. Update the job's notes in DB
      const { error: jobError } = await supabase.from('inspection_jobs')
        .update({ notes: JSON.stringify(updatedNotes) })
        .eq('id', editingJob.id);

      if (jobError) throw new Error(jobError.message);

      // 4. Close form and refresh to reflect changes
      setIsFormOpen(false);
      setEditingJob(null);
      await onRefresh();
      alert('Tugas berhasil dibuat dan ditautkan!');
      
    } catch (err: any) {
      alert('Gagal membuat tugas: ' + err.message);
    }
  };

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button onClick={() => setViewMode('kanban')}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${viewMode === 'kanban' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
            🗂️ Kanban
          </button>
          <button onClick={() => setViewMode('table')}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
            📋 Tabel
          </button>
        </div>

        <div className="flex flex-1 items-center gap-2 w-full sm:max-w-md">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari PT atau Alat..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none bg-slate-50"
            />
          </div>

          {/* Month Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="pl-9 pr-8 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none bg-slate-50 appearance-none font-bold text-slate-700 cursor-pointer"
            >
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          {/* Year Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="pl-9 pr-8 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none bg-slate-50 appearance-none font-bold text-slate-700 cursor-pointer"
            >
              {YEARS.map(y => (
                <option key={y.value} value={y.value}>{y.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => {
              const mLabel = MONTHS.find(m => m.value === selectedMonth)?.label || 'Semua';
              const yLabel = selectedYear === 'all' ? 'Semua' : selectedYear;
              exportInspectionToExcel(filteredJobs, manpowerList, `${mLabel}_${yLabel}`);
            }}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap">
            <FileSpreadsheet className="h-3.5 w-3.5" />Export Excel
          </button>
          <button onClick={() => {
              const mLabel = MONTHS.find(m => m.value === selectedMonth)?.label || 'Semua';
              const yLabel = selectedYear === 'all' ? 'Semua' : selectedYear;
              exportInspectionToPDF(filteredJobs, manpowerList, `${mLabel}_${yLabel}`);
            }}
            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap">
            <FileText className="h-3.5 w-3.5" />Export PDF
          </button>
          <button onClick={() => { setEditingJob(null); setIsFormOpen(true); }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap">
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
            activeUser={activeUser}
            onClose={() => { setIsFormOpen(false); setEditingJob(null); }}
            onSave={handleSave}
            onNoteToTask={handleNoteToTask}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
