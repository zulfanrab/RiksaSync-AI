const fs = require('fs');

let types = fs.readFileSync('src/types.ts', 'utf8');
types = types.replace(
  /export type InspectionStage =[\s\S]*?\| 'Suket Terbit';/,
  `export type InspectionStage =
  | 'Penawaran'
  | 'Negosiasi'
  | 'Penjadwalan'
  | 'Pelaksanaan'
  | 'Laporan'
  | 'Proses Disnaker'
  | 'Suket Terbit';`
);
fs.writeFileSync('src/types.ts', types);

let app = fs.readFileSync('src/components/InspectionPipelineModule.tsx', 'utf8');

// Update imports
app = app.replace(
  /ChevronRight, ArrowRight, Building2, Phone, AlertTriangle, Download/,
  'ChevronRight, ArrowRight, Building2, Phone, AlertTriangle, Download, Handshake, Landmark'
);

// Update STAGES
app = app.replace(
  /const STAGES: InspectionStage\[\] = \['Penawaran', 'SPK Diterima', 'Penjadwalan', 'Pelaksanaan', 'Laporan', 'Suket Terbit'\];/,
  "const STAGES: InspectionStage[] = ['Penawaran', 'Negosiasi', 'Penjadwalan', 'Pelaksanaan', 'Laporan', 'Proses Disnaker', 'Suket Terbit'];"
);

// Update STAGE_CONFIG
const oldStageConfig = /const STAGE_CONFIG: Record<InspectionStage, \{ icon: React\.ElementType; color: string; bg: string; border: string; desc: string \}> = \{[\s\S]*?Sertifikat Disnaker sudah terbit' \},\n\};/;
const newStageConfig = `const STAGE_CONFIG: Record<InspectionStage, { icon: React.ElementType; color: string; bg: string; border: string; desc: string }> = {
  'Penawaran':       { icon: FileText,       color: 'text-sky-600',     bg: 'bg-sky-50',     border: 'border-sky-200',     desc: 'Draf penawaran dikirim ke klien' },
  'Negosiasi':       { icon: Handshake,      color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  desc: 'Proses negosiasi penawaran harga' },
  'Penjadwalan':     { icon: Calendar,       color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   desc: 'Tanggal pelaksanaan sedang dijadwalkan' },
  'Pelaksanaan':     { icon: Wrench,         color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200',  desc: 'Inspeksi/riksa uji sedang berlangsung' },
  'Laporan':         { icon: ClipboardList,  color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200',  desc: 'Laporan teknis sedang disusun' },
  'Proses Disnaker': { icon: Landmark,       color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200',    desc: 'Pengurusan berkas di dinas terkait' },
  'Suket Terbit':    { icon: CheckCircle2,   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', desc: 'Sertifikat Disnaker sudah terbit' },
};`;
app = app.replace(oldStageConfig, newStageConfig);

// Update initialGroups
app = app.replace(
  /'Penawaran': \[\], 'SPK Diterima': \[\], 'Penjadwalan': \[\], 'Pelaksanaan': \[\], 'Laporan': \[\], 'Suket Terbit': \[\]/,
  "'Penawaran': [], 'Negosiasi': [], 'Penjadwalan': [], 'Pelaksanaan': [], 'Laporan': [], 'Proses Disnaker': [], 'Suket Terbit': []"
);

fs.writeFileSync('src/components/InspectionPipelineModule.tsx', app);
console.log('Stages updated successfully.');
