import React, { useState, useMemo } from 'react';
import { Folder, File, ArrowLeft, Search, Plus, FileUp, Loader, ExternalLink, Trash2, HardDrive } from 'lucide-react';
import { Schedule } from '../types';

interface DriveViewProps {
  schedules: Schedule[];
  clients: { id: string; client_name: string; pic_name: string; pic_phone: string }[];
  scheduleFiles: any[];
  onRefreshAll: () => void;
}

type DirectoryLevel = 'root' | 'client' | 'category';

export default function DriveView({
  schedules,
  clients,
  scheduleFiles,
  onRefreshAll
}: DriveViewProps) {
  // Navigation State
  const [currentLevel, setCurrentLevel] = useState<DirectoryLevel>('root');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<'Sertifikat' | 'Foto Lapangan' | 'Laporan Riksa' | 'Dokumen Pendukung' | 'Lainnya'>('Dokumen Pendukung');
  const [uploadClientName, setUploadClientName] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [fileUploading, setFileUploading] = useState(false);

  // 1. Get Unique Client Names from BOTH schedules and scheduleFiles (to show all folders)
  const clientFolders = useMemo(() => {
    const list = new Set<string>();
    
    // Add clients from database
    clients.forEach(c => {
      if (c.client_name) list.add(c.client_name.trim());
    });
    
    // Add clients from schedules
    schedules.forEach(s => {
      if (s.client_name) list.add(s.client_name.trim());
    });
    
    // Add clients from uploaded files (failsafe)
    scheduleFiles.forEach(f => {
      if (f.client_name) list.add(f.client_name.trim());
    });

    const sorted = Array.from(list).sort();
    
    if (searchQuery.trim()) {
      return sorted.filter(c => c.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    }
    return sorted;
  }, [schedules, clients, scheduleFiles, searchQuery]);

  // Categories list
  const categories = ['Sertifikat', 'Foto Lapangan', 'Laporan Riksa', 'Dokumen Pendukung', 'Lainnya'];

  // Filter schedules matching selected client for linking uploads
  const clientSchedules = useMemo(() => {
    if (!uploadClientName) return [];
    return schedules.filter(s => s.client_name.toLowerCase() === uploadClientName.toLowerCase().trim());
  }, [uploadClientName, schedules]);

  // 2. Navigation Actions
  const handleClientClick = (clientName: string) => {
    setSelectedClient(clientName);
    setCurrentLevel('client');
    setSearchQuery('');
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setCurrentLevel('category');
    setSearchQuery('');
  };

  const handleBack = () => {
    if (currentLevel === 'category') {
      setSelectedCategory(null);
      setCurrentLevel('client');
    } else if (currentLevel === 'client') {
      setSelectedClient(null);
      setCurrentLevel('root');
    }
    setSearchQuery('');
  };

  // 3. Get Files in current view
  const currentFiles = useMemo(() => {
    if (currentLevel !== 'category' || !selectedClient || !selectedCategory) return [];
    
    let list = scheduleFiles.filter(
      f => {
        // Match client name case-insensitive
        const isClientMatch = f.client_name?.toLowerCase() === selectedClient.toLowerCase() ||
          // Fallback check against linked schedule if client_name is missing
          (f.schedule_id && schedules.find(s => s.id === f.schedule_id)?.client_name.toLowerCase() === selectedClient.toLowerCase());
        
        return isClientMatch && f.category === selectedCategory;
      }
    );

    if (searchQuery.trim()) {
      list = list.filter(f => f.file_name.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    }
    return list;
  }, [currentLevel, selectedClient, selectedCategory, scheduleFiles, schedules, searchQuery]);

  // 4. Handle File Upload
  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!uploadClientName.trim()) {
      alert('Mohon tentukan nama perusahaan klien terlebih dahulu.');
      return;
    }

    if (file.size > 4.5 * 1024 * 1024) {
      alert('Ukuran file melebihi batas 4.5 MB. Mohon kompres file Anda terlebih dahulu.');
      return;
    }

    setFileUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const response = await fetch('/api/upload-drive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
            base64Data: base64,
            clientName: uploadClientName.trim(),
            category: uploadCategory,
            scheduleId: selectedScheduleId || null
          })
        });
        const result = await response.json();
        if (response.ok && result.success) {
          setIsUploadOpen(false);
          setUploadClientName('');
          setSelectedScheduleId('');
          onRefreshAll();
          alert('File berhasil diarsip ke Google Drive!');
        } else {
          alert(`Gagal upload: ${result.error || 'Server error'}`);
        }
      } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan koneksi saat mengupload.');
      } finally {
        setFileUploading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 5. Handle Delete
  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus dokumen ini dari Google Drive?')) return;
    try {
      const response = await fetch('/api/delete-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId })
      });
      const result = await response.json();
      if (response.ok && result.success) {
        onRefreshAll();
        alert('File berhasil dihapus dari Google Drive & database.');
      } else {
        alert(`Gagal menghapus: ${result.error || 'Server error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi saat menghapus.');
    }
  };

  // Helper for size display
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fadeIn">
      {/* Upper Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600">
              <HardDrive className="h-5 w-5 animate-pulse" />
            </div>
            <h3 className="text-sm md:text-base font-extrabold text-slate-800 uppercase tracking-wider">
              Google Drive Archiving Center
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Arsip dokumen riksa uji terpusat secara otomatis berdasarkan Klien dan Kategori
          </p>
        </div>

        {/* Global Action Trigger Button */}
        <button
          onClick={() => {
            if (currentLevel === 'client' && selectedClient) {
              setUploadClientName(selectedClient);
            }
            if (currentLevel === 'category' && selectedClient && selectedCategory) {
              setUploadClientName(selectedClient);
              setUploadCategory(selectedCategory as any);
            }
            setIsUploadOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#B8860B] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border-0"
        >
          <Plus className="h-4 w-4" />
          <span>Upload File Baru</span>
        </button>
      </div>

      {/* Breadcrumb Navigation & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-150">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          {currentLevel !== 'root' && (
            <button
              onClick={handleBack}
              className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-700 transition-colors border-0 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <span
            onClick={() => {
              setSelectedClient(null);
              setSelectedCategory(null);
              setCurrentLevel('root');
              setSearchQuery('');
            }}
            className="cursor-pointer hover:text-emerald-600 transition-all font-bold"
          >
            Drive Root
          </span>
          {selectedClient && (
            <>
              <span className="text-slate-300">/</span>
              <span
                onClick={() => {
                  setSelectedCategory(null);
                  setCurrentLevel('client');
                  setSearchQuery('');
                }}
                className="cursor-pointer hover:text-emerald-600 transition-all truncate max-w-[150px] font-bold"
              >
                {selectedClient}
              </span>
            </>
          )}
          {selectedCategory && (
            <>
              <span className="text-slate-300">/</span>
              <span className="text-emerald-600 font-bold">{selectedCategory}</span>
            </>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder={
              currentLevel === 'root'
                ? "Cari Perusahaan..."
                : currentLevel === 'client'
                ? "Cari Kategori..."
                : "Cari Nama File..."
            }
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-semibold"
          />
        </div>
      </div>

      {/* Main Grid View */}
      <div>
        {currentLevel === 'root' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {clientFolders.length === 0 ? (
              <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl space-y-2">
                <Folder className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-bold">Belum ada folder Client</p>
                <p className="text-[10px] text-slate-400">Arsipkan file pertama Anda untuk membuat folder otomatis</p>
              </div>
            ) : (
              clientFolders.map(folder => (
                <div
                  key={folder}
                  onClick={() => handleClientClick(folder)}
                  className="p-4 bg-slate-50/30 border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/20 rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center gap-2 group hover:shadow-xs active:scale-98"
                >
                  <Folder className="h-8 w-8 text-amber-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-bold text-slate-700 truncate w-full" title={folder}>
                    {folder}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {currentLevel === 'client' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {categories.map(cat => (
              <div
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className="p-4 bg-slate-50/30 border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/20 rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center gap-2 group hover:shadow-xs active:scale-98"
              >
                <Folder className="h-8 w-8 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold text-slate-700 truncate w-full">
                  {cat}
                </span>
              </div>
            ))}
          </div>
        )}

        {currentLevel === 'category' && (
          <div className="space-y-2">
            {currentFiles.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl space-y-2">
                <File className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-bold font-sans">Belum ada file di kategori ini</p>
                <p className="text-[10px] text-slate-400 font-sans">Semua arsip file akan langsung diupload to folder Google Drive pribadi Anda</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {currentFiles.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3.5 hover:bg-slate-55/80 transition-all gap-4 text-xs font-semibold text-slate-700 bg-white"
                  >
                    <div className="flex items-center gap-3 truncate max-w-[70%]">
                      <File className="h-5 w-5 text-slate-400 shrink-0" />
                      <div className="truncate">
                        <span className="font-extrabold text-slate-800 block truncate" title={file.file_name}>
                          {file.file_name}
                        </span>
                        <span className="text-[9px] text-slate-400 block font-mono font-medium mt-0.5">
                          {formatBytes(file.file_size)} • Uploaded at: {new Date(file.uploaded_at).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={file.google_drive_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100/60 text-emerald-700 font-bold px-3 py-1.5 rounded-lg border border-emerald-100 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Buka Drive</span>
                      </a>
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-600 rounded-lg border border-rose-100 hover:border-rose-600 transition-all cursor-pointer active:scale-95 flex items-center justify-center"
                        title="Hapus dari Google Drive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Dialog Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col text-slate-800 overflow-hidden w-full max-w-lg relative">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-white shrink-0">
              <h3 className="font-bold text-slate-800 text-sm md:text-base tracking-tight uppercase">
                Upload File ke Google Drive
              </h3>
              <button
                disabled={fileUploading}
                onClick={() => {
                  setIsUploadOpen(false);
                  setUploadClientName('');
                  setSelectedScheduleId('');
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors border-0 cursor-pointer disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Client Selection */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Klien / Perusahaan</label>
                <select
                  value={uploadClientName}
                  disabled={fileUploading}
                  onChange={e => {
                    setUploadClientName(e.target.value);
                    setSelectedScheduleId(''); // reset linked schedule on client switch
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 font-semibold h-10"
                >
                  <option value="">-- Pilih Perusahaan Klien --</option>
                  {clientFolders.map(folder => (
                    <option key={folder} value={folder}>{folder}</option>
                  ))}
                  <option value="CUSTOM">++ Tambah Perusahaan Baru ++</option>
                </select>
              </div>

              {/* Custom Client Name Input */}
              {uploadClientName === 'CUSTOM' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Nama Perusahaan Baru</label>
                  <input
                    type="text"
                    disabled={fileUploading}
                    placeholder="Masukkan nama PT / CV..."
                    onChange={e => setUploadClientName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 placeholder-slate-400 font-bold h-10"
                  />
                </div>
              )}

              {/* Category */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Kategori Dokumen</label>
                <select
                  value={uploadCategory}
                  disabled={fileUploading}
                  onChange={e => setUploadCategory(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 font-semibold h-10"
                >
                  <option value="Sertifikat">Sertifikat</option>
                  <option value="Foto Lapangan">Foto Lapangan</option>
                  <option value="Laporan Riksa">Laporan Riksa</option>
                  <option value="Dokumen Pendukung">Dokumen Pendukung</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              {/* Link file to specific schedule (optional) */}
              {uploadClientName && uploadClientName !== 'CUSTOM' && clientSchedules.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Hubungkan ke Agenda Jadwal (Opsional)</label>
                  <select
                    value={selectedScheduleId}
                    disabled={fileUploading}
                    onChange={e => setSelectedScheduleId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 font-semibold h-10"
                  >
                    <option value="">-- Tidak Dihubungkan ke Jadwal --</option>
                    {clientSchedules.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.start_date} • {s.agenda_type} ({s.unit_ids.length} Unit)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* File Upload Box */}
              {uploadClientName && uploadClientName !== 'CUSTOM' && (
                <div className="space-y-1.5 pt-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">File Unggahan</label>
                  <div className="relative">
                    <input
                      type="file"
                      id="modal-file-input"
                      onChange={handleUploadChange}
                      disabled={fileUploading}
                      className="hidden"
                    />
                    <label
                      htmlFor="modal-file-input"
                      className={`w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/10 rounded-2xl py-8 cursor-pointer transition-all ${fileUploading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      {fileUploading ? (
                        <>
                          <Loader className="h-8 w-8 animate-spin text-emerald-600" />
                          <span className="text-xs font-bold text-slate-600 font-sans">Sedang Mengupload ke Google Drive...</span>
                          <span className="text-[10px] text-slate-400 font-medium">Mohon tidak menutup jendela ini</span>
                        </>
                      ) : (
                        <>
                          <FileUp className="h-8 w-8 text-emerald-600" />
                          <span className="text-xs font-bold text-slate-700">Pilih berkas dari perangkat Anda</span>
                          <span className="text-[9px] text-slate-400 font-semibold uppercase">Maksimal 4.5 MB</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// X svg close button
function X(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
