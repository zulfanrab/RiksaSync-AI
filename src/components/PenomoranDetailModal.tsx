/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, ShieldCheck, Clock, CheckCircle2, History, Trash2, Ban } from 'lucide-react';
import { PnJenis, PnNomor, PnLog, formatNomorUrut } from '../types/penomoran';
import { supabase } from '../lib/supabase';
import { syncSingleNomorToSheets } from '../lib/penomoranSync';

interface PenomoranDetailModalProps {
  nomor: PnNomor;
  jenis: PnJenis;
  isAdmin: boolean;
  onClose: () => void;
  onCancelSuccess: (updatedNomor: PnNomor) => void;
  onRevisiClick: (nomor: PnNomor) => void;
}

export default function PenomoranDetailModal({
  nomor,
  jenis,
  isAdmin,
  onClose,
  onCancelSuccess,
  onRevisiClick
}: PenomoranDetailModalProps) {
  const [logs, setLogs] = useState<PnLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Pembatalan state
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Ambil data audit log (pn_log)
  useEffect(() => {
    async function fetchLogs() {
      if (!supabase) return;
      setLoadingLogs(true);
      try {
        const { data, error } = await supabase
          .from('pn_log')
          .select('*')
          .eq('nomor_id', nomor.id)
          .order('waktu', { ascending: true });

        if (!error && data) {
          setLogs(data as PnLog[]);
        }
      } catch (err) {
        console.warn('Gagal memuat log:', err);
      } finally {
        setLoadingLogs(false);
      }
    }
    fetchLogs();
  }, [nomor.id]);

  const handleCancelNomor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim() || cancelReason.trim().length < 3) {
      setCancelError('Alasan pembatalan wajib diisi dengan jelas (minimal 3 karakter).');
      return;
    }

    if (!supabase) return;
    setCancelling(true);
    setCancelError(null);

    try {
      const { data, error } = await supabase.rpc('pn_batalkan', {
        p_id: nomor.id,
        p_alasan: cancelReason.trim()
      });

      if (error) {
        throw new Error(error.message || 'Gagal membatalkan nomor surat.');
      }

      const updated = data as PnNomor;

      // Sinkronisasi status pembatalan ke Google Sheets secara aman & real-time
      syncSingleNomorToSheets(
        { ...updated, status: 'batal', alasan_batal: cancelReason.trim() },
        jenis,
        updated.dibuat_oleh_nama || nomor.dibuat_oleh_nama || 'Admin ARP',
        updated.revisi_dari_no || nomor.revisi_dari_no
      ).catch((e) => console.warn('[Cancel Sync to Sheets Warning]:', e));

      onCancelSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('[pn_batalkan Error]:', err);
      setCancelError(err.message || 'Terjadi kesalahan saat membatalkan nomor.');
    } finally {
      setCancelling(false);
    }
  };

  const isBatal = nomor.status === 'batal';
  const formattedNo = formatNomorUrut(nomor.no_urut, jenis.pad_digit);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl text-white font-mono font-bold text-xs ${
              isBatal ? 'bg-slate-400' : 'bg-slate-900'
            }`}>
              #{formattedNo}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800 leading-tight">
                Detail Dokumen: {jenis.nama}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Tahun {nomor.tahun} • No. Urut: {formattedNo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">

          {/* Banner Status */}
          {isBatal ? (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-700">
                <Ban className="h-4 w-4" />
                <span>Nomor Surat Dibatalkan</span>
              </div>
              <p className="text-[11px] text-rose-600">
                Alasan: <em>"{nomor.alasan_batal || 'Tidak disertakan'}"</em>
              </p>
              <p className="text-[10px] text-rose-500 mt-0.5">
                Nomor yang telah dibatalkan tidak akan pernah diterbitkan ulang ke dokumen lain.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="font-bold">Status: Aktif</span>
              </div>
              {nomor.direvisi_di_no && (
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  Direvisi di No. {formatNomorUrut(nomor.direvisi_di_no, jenis.pad_digit)}
                </span>
              )}
            </div>
          )}

          {/* Rincian Data */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-400 font-semibold">Nomor Surat:</span>
              <span className="col-span-2 font-mono font-bold text-slate-900 text-sm">
                {formattedNo}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-400 font-semibold">Tanggal:</span>
              <span className="col-span-2 font-medium text-slate-800">
                {nomor.tanggal}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-400 font-semibold">Dibuat Oleh:</span>
              <span className="col-span-2 font-medium text-slate-800">
                👤 {nomor.dibuat_oleh_nama || 'Karyawan'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-400 font-semibold">{jenis.label_klien}:</span>
              <span className="col-span-2 font-medium text-slate-800">
                {nomor.klien || '-'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-400 font-semibold">{jenis.label_perihal}:</span>
              <span className="col-span-2 font-medium text-slate-800 leading-relaxed">
                {nomor.perihal}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-400 font-semibold">{jenis.label_ref}:</span>
              <span className="col-span-2 font-medium text-slate-800">
                {nomor.ref || '-'}
              </span>
            </div>

            {nomor.revisi_dari_no && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-amber-800">
                <span className="font-semibold">Revisi Dari:</span>
                <span className="col-span-2 font-bold">
                  No. {formatNomorUrut(nomor.revisi_dari_no, jenis.pad_digit)}
                </span>
              </div>
            )}
          </div>

          {/* Audit Trail Log History */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <History className="h-3.5 w-3.5 text-slate-500" />
              <span>Riwayat Perubahan (Audit Trail)</span>
            </div>

            {loadingLogs ? (
              <p className="text-[11px] text-slate-400">Memuat log perubahan...</p>
            ) : logs.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">Belum ada catatan log tersimpan.</p>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-36 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="p-2.5 flex items-start justify-between gap-2 text-[11px]">
                    <div>
                      <span className={`inline-block font-bold uppercase text-[9px] px-1.5 py-0.2 rounded-sm mr-1.5 ${
                        log.aksi === 'buat' ? 'bg-emerald-100 text-emerald-800' :
                        log.aksi === 'revisi' ? 'bg-amber-100 text-amber-800' :
                        log.aksi === 'batal' ? 'bg-rose-100 text-rose-800' :
                        'bg-sky-100 text-sky-800'
                      }`}>
                        {log.aksi}
                      </span>
                      <span className="text-slate-600 font-medium">
                        {log.aksi === 'buat' ? 'Nomor diterbitkan pertama kali' :
                         log.aksi === 'revisi' ? 'Diterbitkan sebagai revisi' :
                         log.aksi === 'batal' ? 'Dibatalkan oleh admin' :
                         'Data informasi diperbarui'}
                      </span>
                    </div>
                    <span className="text-slate-400 shrink-0 font-mono text-[10px]">
                      {new Date(log.waktu).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FORM PEMBATALAN OLEH ADMIN */}
          {showCancelPrompt && (
            <form onSubmit={handleCancelNomor} className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <span>Konfirmasi Pembatalan Nomor Surat</span>
              </div>
              <p className="text-[11px] text-rose-700">
                Peringatan: Tindakan ini permanen. Nomor tidak akan dihapus dari sistem namun ditandai sebagai batal dan tidak dapat digunakan lagi.
              </p>

              {cancelError && (
                <p className="text-[11px] text-rose-600 font-bold bg-rose-100/70 p-2 rounded-lg">
                  {cancelError}
                </p>
              )}

              <div>
                <label className="block text-[11px] font-bold text-rose-900 mb-1">
                  Alasan Pembatalan <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Contoh: Salah perihal / dibatalkan oleh klien / terjadi kesalahan administrasi"
                  className="w-full text-xs p-2.5 rounded-xl border border-rose-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCancelPrompt(false)}
                  disabled={cancelling}
                  className="px-3 py-1.5 rounded-xl bg-white text-slate-700 font-bold hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {cancelling ? 'Membatalkan...' : 'Ya, Batalkan Nomor Ini'}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isBatal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRevisiClick(nomor);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <span>Revisi Nomor</span>
              </button>
            )}

            {!isBatal && isAdmin && !showCancelPrompt && (
              <button
                type="button"
                onClick={() => setShowCancelPrompt(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
              >
                <Ban className="h-3.5 w-3.5" />
                <span>Batalkan (Admin)</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}

