/**
 * RetentionModule.tsx
 * Modul: 🔁 Retensi & Follow-Up Klien
 * Early Warning System untuk Tim Komersial PT Aksara Riksa Perdana
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, TrendingDown, TrendingUp,
  Plus, Download, Upload, Search, Filter, MessageCircle,
  FileText, FileSpreadsheet, ChevronDown, ChevronRight, Edit3, Trash2, History,
  Eye, X, Save, RefreshCcw, ExternalLink, Phone, Building2,
  Wrench, Calendar, Bell, ArrowRight, MoreHorizontal, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RetentionClient, ClientEquipment, FollowUpLog,
  FollowUpStage, FollowUpStatus, UrgencyLevel, InspectionJob
} from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { exportRetentionToExcel, exportRetentionToPDF, filterByDate, MONTHS, YEARS } from '../lib/exportUtils';

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function getDaysUntilDue(dueDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgency(equipment: ClientEquipment, latestLog?: FollowUpLog): UrgencyLevel {
  const status = latestLog?.status;
  if (status === 'Deal (Lanjut)') return 'deal';
  if (status === 'Lost (Lepas)') return 'lost';

  const days = getDaysUntilDue(equipment.due_date);
  if (days < 0) return 'overdue';
  if (days <= 30) return 'critical';
  if (days <= 90) return 'warning';
  return 'safe';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const URGENCY_CONFIG: Record<UrgencyLevel, { label: string; color: string; bg: string; border: string; dot: string; textColor: string }> = {
  overdue:  { label: '☠️ LEWAT TEMPO', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-300', dot: 'bg-purple-500', textColor: 'text-purple-800' },
  critical: { label: '🔴 Kritis H-30',  color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-300',    dot: 'bg-red-500',    textColor: 'text-red-800'    },
  warning:  { label: '🟡 Siaga H-90',   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-300',  dot: 'bg-amber-500',  textColor: 'text-amber-800'  },
  safe:     { label: '🟢 Aman',         color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200',dot: 'bg-emerald-500',textColor: 'text-emerald-800'},
  deal:     { label: '✅ Deal (Lanjut)',  color: 'text-sky-700',   bg: 'bg-sky-50',    border: 'border-sky-200',    dot: 'bg-sky-500',    textColor: 'text-sky-800'    },
  lost:     { label: '❌ Lost (Lepas)',  color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200',  dot: 'bg-slate-400',  textColor: 'text-slate-700'  },
};

const EQUIPMENT_TYPES = ['PTP', 'PAA', 'Elevator & Eskalator', 'PUBT', 'Instalasi Listrik', 'Angkur & TKPK', 'Lainnya'];
const STAGES: FollowUpStage[] = ['FU 1', 'FU 2', 'FU 3'];
const STATUSES: FollowUpStatus[] = ['Pending', 'Contacted', 'Minta Mundur', 'Deal (Lanjut)', 'Lost (Lepas)'];

// ============================================================
// WA TEMPLATE
// ============================================================
function buildWAMessage(client: RetentionClient, equipment: ClientEquipment): string {
  const msg = `Selamat siang ${client.pic_name}, saya dari Komersial PT Aksara Riksa Perdana. Izin menginformasikan riksa uji berkala alat *${equipment.equipment_name}* di *${client.client_name}* akan jatuh tempo pada *${formatDate(equipment.due_date)}*. Apakah berkenan kami kirimkan draf penawarannya?`;
  return encodeURIComponent(msg);
}

function openWhatsApp(client: RetentionClient, equipment: ClientEquipment) {
  const phone = client.pic_phone.replace(/\D/g, '');
  const normalized = phone.startsWith('0') ? '62' + phone.slice(1) : phone.startsWith('62') ? phone : '62' + phone;
  const msg = buildWAMessage(client, equipment);
  window.open(`https://wa.me/${normalized}?text=${msg}`, '_blank');
}

// ============================================================
// EXPORT CSV
// ============================================================
function exportToCSV(clients: RetentionClient[], equipments: ClientEquipment[], logs: FollowUpLog[]) {
  const logMap = new Map<string, FollowUpLog>();
  logs.forEach(l => {
    const key = l.equipment_id || l.client_id;
    if (!logMap.has(key) || new Date(l.created_at || 0) > new Date(logMap.get(key)!.created_at || 0)) {
      logMap.set(key, l);
    }
  });

  const rows: string[][] = [
    ['Nama PT', 'Nama PIC', 'No WA', 'Nama Alat', 'Tipe', 'No. Suket', 'Tgl Pemeriksaan Terakhir', 'Jatuh Tempo', 'Sisa Hari', 'Stage', 'Status', 'Catatan', 'Dokumen Penawaran']
  ];

  clients.forEach(client => {
    const clientEquipments = equipments.filter(e => e.client_id === client.id);
    if (clientEquipments.length === 0) {
      rows.push([client.client_name, client.pic_name, client.pic_phone, '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']);
    } else {
      clientEquipments.forEach(eq => {
        const log = logMap.get(eq.id) || logMap.get(client.id);
        const days = getDaysUntilDue(eq.due_date);
        rows.push([
          client.client_name,
          client.pic_name,
          client.pic_phone,
          eq.equipment_name,
          eq.equipment_type,
          eq.certificate_number || '-',
          formatDate(eq.last_inspection_date),
          formatDate(eq.due_date),
          days < 0 ? `LEWAT ${Math.abs(days)} hari` : `H-${days}`,
          log?.stage || '-',
          log?.status || 'Pending',
          (log?.notes || '').replace(/,/g, ';'),
          log?.offer_doc_url || '-',
        ]);
      });
    }
  });

  const csv = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `retensi_klien_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// IMPORT CSV MODAL
// ============================================================
interface ImportCSVModalProps {
  onClose: () => void;
  onImport: (clients: Partial<RetentionClient>[], equipments: Partial<ClientEquipment>[]) => Promise<void>;
}

function ImportCSVModal({ onClose, onImport }: ImportCSVModalProps) {
  const [preview, setPreview] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());
        // Auto-detect separator
        const sep = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(sep).map(h => h.replace(/"/g, '').trim().toLowerCase());
        const rows = lines.slice(1).map(line => {
          const vals = line.split(sep).map(v => v.replace(/"/g, '').trim());
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
          return obj;
        }).filter(r => r['nama pt'] || r['client_name'] || r['nama perusahaan']);
        setPreview(rows);
      } catch (err) {
        setError('Gagal membaca file. Pastikan format CSV valid.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    setIsLoading(true);
    try {
      const clients: Partial<RetentionClient>[] = [];
      const equipments: Partial<ClientEquipment>[] = [];

      preview.forEach((row, i) => {
        const clientName = row['nama pt'] || row['client_name'] || row['nama perusahaan'] || `Klien #${i+1}`;
        const picName = row['nama pic'] || row['pic_name'] || row['pic'] || '-';
        const picPhone = row['no wa'] || row['pic_phone'] || row['no_wa'] || row['telepon'] || '-';
        const eqName = row['nama alat'] || row['equipment_name'] || row['alat'] || '';
        const eqType = row['tipe'] || row['equipment_type'] || row['jenis'] || 'Lainnya';
        const lastDate = row['tgl pemeriksaan'] || row['last_inspection_date'] || row['tanggal riksa'] || '';
        const dueDate = row['jatuh tempo'] || row['due_date'] || (lastDate ? addDays(lastDate, 365) : '');
        const certNo = row['no suket'] || row['certificate_number'] || row['no_suket'] || '';

        let client = clients.find(c => c.client_name?.toLowerCase() === clientName.toLowerCase());
        if (!client) {
          client = { id: `import-${Date.now()}-${i}`, client_name: clientName, pic_name: picName, pic_phone: picPhone };
          clients.push(client);
        }

        if (eqName) {
          equipments.push({
            client_id: client.id,
            equipment_name: eqName,
            equipment_type: eqType,
            last_inspection_date: lastDate || new Date().toISOString().split('T')[0],
            due_date: dueDate || addDays(new Date().toISOString().split('T')[0], 365),
            certificate_number: certNo,
          });
        }
      });

      await onImport(clients, equipments);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal mengimpor data.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-black text-slate-800">📥 Import Data Klien dari CSV</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">Kolom yang dikenali: Nama PT, Nama PIC, No WA, Nama Alat, Tipe, Tgl Pemeriksaan, Jatuh Tempo, No Suket</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"><X className="h-4 w-4 text-slate-500" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Template download */}
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-sky-800">Download Template CSV</p>
              <p className="text-[10px] text-sky-600">Gunakan template ini agar format kolom sesuai</p>
            </div>
            <button
              onClick={() => {
                const header = 'Nama PT,Nama PIC,No WA,Nama Alat,Tipe,Tgl Pemeriksaan,Jatuh Tempo,No Suket\n';
                const example = 'PT Contoh Jaya,Bpk. Budi,081234567890,Forklift 5 Ton,PAA,2024-10-01,2025-10-01,PK.04/1234/X/2024\n';
                const blob = new Blob(['\ufeff' + header + example], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'template_import_klien.csv'; a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer shrink-0"
            >
              <Download className="h-3.5 w-3.5" />Template
            </button>
          </div>

          {/* File input */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-xl p-8 text-center cursor-pointer transition-colors group"
          >
            <Upload className="h-8 w-8 text-slate-300 group-hover:text-emerald-400 mx-auto mb-2 transition-colors" />
            <p className="text-xs font-bold text-slate-500 group-hover:text-emerald-600 transition-colors">Klik untuk upload file CSV / Excel</p>
            <p className="text-[10px] text-slate-400 mt-1">Format: .csv (separator koma atau titik koma)</p>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {/* Preview table */}
          {preview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-700">{preview.length} baris terdeteksi</p>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{preview.length} klien/alat</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-[10px] text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      {Object.keys(preview[0]).slice(0, 8).map(h => (
                        <th key={h} className="px-2 py-2 font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                        {Object.values(row).slice(0, 8).map((v: any, j) => (
                          <td key={j} className="px-2 py-1.5 text-slate-700 max-w-[120px] truncate">{v}</td>
                        ))}
                      </tr>
                    ))}
                    {preview.length > 5 && (
                      <tr className="border-t border-slate-100 bg-slate-50">
                        <td colSpan={8} className="px-2 py-1.5 text-center text-slate-400 text-[10px]">
                          ...dan {preview.length - 5} baris lainnya
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-100 transition-all cursor-pointer">Batal</button>
          <button
            onClick={handleImport}
            disabled={preview.length === 0 || isLoading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-5 py-2 rounded-xl transition-all cursor-pointer"
          >
            {isLoading ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Import {preview.length} Data
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================
// LOG HISTORY MODAL
// ============================================================
interface LogHistoryModalProps {
  client: RetentionClient;
  equipment: ClientEquipment;
  logs: FollowUpLog[];
  onClose: () => void;
  onAddLog: (log: Partial<FollowUpLog>) => Promise<void>;
  activeUser: string;
}

function LogHistoryModal({ client, equipment, logs, onClose, onAddLog, activeUser }: LogHistoryModalProps) {
  const [newNote, setNewNote] = useState('');
  const [newStage, setNewStage] = useState<FollowUpStage>('FU 1');
  const [newStatus, setNewStatus] = useState<FollowUpStatus>('Contacted');
  const [offerUrl, setOfferUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const eqLogs = logs
    .filter(l => l.equipment_id === equipment.id || (!l.equipment_id && l.client_id === client.id))
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      await onAddLog({
        client_id: client.id,
        equipment_id: equipment.id,
        stage: newStage,
        status: newStatus,
        notes: newNote,
        offer_doc_url: offerUrl,
        contacted_by: activeUser,
        contacted_at: new Date().toISOString(),
      });
      setNewNote(''); setOfferUrl('');
    } finally { setIsLoading(false); }
  };

  const statusColors: Record<FollowUpStatus, string> = {
    'Pending': 'bg-slate-100 text-slate-600',
    'Contacted': 'bg-blue-100 text-blue-700',
    'Minta Mundur': 'bg-amber-100 text-amber-700',
    'Deal (Lanjut)': 'bg-emerald-100 text-emerald-700',
    'Lost (Lepas)': 'bg-red-100 text-red-700',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-black text-slate-800">📋 Riwayat Follow-Up</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">{equipment.equipment_name} — {client.client_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer"><X className="h-4 w-4 text-slate-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Histori */}
          {eqLogs.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Belum ada riwayat follow-up</p>
            </div>
          ) : (
            <div className="space-y-2">
              {eqLogs.map((log) => (
                <div key={log.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{log.stage}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[log.status]}`}>{log.status}</span>
                    </div>
                    <span className="text-[9px] text-slate-400">{log.contacted_at ? new Date(log.contacted_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                  </div>
                  {log.notes && <p className="text-[11px] text-slate-600 leading-relaxed">{log.notes}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-slate-400">oleh {log.contacted_by || 'Admin'}</span>
                    {log.offer_doc_url && (
                      <a href={log.offer_doc_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-[10px] text-sky-600 hover:text-sky-800 font-medium transition-colors">
                        <FileText className="h-3 w-3" />Lihat Penawaran
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Form tambah log baru */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500">+ Catat Follow-Up Baru</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1 block">Stage</label>
                <select value={newStage} onChange={e => setNewStage(e.target.value as FollowUpStage)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-indigo-300 outline-none cursor-pointer">
                  {STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1 block">Status</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value as FollowUpStatus)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-indigo-300 outline-none cursor-pointer">
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Catatan / respon dari klien..."
              rows={2}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-indigo-300 outline-none"
            />
            <input
              value={offerUrl}
              onChange={e => setOfferUrl(e.target.value)}
              placeholder="Link Google Drive Penawaran (opsional)"
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-300 outline-none"
            />
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Simpan Log
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================
// DEAL CONFIRM MODAL
// ============================================================
interface DealConfirmModalProps {
  client: RetentionClient;
  equipment: ClientEquipment;
  onConfirm: () => void;
  onCreateJob: () => void;
  onClose: () => void;
}

function DealConfirmModal({ client, equipment, onConfirm, onCreateJob, onClose }: DealConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 p-6 text-white text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-lg font-black">Deal Berhasil!</h2>
          <p className="text-xs text-emerald-100 mt-1">{equipment.equipment_name} — {client.client_name}</p>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 text-center leading-relaxed">
            Status telah diubah ke <strong>Deal (Lanjut)</strong>. Selanjutnya, ingin langsung membuat job di <strong>Progress Pemeriksaan</strong>?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onConfirm}
              className="flex flex-col items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold p-4 rounded-xl transition-all cursor-pointer"
            >
              <CheckCircle2 className="h-5 w-5 text-slate-500" />
              <span>Simpan Saja</span>
              <span className="text-[9px] font-normal text-slate-400">Buat job nanti</span>
            </button>
            <button
              onClick={onCreateJob}
              className="flex flex-col items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold p-4 rounded-xl transition-all cursor-pointer shadow-md"
            >
              <ArrowRight className="h-5 w-5" />
              <span>Buat Job Langsung</span>
              <span className="text-[9px] font-normal text-emerald-200">Auto-fill data klien</span>
            </button>
          </div>
          <button onClick={onClose} className="w-full text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">Batal</button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================
// FOLLOW-UP FORM MODAL (CRUD klien + equipment)
// ============================================================
interface FollowUpFormProps {
  initialClient?: RetentionClient;
  initialEquipment?: ClientEquipment;
  onClose: () => void;
  onSave: (client: Partial<RetentionClient>, equipment: Partial<ClientEquipment>) => Promise<void>;
}

function FollowUpForm({ initialClient, initialEquipment, onClose, onSave }: FollowUpFormProps) {
  const [clientName, setClientName] = useState(initialClient?.client_name || '');
  const [picName, setPicName] = useState(initialClient?.pic_name || '');
  const [picPhone, setPicPhone] = useState(initialClient?.pic_phone || '');
  const [picEmail, setPicEmail] = useState(initialClient?.pic_email || '');
  const [driveUrl, setDriveUrl] = useState(initialClient?.drive_folder_url || '');
  const [clientNotes, setClientNotes] = useState(initialClient?.notes || '');

  const COMMON_K3_TOOLS = [
    'Elevator', 'Eskalator', 'Forklift', 'Overhead Crane', 'Hoist',
    'Loader', 'Excavator', 'Gondola', 'Instalasi Penyalur Petir',
    'Instalasi Listrik', 'Motor Diesel / Genset', 'Boiler', 'Bejana Tekan',
    'Tangki Timbun', 'Compressor'
  ];

  const [historyTerms, setHistoryTerms] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('equipment_history') || '[]');
    } catch {
      return [];
    }
  });

  const [eqInputs, setEqInputs] = useState<{name: string, type: string}[]>(
    initialEquipment 
      ? [{name: initialEquipment.equipment_name, type: initialEquipment.equipment_type || 'PAA'}] 
      : [{name: '', type: 'PAA'}]
  );
  const [activeEqIndex, setActiveEqIndex] = useState<number | null>(null);
  const [showEqSuggestions, setShowEqSuggestions] = useState(false);

  const eqSuggestions = useMemo(() => {
    if (activeEqIndex === null) return [];
    const val = eqInputs[activeEqIndex].name.toLowerCase();
    
    const allTerms = Array.from(new Set([...COMMON_K3_TOOLS, ...historyTerms]));
    
    if (!val) return allTerms.slice(0, 8);
    
    const matches = allTerms.filter(t => t.toLowerCase().includes(val));
    matches.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aStarts = aLower.startsWith(val);
      const bStarts = bLower.startsWith(val);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    });
    return matches.slice(0, 15);
  }, [eqInputs, activeEqIndex, historyTerms]);

  const handleEqNameChange = (index: number, val: string) => {
    const newArr = [...eqInputs];
    newArr[index] = { ...newArr[index], name: val };
    setEqInputs(newArr);
  };
  
  const handleEqTypeChange = (index: number, val: string) => {
    const newArr = [...eqInputs];
    newArr[index] = { ...newArr[index], type: val };
    setEqInputs(newArr);
  };

  const handleAddEqRow = () => setEqInputs(prev => [...prev, {name: '', type: 'PAA'}]);
  const handleRemoveEqRow = (index: number) => {
    if (eqInputs.length > 1) setEqInputs(prev => prev.filter((_, i) => i !== index));
  };
  const handleDuplicateEqRow = (index: number) => {
    const newArr = [...eqInputs];
    newArr.splice(index + 1, 0, newArr[index]);
    setEqInputs(newArr);
  };
  const selectEqSuggestion = (val: string) => {
    if (activeEqIndex !== null) {
      handleEqNameChange(activeEqIndex, val);
      setShowEqSuggestions(false);
    }
  };
  const handleAppendChip = (chip: string) => {
    if (activeEqIndex !== null) {
      const current = eqInputs[activeEqIndex].name;
      handleEqNameChange(activeEqIndex, current ? `${current} ${chip}` : chip);
    }
  };

  const [lastDate, setLastDate] = useState(initialEquipment?.last_inspection_date || '');
  const [dueDate, setDueDate] = useState(initialEquipment?.due_date || '');
  const [certNo, setCertNo] = useState(initialEquipment?.certificate_number || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLastDateChange = (val: string) => {
    setLastDate(val);
    if (val) setDueDate(addDays(val, 365));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) { setError('Nama PT wajib diisi.'); return; }
    if (eqInputs.filter(n => n.name.trim()).length === 0) { setError('Minimal isi 1 Nama Alat.'); return; }
    if (!lastDate) { setError('Tanggal pemeriksaan terakhir wajib diisi.'); return; }
    setError(''); setIsLoading(true);
    try {
      const equipmentsArray = eqInputs.filter(n => n.name.trim()).map(input => ({
        ...(initialEquipment || {}),
        equipment_name: input.name.trim(),
        equipment_type: input.type,
        last_inspection_date: lastDate,
        due_date: dueDate,
        certificate_number: certNo
      }));

      // Update history
      const newTerms = eqInputs.filter(n => n.name.trim()).map(i => i.name.trim());
      const updatedHistory = Array.from(new Set([...newTerms, ...historyTerms])).slice(0, 50);
      localStorage.setItem('equipment_history', JSON.stringify(updatedHistory));

      await onSave(
        { ...(initialClient || {}), client_name: clientName.trim(), pic_name: picName, pic_phone: picPhone, pic_email: picEmail, drive_folder_url: driveUrl, notes: clientNotes },
        equipmentsArray
      );
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data.');
    } finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="bg-white w-full sm:max-w-xl sm:rounded-2xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '95vh' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
          <div>
            <h2 className="text-sm font-black">{initialClient ? '✏️ Edit Data Klien' : '➕ Tambah Klien & Alat'}</h2>
            <p className="text-[10px] text-slate-300 mt-0.5">Isi data klien dan informasi alat yang akan dipantau</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto" style={{ maxHeight: 'calc(95vh - 120px)' }}>
          <div className="p-5 space-y-5">
            {/* Client Section */}
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" /> Data Perusahaan & PIC
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Nama Perusahaan (PT) *</label>
                  <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="PT Contoh Jaya Abadi"
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-300 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Nama PIC</label>
                    <input value={picName} onChange={e => setPicName(e.target.value)} placeholder="Bpk. Budi Santoso"
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-300 outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">No. WhatsApp PIC</label>
                    <input value={picPhone} onChange={e => setPicPhone(e.target.value)} placeholder="08123456789" type="tel"
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-300 outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Email PIC (opsional)</label>
                    <input value={picEmail} onChange={e => setPicEmail(e.target.value)} placeholder="pic@perusahaan.com" type="email"
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-300 outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
                      <ExternalLink className="h-2.5 w-2.5 text-sky-500" />Link Folder Drive
                    </label>
                    <input value={driveUrl} onChange={e => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/..."
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-sky-300 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Catatan Klien (opsional)</label>
                  <textarea value={clientNotes} onChange={e => setClientNotes(e.target.value)} placeholder="Catatan khusus tentang klien ini..." rows={2}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:ring-2 focus:ring-emerald-300 outline-none" />
                </div>
              </div>
            </div>

            {/* Equipment Section */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                <Wrench className="h-3.5 w-3.5" /> Data Alat
              </h3>
              <div className="space-y-3">
                
                {/* Dynamic Equipment Array */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Daftar Nama Alat & Jenis *</label>
                    <span className="text-[10px] text-slate-400 font-medium">{eqInputs.filter(d => d.name.trim() !== '').length} terisi</span>
                  </div>

                  {!initialEquipment && (
                    <div className="flex flex-wrap gap-1.5 mb-2 bg-slate-50/50 p-1.5 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-extrabold text-slate-400 self-center uppercase mr-1 ml-1">Template Chips:</span>
                      {[
                        { label: '+ Merek', value: 'Merek' },
                        { label: '+ Kapas', value: 'Kapasitas' },
                        { label: '+ No.Seri', value: 'No.Seri' }
                      ].map(chip => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => handleAppendChip(chip.value)}
                          className="px-2 py-1 text-[9px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 rounded-md transition-all active:scale-95"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2 max-h-48 overflow-y-auto p-1">
                    {eqInputs.map((item, index) => (
                      <div key={index} className="flex gap-2 relative bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                        <div className="flex-1 space-y-2 relative">
                          <input
                            type="text"
                            value={item.name}
                            onChange={e => handleEqNameChange(index, e.target.value)}
                            onFocus={() => { setActiveEqIndex(index); setShowEqSuggestions(true); }}
                            onBlur={() => setTimeout(() => setShowEqSuggestions(false), 250)}
                            placeholder="Misal: Forklift 5 Ton Unit-01"
                            className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-300 outline-none bg-white"
                          />
                          
                          {activeEqIndex === index && showEqSuggestions && eqSuggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-11 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto divide-y divide-slate-50">
                              {eqSuggestions.map(tool => (
                                <button
                                  key={tool}
                                  type="button"
                                  onMouseDown={() => selectEqSuggestion(tool)}
                                  className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 text-slate-800 text-xs font-bold transition-colors"
                                >
                                  {tool}
                                </button>
                              ))}
                            </div>
                          )}
                          
                          <select value={item.type} onChange={e => handleEqTypeChange(index, e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-emerald-300 outline-none cursor-pointer">
                            {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        
                        {!initialEquipment && (
                          <div className="flex flex-col gap-1 justify-center">
                            <button type="button" onClick={() => handleDuplicateEqRow(index)} title="Duplikat"
                              className="p-2 bg-white hover:bg-emerald-50 text-slate-600 border border-slate-200 rounded-lg transition-all h-[32px] w-[32px] flex items-center justify-center">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => handleRemoveEqRow(index)} title="Hapus"
                              className="p-2 bg-white text-rose-600 border border-slate-200 hover:bg-rose-50 rounded-lg transition-all h-[32px] w-[32px] flex items-center justify-center disabled:opacity-50"
                              disabled={eqInputs.length === 1}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {!initialEquipment && (
                    <button type="button" onClick={handleAddEqRow}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 mt-2 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors w-full justify-center border border-emerald-100">
                      <Plus className="h-3.5 w-3.5" /> Tambah Baris Alat Lainnya
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 mt-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">No. Suket Disnaker</label>
                    <input value={certNo} onChange={e => setCertNo(e.target.value)} placeholder="PK.04/1234/X/2024"
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-300 outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" /> Tgl Pemeriksaan Terakhir *
                    </label>
                    <input type="date" value={lastDate} onChange={e => handleLastDateChange(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-300 outline-none cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-2.5 w-2.5 text-amber-500" /> Jatuh Tempo (auto +1 tahun)
                    </label>
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-300 outline-none cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
          </div>

          <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3 bg-slate-50">
            <button type="button" onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-100 transition-all cursor-pointer">Batal</button>
            <button type="submit" disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer shadow-md">
              {isLoading ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {initialClient ? 'Simpan Perubahan' : 'Tambah Klien & Alat'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
// ============================================================
// EQUIPMENT ROW
// ============================================================
interface EquipmentRowProps {
  key?: React.Key;
  client: RetentionClient;
  equipment: ClientEquipment;
  logs: FollowUpLog[];
  activeUser: string;
  onOpenLog: (c: RetentionClient, e: ClientEquipment) => void;
  onEditEquipment: (c: RetentionClient, e: ClientEquipment) => void;
  onDeleteEquipment: (equipmentId: string) => void;
  onStatusChange: (equipmentId: string, clientId: string, status: FollowUpStatus, stage: FollowUpStage) => Promise<void>;
  selectedEquipmentIds?: string[];
  onToggleSelectEquipment?: (id: string) => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

function EquipmentRow({ client, equipment, logs, activeUser, onOpenLog, onEditEquipment, onDeleteEquipment, onStatusChange, isSelected, onToggleSelect }: EquipmentRowProps) {
  const latestLog = useMemo(() => {
    return logs
      .filter(l => l.equipment_id === equipment.id || (!l.equipment_id && l.client_id === client.id))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
  }, [logs, equipment.id, client.id]);

  const urgency = getUrgency(equipment, latestLog);
  const days = getDaysUntilDue(equipment.due_date);
  const uc = URGENCY_CONFIG[urgency];
  const [statusLoading, setStatusLoading] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const handleStatusChange = async (status: FollowUpStatus) => {
    setStatusLoading(true);
    setShowActions(false);
    try {
      await onStatusChange(equipment.id, client.id, status, latestLog?.stage || 'FU 1');
    } finally { setStatusLoading(false); }
  };

  const countdownDisplay = () => {
    if (urgency === 'deal') return <span className="text-emerald-600 font-bold">✅ Deal</span>;
    if (urgency === 'lost') return <span className="text-slate-400 font-bold">❌ Lost</span>;
    if (days < 0) return <span className="text-purple-700 font-black">H+{Math.abs(days)}</span>;
    return <span className={`font-black ${urgency === 'critical' ? 'text-red-600' : urgency === 'warning' ? 'text-amber-600' : 'text-emerald-600'}`}>H-{days}</span>;
  };

  return (
    <tr className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors group ${urgency === 'critical' ? 'bg-red-50/30' : urgency === 'overdue' ? 'bg-purple-50/30' : ''}`}>
      {/* Equipment name + type */}
      <td className="px-3 py-2.5 pl-8">
        <div className="flex items-start gap-2">
          {onToggleSelect && (
            <div className="mt-0.5" onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={isSelected} onChange={onToggleSelect} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer h-3.5 w-3.5" />
            </div>
          )}
          <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${uc.dot} ${urgency === 'critical' || urgency === 'overdue' ? 'animate-pulse' : ''}`} />
          <div>
            <p className="text-xs font-bold text-slate-700">{equipment.equipment_name}</p>
            <p className="text-[9px] text-slate-400">{equipment.equipment_type} {equipment.certificate_number ? `· ${equipment.certificate_number}` : ''}</p>
          </div>
        </div>
      </td>
      {/* Due date */}
      <td className="px-3 py-2.5">
        <div>
          <p className="text-xs text-slate-700 font-medium">{formatDate(equipment.due_date)}</p>
          <p className="text-[9px] text-slate-400">Riksa: {formatDate(equipment.last_inspection_date)}</p>
        </div>
      </td>
      {/* Countdown */}
      <td className="px-3 py-2.5 text-xs font-mono">{countdownDisplay()}</td>
      {/* Urgency badge */}
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${uc.bg} ${uc.border} ${uc.textColor}`}>
          {uc.label}
        </span>
      </td>
      {/* Stage & Status */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {latestLog && <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">{latestLog.stage}</span>}
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              disabled={statusLoading}
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-all flex items-center gap-1 ${
                latestLog?.status === 'Deal (Lanjut)' ? 'bg-emerald-100 text-emerald-700' :
                latestLog?.status === 'Lost (Lepas)' ? 'bg-slate-100 text-slate-500' :
                latestLog?.status === 'Contacted' ? 'bg-blue-100 text-blue-700' :
                latestLog?.status === 'Minta Mundur' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-500'
              }`}
            >
              {statusLoading ? <RefreshCcw className="h-2.5 w-2.5 animate-spin" /> : null}
              {latestLog?.status || 'Pending'}
              <ChevronDown className="h-2.5 w-2.5 opacity-60" />
            </button>
            <AnimatePresence>
              {showActions && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[140px]">
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => handleStatusChange(s)}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50 cursor-pointer font-medium first:rounded-t-xl last:rounded-b-xl">
                      {s}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {latestLog?.notes && <p className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[120px]" title={latestLog.notes}>{latestLog.notes}</p>}
      </td>
      {/* Offer doc */}
      <td className="px-3 py-2.5">
        {latestLog?.offer_doc_url ? (
          <a href={latestLog.offer_doc_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-[10px] text-sky-600 hover:text-sky-800 font-medium transition-colors">
            <FileText className="h-3 w-3" />Penawaran
          </a>
        ) : <span className="text-[10px] text-slate-300">—</span>}
      </td>
      {/* Actions */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* WA Button */}
          <button
            onClick={() => openWhatsApp(client, equipment)}
            className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all cursor-pointer"
            title="Kirim WhatsApp"
          >
            <MessageCircle className="h-3 w-3" />
          </button>
          {/* Log History */}
          <button
            onClick={() => onOpenLog(client, equipment)}
            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-all cursor-pointer"
            title="Riwayat Follow-Up"
          >
            <History className="h-3 w-3" />
          </button>
          {/* Edit */}
          <button
            onClick={() => onEditEquipment(client, equipment)}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg transition-all cursor-pointer"
            title="Edit"
          >
            <Edit3 className="h-3 w-3" />
          </button>
          {/* Delete */}
          <button
            onClick={() => onDeleteEquipment(equipment.id)}
            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-all cursor-pointer"
            title="Hapus"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ============================================================
// CLIENT GROUP ROW (expandable)
// ============================================================
interface ClientGroupRowProps {
  key?: React.Key;
  client: RetentionClient;
  equipments: ClientEquipment[];
  logs: FollowUpLog[];
  activeUser: string;
  onOpenLog: (c: RetentionClient, e: ClientEquipment) => void;
  onEditEquipment: (c: RetentionClient, e: ClientEquipment) => void;
  onDeleteEquipment: (equipmentId: string) => void;
  onAddEquipment: (client: RetentionClient) => void;
  onEditClient: (client: RetentionClient) => void;
  onDeleteClient: (clientId: string) => void;
  onStatusChange: (equipmentId: string, clientId: string, status: FollowUpStatus, stage: FollowUpStage) => Promise<void>;
  defaultExpanded?: boolean;
}

function ClientGroupRow({
  client, equipments, logs, activeUser,
  onOpenLog, onEditEquipment, onDeleteEquipment, onAddEquipment,
  onEditClient, onDeleteClient, onStatusChange, defaultExpanded = false
, selectedEquipmentIds, onToggleSelectEquipment }: ClientGroupRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const worstUrgency: UrgencyLevel = useMemo(() => {
    if (equipments.length === 0) return 'safe';
    const priority: UrgencyLevel[] = ['overdue', 'critical', 'warning', 'safe', 'deal', 'lost'];
    for (const lvl of priority) {
      if (equipments.some(eq => {
        const latestLog = logs.filter(l => l.equipment_id === eq.id || (!l.equipment_id && l.client_id === client.id))
          .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
        return getUrgency(eq, latestLog) === lvl;
      })) return lvl;
    }
    return 'safe';
  }, [equipments, logs, client.id]);

  const uc = URGENCY_CONFIG[worstUrgency];
  const dealCount = equipments.filter(eq => {
    const l = logs.filter(l => l.equipment_id === eq.id).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
    return l?.status === 'Deal (Lanjut)';
  }).length;

  return (
    <>
      <tr
        className={`border-b border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors ${worstUrgency === 'critical' ? 'bg-red-50/20' : worstUrgency === 'overdue' ? 'bg-purple-50/20' : 'bg-white'}`}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-3" colSpan={2}>
          <div className="flex items-center gap-3">
            <div className={`p-1 rounded-lg transition-transform duration-200 ${expanded ? 'rotate-0' : '-rotate-90'}`}>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
            <div className={`h-2.5 w-2.5 rounded-full ${uc.dot} ${worstUrgency === 'critical' || worstUrgency === 'overdue' ? 'animate-pulse' : ''}`} />
            <div>
              <p className="text-sm font-black text-slate-800">{client.client_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-500">{client.pic_name}</span>
                <span className="text-[10px] text-slate-300">·</span>
                <span className="text-[10px] text-slate-500">{client.pic_phone}</span>
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">{equipments.length} alat</span>
            {dealCount > 0 && <span className="text-[9px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">{dealCount} deal</span>}
          </div>
        </td>
        <td className="px-3 py-3" colSpan={2}>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${uc.bg} ${uc.border} ${uc.textColor}`}>
            {uc.label}
          </span>
        </td>
        <td className="px-3 py-3">
          {client.drive_folder_url && (
            <a href={client.drive_folder_url} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] text-sky-600 hover:text-sky-800 font-medium transition-colors">
              <ExternalLink className="h-3 w-3" />Folder Drive
            </a>
          )}
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button onClick={() => onAddEquipment(client)}
              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-all cursor-pointer" title="Tambah Alat">
              <Plus className="h-3 w-3" />
            </button>
            <button onClick={() => onEditClient(client)}
              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg transition-all cursor-pointer" title="Edit Klien">
              <Edit3 className="h-3 w-3" />
            </button>
            <button onClick={() => { if (confirm(`Hapus klien "${client.client_name}" dan semua alatnya?`)) onDeleteClient(client.id); }}
              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-all cursor-pointer" title="Hapus Klien">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </td>
      </tr>
      {/* Expanded equipment rows */}
      <AnimatePresence>
        {expanded && equipments.map((eq) => (
          <EquipmentRow
            key={eq.id}
            client={client}
            equipment={eq}
            logs={logs}
            activeUser={activeUser}
            onOpenLog={onOpenLog}
            onEditEquipment={onEditEquipment}
            onDeleteEquipment={onDeleteEquipment}
            onStatusChange={onStatusChange}
            isSelected={selectedEquipmentIds?.includes(eq.id)}
            onToggleSelect={() => onToggleSelectEquipment && onToggleSelectEquipment(eq.id)}
          />
        ))}
      </AnimatePresence>
    </>
  );
}

// ============================================================
// MAIN RETENTION MODULE
// ============================================================
interface RetentionModuleProps {
  clients: RetentionClient[];
  equipments: ClientEquipment[];
  logs: FollowUpLog[];
  activeUser: string;
  onRefresh: () => Promise<void>;
  onCreateInspectionJobs: (jobs: Partial<InspectionJob>[]) => Promise<void>;
  onSwitchToInspection: () => void;
}

export default function RetentionModule({
  clients, equipments, logs, activeUser, onRefresh, onCreateInspectionJobs, onSwitchToInspection
}: RetentionModuleProps) {
  // UI State
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = React.useState('all');
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear().toString());
  const [filter, setFilter] = useState<'all' | 'overdue' | 'critical' | 'warning' | 'deal' | 'lost'>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<RetentionClient | null>(null);
  const [editingEquipment, setEditingEquipment] = useState<ClientEquipment | null>(null);
  const [logModal, setLogModal] = useState<{ client: RetentionClient; equipment: ClientEquipment } | null>(null);
  const [dealModal, setDealModal] = useState<{ client: RetentionClient; equipment: ClientEquipment } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);

  // Bento stats
  const stats = useMemo(() => {
    let overdue = 0, critical = 0, warning = 0, deal = 0, lost = 0, safe = 0;
    equipments.forEach(eq => {
      const latestLog = logs
        .filter(l => l.equipment_id === eq.id)
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
      const u = getUrgency(eq, latestLog);
      if (u === 'overdue') overdue++;
      else if (u === 'critical') critical++;
      else if (u === 'warning') warning++;
      else if (u === 'deal') deal++;
      else if (u === 'lost') lost++;
      else safe++;
    });
    return { overdue, critical, warning, deal, lost, safe, total: equipments.length };
  }, [equipments, logs]);

  // Filter & Search & Sort logic
  const filteredClients = useMemo(() => {
    const q = search.toLowerCase();
    
    // 1. Filter
    const filtered = clients.filter(c => {
      const matchSearch = !q || c.client_name.toLowerCase().includes(q) || c.pic_name.toLowerCase().includes(q) || c.pic_phone.includes(q);
      if (!matchSearch) return false;

      const clientEqs = equipments.filter(e => e.client_id === c.id && filterByDate(e.due_date, selectedMonth, selectedYear));
      if (clientEqs.length === 0) return false;

      if (filter === 'all') return true;

      return clientEqs.some(eq => {
        const latestLog = logs.filter(l => l.equipment_id === eq.id)
          .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
        return getUrgency(eq, latestLog) === filter;
      });
    });

    // 2. Sort (Paling urgent / jatuh tempo terdekat di atas)
    return filtered.sort((a, b) => {
      const getScore = (client: RetentionClient) => {
        const clientEqs = equipments.filter(e => e.client_id === client.id && filterByDate(e.due_date, selectedMonth, selectedYear));
        if (clientEqs.length === 0) return Number.MAX_SAFE_INTEGER;
        
        let minTime = Number.MAX_SAFE_INTEGER;
        let hasActive = false;

        clientEqs.forEach(eq => {
          const latestLog = logs.filter(l => l.equipment_id === eq.id)
            .sort((l1, l2) => new Date(l2.created_at || 0).getTime() - new Date(l1.created_at || 0).getTime())[0];
          
          const status = latestLog?.status;
          // Abaikan alat yang sudah deal/lost dari penentuan prioritas atas
          if (status === 'Deal (Lanjut)' || status === 'Lost (Lepas)') return; 

          hasActive = true;
          const dueTime = new Date(eq.due_date).getTime();
          if (dueTime < minTime) minTime = dueTime;
        });

        if (!hasActive) return Number.MAX_SAFE_INTEGER - 1; // Taruh di paling bawah
        return minTime;
      };

      return getScore(a) - getScore(b);
    });
  }, [clients, equipments, logs, search, filter, selectedMonth, selectedYear]);

  // === DATA OPERATIONS ===

  const handleSaveClientEquipment = async (clientData: Partial<RetentionClient>, eqDataList: Partial<ClientEquipment>[]) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase tidak terkonfigurasi. Data tidak dapat disimpan.');
    }
    setIsSaving(true);
    try {
      let clientId = editingClient?.id;

      if (!editingClient) {
        // New client
        const { data: newClient, error } = await supabase
          .from('clients')
          .upsert([{ client_name: clientData.client_name, pic_name: clientData.pic_name, pic_phone: clientData.pic_phone, pic_email: clientData.pic_email, drive_folder_url: clientData.drive_folder_url, notes: clientData.notes }], { onConflict: 'client_name' })
          .select('id')
          .single();
        if (error) throw new Error(error.message);
        clientId = newClient.id;
      } else {
        // Update existing client
        const { error } = await supabase.from('clients').update({
          client_name: clientData.client_name, pic_name: clientData.pic_name, pic_phone: clientData.pic_phone,
          pic_email: clientData.pic_email, drive_folder_url: clientData.drive_folder_url, notes: clientData.notes
        }).eq('id', editingClient.id);
        if (error) throw new Error(error.message);
      }

      // Save equipment(s)
      if (editingEquipment) {
        // Edit mode (single equipment)
        const eqData = eqDataList[0];
        const { error } = await supabase.from('client_equipments').update({
          equipment_name: eqData.equipment_name, equipment_type: eqData.equipment_type,
          last_inspection_date: eqData.last_inspection_date, due_date: eqData.due_date,
          certificate_number: eqData.certificate_number
        }).eq('id', editingEquipment.id);
        if (error) throw new Error(error.message);
      } else {
        // Add mode (bulk equipments)
        const inserts = eqDataList.map(eq => ({
          client_id: clientId,
          equipment_name: eq.equipment_name,
          equipment_type: eq.equipment_type,
          last_inspection_date: eq.last_inspection_date,
          due_date: eq.due_date,
          certificate_number: eq.certificate_number
        }));
        
        const { error } = await supabase.from('client_equipments').insert(inserts);
        if (error) throw new Error(error.message);
      }

      setIsFormOpen(false);
      setEditingClient(null);
      setEditingEquipment(null);
    } catch (err: any) {
      alert('Gagal menyimpan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
    await onRefresh();
  };

  const handleStatusChange = async (equipmentId: string, clientId: string, status: FollowUpStatus, stage: FollowUpStage) => {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from('follow_up_logs').insert([{
      client_id: clientId, equipment_id: equipmentId, stage, status,
      contacted_by: activeUser, contacted_at: new Date().toISOString()
    }]);
    if (error) throw new Error(error.message);

    if (status === 'Deal (Lanjut)') {
      const client = clients.find(c => c.id === clientId);
      const equipment = equipments.find(e => e.id === equipmentId);
      if (client && equipment) {
        setDealModal({ client, equipment });
      }
    }
    await onRefresh();
  };

  const handleDeleteEquipment = async (equipmentId: string) => {
    if (!confirm('Hapus data alat ini?')) return;
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from('client_equipments').delete().eq('id', equipmentId);
    if (error) { alert('Gagal menghapus: ' + error.message); return; }
    await onRefresh();
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) { alert('Gagal menghapus klien: ' + error.message); return; }
    await onRefresh();
  };

  const handleImport = async (importedClients: Partial<RetentionClient>[], importedEquipments: Partial<ClientEquipment>[]) => {
    if (!isSupabaseConfigured || !supabase) return;
    // Group equipments by client temp id
    const clientTempMap = new Map<string, string>(); // temp_id -> real_id

    for (const c of importedClients) {
      const { data, error } = await supabase.from('clients').upsert([{
        client_name: c.client_name, pic_name: c.pic_name, pic_phone: c.pic_phone
      }], { onConflict: 'client_name' }).select('id').single();
      if (!error && data) {
        clientTempMap.set(c.id!, data.id);
      }
    }

    const eqsToInsert = importedEquipments.map(e => ({
      client_id: clientTempMap.get(e.client_id!) || e.client_id,
      equipment_name: e.equipment_name,
      equipment_type: e.equipment_type || 'Lainnya',
      last_inspection_date: e.last_inspection_date,
      due_date: e.due_date,
      certificate_number: e.certificate_number,
    })).filter(e => e.client_id);

    if (eqsToInsert.length > 0) {
      const { error } = await supabase.from('client_equipments').insert(eqsToInsert);
      if (error) throw new Error(error.message);
    }
    await onRefresh();
  };

  const handleDealConfirm = () => setDealModal(null);

    
  const handleBulkStatusChange = async (status: FollowUpStatus, stage: FollowUpStage) => {
    if (selectedEquipmentIds.length === 0) return;
    if (!isSupabaseConfigured || !supabase) return;
    
    setIsSaving(true);
    try {
      const logsToInsert = selectedEquipmentIds.map(eqId => {
        const equipment = equipments.find(e => e.id === eqId);
        return {
          client_id: equipment?.client_id,
          equipment_id: eqId,
          stage,
          status,
          contacted_by: activeUser,
          contacted_at: new Date().toISOString()
        };
      }).filter(l => l.client_id);

      const { error } = await supabase.from('follow_up_logs').insert(logsToInsert);
      if (error) throw new Error(error.message);
      
      setSelectedEquipmentIds([]);
      await onRefresh();
    } catch (err: any) {
      alert('Gagal update status massal: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkDeal = async () => {
    if (selectedEquipmentIds.length === 0) return;
    
    const jobsToCreate = selectedEquipmentIds.map(eqId => {
      const equipment = equipments.find(e => e.id === eqId);
      const client = clients.find(c => c.id === equipment?.client_id);
      
      if (!equipment || !client) return null;
      
      return {
        client_id: client.id,
        equipment_id: equipment.id,
        client_name: client.client_name,
        pic_name: client.pic_name,
        pic_phone: client.pic_phone,
        equipment_name: equipment.equipment_name,
        equipment_type: equipment.equipment_type,
        due_date: equipment.due_date,
        stage: 'Penawaran',
        created_by: activeUser,
      };
    }).filter(Boolean) as any;

    await onCreateInspectionJobs(jobsToCreate);
    setSelectedEquipmentIds([]);
    onSwitchToInspection();
  };

  const FILTER_TABS = [
    { key: 'all', label: 'Semua', count: clients.length },
    { key: 'overdue', label: '☠️ Lewat', count: stats.overdue },
    { key: 'critical', label: '🔴 Kritis', count: stats.critical },
    { key: 'warning', label: '🟡 Siaga', count: stats.warning },
    { key: 'deal', label: '✅ Deal', count: stats.deal },
    { key: 'lost', label: '❌ Lost', count: stats.lost },
  ] as const;

  return (
    <div className="space-y-5">
      {/* === BENTO STATS === */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Alat', value: stats.total, icon: Wrench, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
          { label: 'Lewat Tempo', value: stats.overdue, icon: AlertTriangle, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
          { label: 'Kritis H-30', value: stats.critical, icon: Bell, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
          { label: 'Siaga H-90', value: stats.warning, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Deal Aktif', value: stats.deal, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          { label: 'Lost', value: stats.lost, icon: TrendingDown, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200' },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`${bg} border ${border} rounded-2xl p-4 flex flex-col gap-2`}>
            <div className={`${color} flex items-center gap-1.5`}>
              <Icon className="h-4 w-4" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
            </div>
            <p className={`text-2xl font-black font-mono ${color} tracking-tight leading-none`}>{value}</p>
          </div>
        ))}
      </div>

      {/* === TOOLBAR === */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama PT, PIC..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-300 outline-none bg-slate-50"
            />
          </div>

          {/* Month Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-300 outline-none bg-slate-50 appearance-none font-bold text-slate-700 cursor-pointer"
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
              className="pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-300 outline-none bg-slate-50 appearance-none font-bold text-slate-700 cursor-pointer"
            >
              {YEARS.map(y => (
                <option key={y.value} value={y.value}>{y.label}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => {
              const eqFiltered = equipments.filter(e => filteredClients.some(c => c.id === e.client_id) && filterByDate(e.due_date, selectedMonth, selectedYear));
              const mLabel = MONTHS.find(m => m.value === selectedMonth)?.label || 'Semua';
              const yLabel = selectedYear === 'all' ? 'Semua' : selectedYear;
              exportRetentionToExcel(filteredClients, eqFiltered, logs, `${mLabel}_${yLabel}`);
            }}
              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer shadow-sm">
              <FileSpreadsheet className="h-3.5 w-3.5" />Export Excel
            </button>
            <button onClick={() => {
              const eqFiltered = equipments.filter(e => filteredClients.some(c => c.id === e.client_id) && filterByDate(e.due_date, selectedMonth, selectedYear));
              const mLabel = MONTHS.find(m => m.value === selectedMonth)?.label || 'Semua';
              const yLabel = selectedYear === 'all' ? 'Semua' : selectedYear;
              exportRetentionToPDF(filteredClients, eqFiltered, logs, `${mLabel}_${yLabel}`);
            }}
              className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer shadow-sm">
              <FileText className="h-3.5 w-3.5" />Export PDF
            </button>
            <button onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer">
              <Upload className="h-3.5 w-3.5" />Import CSV
            </button>
            <button onClick={() => { setEditingClient(null); setEditingEquipment(null); setIsFormOpen(true); }}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer">
              <Plus className="h-3.5 w-3.5" />Tambah Klien
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-0.5 scrollbar-none">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                filter === tab.key
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${
                  filter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* === TABLE === */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {filteredClients.length === 0 ? (
          <div className="py-20 text-center">
            <Building2 className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-400">Tidak ada data klien</p>
            <p className="text-xs text-slate-300 mt-1">Tambah klien baru atau ubah filter pencarian</p>
            <button onClick={() => { setEditingClient(null); setEditingEquipment(null); setIsFormOpen(true); }}
              className="mt-4 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer mx-auto">
              <Plus className="h-3.5 w-3.5" />Tambah Klien Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 w-[280px]">Perusahaan / Alat</th>
                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 w-[100px]">Jml Alat</th>
                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 w-[130px]">Jatuh Tempo</th>
                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 w-[80px]">Sisa</th>
                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 w-[140px]">Status FU</th>
                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 w-[120px]">Urgency</th>
                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 w-[100px]">Dokumen</th>
                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 w-[120px]">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(client => (
                  <ClientGroupRow
                    key={client.id}
                    client={client}
                    equipments={equipments.filter(e => e.client_id === client.id)}
                    logs={logs}
                    activeUser={activeUser}
                    onOpenLog={(c, e) => setLogModal({ client: c, equipment: e })}
                    onEditEquipment={(c, e) => { setEditingClient(c); setEditingEquipment(e); setIsFormOpen(true); }}
                    onDeleteEquipment={handleDeleteEquipment}
                    onAddEquipment={(c) => { setEditingClient(c); setEditingEquipment(null); setIsFormOpen(true); }}
                    onEditClient={(c) => { setEditingClient(c); setEditingEquipment(null); setIsFormOpen(true); }}
                    onDeleteClient={handleDeleteClient}
                    onStatusChange={handleStatusChange}
                    defaultExpanded={filteredClients.length <= 5}
                    selectedEquipmentIds={selectedEquipmentIds}
                    onToggleSelectEquipment={(id) => {
                      setSelectedEquipmentIds(prev => 
                        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                      );
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {filteredClients.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] text-slate-400">{filteredClients.length} perusahaan · {equipments.filter(e => filteredClients.some(c => c.id === e.client_id)).length} alat ditampilkan</p>
            <button onClick={() => exportToCSV(filteredClients, equipments.filter(e => filteredClients.some(c => c.id === e.client_id)), logs)}
              className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-800 font-bold cursor-pointer transition-colors">
              <Download className="h-3 w-3" />Export Laporan
            </button>
          </div>
        )}
      </div>

      {/* === MODALS === */}
      <AnimatePresence>
        {isFormOpen && (
          <FollowUpForm
            initialClient={editingClient || undefined}
            initialEquipment={editingEquipment || undefined}
            onClose={() => { setIsFormOpen(false); setEditingClient(null); setEditingEquipment(null); }}
            onSave={handleSaveClientEquipment}
          />
        )}
        {isImportOpen && (
          <ImportCSVModal onClose={() => setIsImportOpen(false)} onImport={handleImport} />
        )}
        {logModal && (
          <LogHistoryModal
            client={logModal.client}
            equipment={logModal.equipment}
            logs={logs}
            onClose={() => setLogModal(null)}
            onAddLog={handleAddLog}
            activeUser={activeUser}
          />
        )}
        {dealModal && (
          <DealConfirmModal
            client={dealModal.client}
            equipment={dealModal.equipment}
            onConfirm={handleDealConfirm}
            onCreateJob={handleCreateInspectionJob}
            onClose={() => setDealModal(null)}
          />
        )}
            </AnimatePresence>

      {/* === BULK ACTION FLOATING BAR === */}
      <AnimatePresence>
        {selectedEquipmentIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-40 bg-slate-800 text-white px-6 py-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center gap-4 sm:gap-6 border border-slate-700"
          >
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-black">{selectedEquipmentIds.length} Alat Dipilih</p>
                <p className="text-[10px] text-slate-400">Terapkan update status massal ke alat yang dipilih</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                className="bg-slate-700 text-xs font-bold border border-slate-600 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 flex-1 sm:w-48"
                onChange={async (e) => {
                  const val = e.target.value as FollowUpStatus;
                  if (!val) return;
                  if (!confirm(`Update status menjadi ${val} untuk ${selectedEquipmentIds.length} alat?`)) {
                    e.target.value = '';
                    return;
                  }
                  
                  setIsSaving(true);
                  try {
                    for (const eqId of selectedEquipmentIds) {
                      const eq = equipments.find(x => x.id === eqId);
                      if (eq) {
                        await handleStatusChange(eqId, eq.client_id, val, 'Follow-Up');
                      }
                    }
                    setSelectedEquipmentIds([]);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
              >
                <option value="">-- Pilih Status Baru --</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                onClick={() => setSelectedEquipmentIds([])}
                className="bg-slate-700 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-colors text-slate-300 px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-600"
              >
                Batal
              </button>
            </div>
            
            {isSaving && (
              <div className="absolute inset-0 bg-slate-800/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <RefreshCcw className="h-5 w-5 animate-spin text-emerald-400" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
