/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Check, Copy, AlertCircle, FileText, RefreshCw, Send } from 'lucide-react';
import { PnJenis, PnNomor, formatNomorUrut } from '../types/penomoran';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useUser } from '../context/UserContext';

interface PenomoranFormModalProps {
  jenis: PnJenis;
  revisiDariNomor?: PnNomor | null;
  onClose: () => void;
  onSuccess: (newNomor: PnNomor) => void;
}

export default function PenomoranFormModal({
  jenis,
  revisiDariNomor,
  onClose,
  onSuccess
}: PenomoranFormModalProps) {
  const { activeUser, currentUser } = useUser();

  const isRevisi = Boolean(revisiDariNomor);

  // Form states
  const [klien, setKlien] = useState(revisiDariNomor?.klien || '');
  const [perihal, setPerihal] = useState(revisiDariNomor ? `Revisi: ${revisiDariNomor.perihal}` : '');
  const [ref, setRef] = useState(revisiDariNomor ? `Revisi dari No. ${formatNomorUrut(revisiDariNomor.no_urut, jenis.pad_digit)}` : '');
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().split('T')[0]);

  // UI & feedback states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [issuedNomor, setIssuedNomor] = useState<PnNomor | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perihal.trim() || perihal.trim().length < 3) {
      setErrorMsg(`${jenis.label_perihal} wajib diisi minimal 3 karakter.`);
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Koneksi Supabase belum terkonfigurasi. Tidak dapat mengambil nomor.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Panggil fungsi database pn_ambil_nomor
      const { data, error } = await supabase.rpc('pn_ambil_nomor', {
        p_jenis_kode: jenis.kode,
        p_klien: klien.trim() || null,
        p_perihal: perihal.trim(),
        p_ref: ref.trim() || null,
        p_revisi_dari: revisiDariNomor ? revisiDariNomor.id : null,
        p_tanggal: tanggal
      });

      if (error) {
        throw new Error(error.message || 'Gagal mengambil nomor surat.');
      }

      const record = data as PnNomor;
      setIssuedNomor(record);
      onSuccess(record);

      // Trigger Webhook mirror sync jika endpoint lokal tersedia
      fetch('/api/penomoran/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record })
      }).catch(() => {});

    } catch (err: any) {
      console.error('[pn_ambil_nomor Error]:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan saat memproses penomoran.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!issuedNomor) return;
    const formatted = formatNomorUrut(issuedNomor.no_urut, jenis.pad_digit);
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const creatorName = currentUser?.full_name || currentUser?.username || activeUser || 'Saya';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl text-white ${isRevisi ? 'bg-amber-500' : 'bg-emerald-600'}`}>
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800 leading-tight">
                {isRevisi ? 'Revisi Nomor Dokumen' : 'Ambil Nomor Dokumen Baru'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {jenis.nama} • {jenis.kelompok.toUpperCase()}
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
        <div className="p-5 overflow-y-auto space-y-4">

          {/* SUCCESS SCREEN: NOMOR TERBIT BESAR */}
          {issuedNomor ? (
            <div className="text-center py-6 px-4 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mb-1">
                <Check className="h-6 w-6 stroke-[3]" />
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Nomor Resmi Berhasil Diterbitkan
                </span>
                <div className="mt-2 text-5xl sm:text-6xl font-black text-slate-900 tracking-tight font-mono py-3 px-6 bg-emerald-50/70 border-2 border-emerald-300 rounded-3xl inline-block shadow-inner">
                  {formatNomorUrut(issuedNomor.no_urut, jenis.pad_digit)}
                </div>
                <p className="text-xs text-slate-500 mt-2 font-medium">
                  {jenis.nama} • Tahun {issuedNomor.tahun}
                </p>
              </div>

              {/* Rincian Singkat Dokumen */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-left text-xs space-y-1.5 max-w-sm mx-auto">
                {issuedNomor.klien && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">{jenis.label_klien}:</span>
                    <span className="font-semibold text-slate-700 text-right">{issuedNomor.klien}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">{jenis.label_perihal}:</span>
                  <span className="font-semibold text-slate-700 text-right truncate max-w-[200px]">{issuedNomor.perihal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tanggal:</span>
                  <span className="font-semibold text-slate-700">{issuedNomor.tanggal}</span>
                </div>
                {isRevisi && revisiDariNomor && (
                  <div className="flex justify-between text-amber-700 pt-1 border-t border-slate-200">
                    <span>Revisi Dari:</span>
                    <span className="font-bold">No. {formatNomorUrut(revisiDariNomor.no_urut, jenis.pad_digit)}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-xs sm:text-sm bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer shadow-md active:scale-95"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? 'Berhasil Disalin!' : 'Salin Nomor'}</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </div>
          ) : (
            /* FORM INPUT */
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Alert Mode Revisi */}
              {isRevisi && revisiDariNomor && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2">
                  <RefreshCw className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-bold">Mode Revisi:</span> Menerbitkan nomor baru yang akan merujuk ke{' '}
                    <strong>No. {formatNomorUrut(revisiDariNomor.no_urut, jenis.pad_digit)}</strong>.
                  </div>
                </div>
              )}

              {/* Field: Tanggal & Dibuat Oleh (Otomatis) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Dokumen
                  </label>
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dibuat Oleh (Otomatis)
                  </label>
                  <div className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 truncate">
                    👤 {creatorName}
                  </div>
                </div>
              </div>

              {/* Field: Klien / Vendor / Lokasi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {jenis.label_klien} <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={klien}
                  onChange={(e) => setKlien(e.target.value)}
                  placeholder={`Contoh: PT Tatamulia Nusantara Indah`}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Field: Perihal (Wajib) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {jenis.label_perihal} <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={perihal}
                  onChange={(e) => setPerihal(e.target.value)}
                  placeholder="Ketik keterangan perihal atau nama pekerjaan secara jelas..."
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-none"
                  required
                />
              </div>

              {/* Field: Ref / No Kontrak / Keterangan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {jenis.label_ref} <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder="Contoh: No. PO / No. Kontrak / Catatan Tambahan"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Footer Modal Action */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 cursor-pointer ${
                    isRevisi ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  } disabled:opacity-50`}
                >
                  {loading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>{loading ? 'Menerbitkan...' : isRevisi ? 'Terbitkan Nomor Revisi' : 'Ambil Nomor Sekarang'}</span>
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

