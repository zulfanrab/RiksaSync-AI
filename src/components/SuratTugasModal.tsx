/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  FileText, 
  Download, 
  Calendar, 
  MapPin, 
  User, 
  Phone, 
  Briefcase, 
  ShieldCheck, 
  CheckSquare, 
  Square, 
  Loader2,
  FileDown,
  Info
} from 'lucide-react';
import { Schedule, Manpower } from '../types';
import { 
  getStoredNomorUrut, 
  formatNomorSurat, 
  buildDocFileName,
  resolveSchedulePersonnels, 
  extractKotaTujuan, 
  formatTanggalIndonesia,
  generateSuratTugasDocx,
  generateSuratTugasPdf
} from '../lib/documentGenerator';

interface SuratTugasModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule | null;
  manpowerList: Manpower[];
}

export default function SuratTugasModal({
  isOpen,
  onClose,
  schedule,
  manpowerList
}: SuratTugasModalProps) {
  if (!isOpen || !schedule) return null;

  // ── STATE FORM ──────────────────────────────────────────────────────────────
  const [nomorUrut, setNomorUrut] = useState<number>(1);
  const [detailUnit, setDetailUnit] = useState<string>('');
  const [picName, setPicName] = useState<string>('');
  const [picPhone, setPicPhone] = useState<string>('');
  const [clientAddress, setClientAddress] = useState<string>('');
  const [kotaTujuan, setKotaTujuan] = useState<string>('Bandung');
  const [includeSppd, setIncludeSppd] = useState<boolean>(true);

  const [isDownloadingDocx, setIsDownloadingDocx] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── INITIALIZE / PREFILL FROM SCHEDULE ──────────────────────────────────────
  useEffect(() => {
    if (!schedule) return;

    // Nomor urut tersimpan atau counter baru
    const initialNomor = getStoredNomorUrut(schedule.id);
    setNomorUrut(initialNomor);

    // Detail Unit
    const initialUnit = schedule.unit_descriptions && schedule.unit_descriptions.length > 0
      ? schedule.unit_descriptions.join(', ')
      : (schedule.agenda_type === 'Riksa Uji' ? 'Peralatan & Instalasi K3' : '-');
    setDetailUnit(initialUnit);

    // PIC & Kontak
    setPicName(schedule.pic_name || '');
    setPicPhone(schedule.pic_phone || '');

    // Alamat & Kota
    const initialAddress = schedule.client_address || schedule.location || '';
    setClientAddress(initialAddress);
    setKotaTujuan(extractKotaTujuan(initialAddress || schedule.client_name || ''));

    setIncludeSppd(true);
    setErrorMessage(null);
  }, [schedule]);

  // ── LIVE PREVIEW NOMOR SURAT ───────────────────────────────────────────────
  const nomorSuratST = useMemo(() => {
    return formatNomorSurat(nomorUrut || 1, 'ST', schedule.start_date);
  }, [nomorUrut, schedule.start_date]);

  const nomorSuratSPPD = useMemo(() => {
    return formatNomorSurat(nomorUrut || 1, 'SPPD', schedule.start_date);
  }, [nomorUrut, schedule.start_date]);

  const sampleFileName = useMemo(() => {
    return buildDocFileName(nomorUrut || 1, schedule.client_name, schedule.start_date, 'docx');
  }, [nomorUrut, schedule]);

  // ── RESOLVED PERSONNELS ────────────────────────────────────────────────────
  const resolvedPersonnels = useMemo(() => {
    return resolveSchedulePersonnels(schedule, manpowerList);
  }, [schedule, manpowerList]);

  // ── DOWNLOAD HANDLERS ──────────────────────────────────────────────────────
  const getGeneratorOptions = () => ({
    nomorUrut,
    customNomorSurat: nomorSuratST,
    detailUnit,
    picName,
    picPhone,
    clientAddress,
    kotaTujuan,
    includeSppd
  });

  const handleDownloadDocx = async () => {
    try {
      setIsDownloadingDocx(true);
      setErrorMessage(null);
      await generateSuratTugasDocx(schedule, manpowerList, getGeneratorOptions());
    } catch (err) {
      console.error(err);
      setErrorMessage(`Gagal generate Word (.docx): ${(err as Error).message}`);
    } finally {
      setIsDownloadingDocx(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      setErrorMessage(null);
      await generateSuratTugasPdf(schedule, manpowerList, getGeneratorOptions());
    } catch (err) {
      console.error(err);
      setErrorMessage(`Gagal generate PDF (.pdf): ${(err as Error).message}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl border border-blue-200/80 shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm sm:text-base leading-tight">
                Cetak Surat Tugas & SPPD
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {schedule.client_name} • {formatTanggalIndonesia(schedule.start_date)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
            title="Tutup Modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 max-h-[70vh]">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
              <div className="font-medium whitespace-pre-line">{errorMessage}</div>
            </div>
          )}

          {/* Section 1: Nomor Surat Configuration & Live Preview */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 border border-blue-200/80 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>Nomor Urut Surat</span>
              </label>
              <span className="text-[10px] text-blue-700 font-medium bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200">
                Tersimpan Otomatis
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div>
                <input
                  type="number"
                  min="1"
                  max="9999"
                  value={nomorUrut}
                  onChange={(e) => setNomorUrut(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full font-mono text-base font-bold bg-white border border-blue-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                />
                <span className="text-[10px] text-slate-400 block text-center mt-1">Ubah manual jika perlu</span>
              </div>

              <div className="sm:col-span-2 bg-white/90 p-2.5 rounded-lg border border-blue-200/70 space-y-1">
                <div className="text-[11px] text-slate-600 flex justify-between">
                  <span className="font-semibold text-slate-500">No. Surat Tugas:</span>
                  <span className="font-mono font-bold text-blue-700">{nomorSuratST}</span>
                </div>
                {includeSppd && (
                  <div className="text-[11px] text-slate-600 flex justify-between border-t border-slate-100 pt-1">
                    <span className="font-semibold text-slate-500">No. SPPD:</span>
                    <span className="font-mono font-bold text-indigo-700">{nomorSuratSPPD}</span>
                  </div>
                )}
                <div className="text-[10px] text-slate-500 border-t border-slate-100 pt-1 flex items-center justify-between">
                  <span className="font-semibold text-slate-400">File:</span>
                  <span className="font-mono text-slate-600 truncate max-w-[260px]" title={sampleFileName}>{sampleFileName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Personel Bertugas Preview */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Susunan Tim Personel ({resolvedPersonnels.length})</span>
              </span>
              <span className="text-[10px] text-slate-500">No. 1 = Ketua / Lead Expert</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
                    <th className="py-1 px-2 w-8 text-center">No</th>
                    <th className="py-1 px-2">Nama Resmi</th>
                    <th className="py-1 px-2 w-28 text-center">NIK</th>
                    <th className="py-1 px-2">Jabatan Resmi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {resolvedPersonnels.map((p) => (
                    <tr key={p.NO} className={p.isLead ? 'bg-emerald-50/60 font-semibold' : ''}>
                      <td className="py-1.5 px-2 text-center text-slate-600 font-mono text-[11px]">{p.NO}</td>
                      <td className="py-1.5 px-2 text-slate-800">
                        {p.NAMA}
                        {p.isLead && (
                          <span className="ml-1.5 text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                            Lead
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono text-[11px] text-slate-600">{p.NIK}</td>
                      <td className="py-1.5 px-2 text-slate-600">{p.JABATAN}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Quick Edit Fields */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Detail Dokumen Penugasan
            </span>

            {/* Objek Pemeriksaan */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                <Briefcase className="h-3 w-3 text-slate-400" />
                <span>Objek Pemeriksaan / Detail Unit</span>
              </label>
              <textarea
                value={detailUnit}
                onChange={(e) => setDetailUnit(e.target.value)}
                rows={2}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Contoh: Forklift 3 Ton, Boiler 5 Ton, Over Head Crane"
              />
            </div>

            {/* PIC Lapangan & Kontak */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <User className="h-3 w-3 text-slate-400" />
                  <span>Nama PIC Lapangan</span>
                </label>
                <input
                  type="text"
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nama PIC Klien"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400" />
                  <span>Kontak PIC</span>
                </label>
                <input
                  type="text"
                  value={picPhone}
                  onChange={(e) => setPicPhone(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nomor HP / WhatsApp"
                />
              </div>
            </div>

            {/* Alamat Lengkap Penugasan */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-slate-400" />
                <span>Alamat Lengkap Lokasi Penugasan</span>
              </label>
              <textarea
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                rows={2}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Alamat lengkap proyek / pabrik / kantor klien"
              />
            </div>

            {/* Kota Tujuan SPPD */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-indigo-500" />
                  <span>Kota Tujuan (untuk Lembar SPPD)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Contoh: Bandung, Bekasi, Karawang</span>
              </label>
              <input
                type="text"
                value={kotaTujuan}
                onChange={(e) => setKotaTujuan(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                placeholder="Nama Kota Tujuan"
              />
            </div>
          </div>

          {/* Section 4: Checkbox Opsi SPPD (Halaman 2) */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIncludeSppd(!includeSppd)}
              className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold hover:text-slate-900 cursor-pointer select-none"
            >
              {includeSppd ? (
                <CheckSquare className="h-4 w-4 text-blue-600" />
              ) : (
                <Square className="h-4 w-4 text-slate-400" />
              )}
              <span>Sertakan Lampiran SPPD & Lembar Visum (Halaman 2)</span>
            </button>
            <p className="text-[10px] text-slate-400 ml-6.5 mt-0.5">
              Jika tidak dicentang, dokumen yang dicetak hanya 1 halaman (Surat Tugas saja).
            </p>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDownloadingDocx || isDownloadingPdf}
            className="text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            Batal
          </button>

          <div className="flex items-center gap-2">
            {/* Tombol Download Word (.docx) */}
            <button
              type="button"
              onClick={handleDownloadDocx}
              disabled={isDownloadingDocx || isDownloadingPdf}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl border border-blue-700 transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloadingDocx ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <FileDown className="h-4 w-4 shrink-0" />
              )}
              <span>Download Word (.docx)</span>
            </button>

            {/* Tombol Download PDF (.pdf) */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingDocx || isDownloadingPdf}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl border border-emerald-700 transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloadingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <Download className="h-4 w-4 shrink-0" />
              )}
              <span>Download PDF (.pdf)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

