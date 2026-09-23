import * as XLSX from 'xlsx';
import { RetentionClient, ClientEquipment, FollowUpLog, InspectionJob, Manpower } from '../types';

export const MONTHS = [
  { value: 'all', label: 'Semua Bulan' },
  { value: '01', label: 'Januari' },
  { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' }
];

export const filterByMonth = (dateString: string | null | undefined, selectedMonth: string) => {
  if (selectedMonth === 'all') return true;
  if (!dateString) return false;
  // dateString is typically YYYY-MM-DD
  const month = dateString.split('-')[1];
  return month === selectedMonth;
};

export const exportRetentionToExcel = (
  clients: RetentionClient[],
  equipments: ClientEquipment[],
  logs: FollowUpLog[],
  monthLabel: string
) => {
  const data = equipments.map(eq => {
    const client = clients.find(c => c.id === eq.client_id);
    const eqLogs = logs.filter(l => l.client_id === eq.client_id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latestLog = eqLogs[0];

    // Determine status logic (similar to stats calculation)
    let status = 'Aman';
    if (eq.due_date) {
      const today = new Date();
      const due = new Date(eq.due_date);
      const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (eq.status === 'deal' || eq.status === 'lost') {
        status = eq.status.toUpperCase();
      } else if (diffDays < 0) {
        status = 'OVERDUE (Lewat Tempo)';
      } else if (diffDays <= 30) {
        status = 'KRITIS (H-30)';
      } else if (diffDays <= 90) {
        status = 'SIAGA (H-90)';
      }
    }

    return {
      'Nama Perusahaan': client?.client_name || '-',
      'Nama PIC': client?.pic_name || '-',
      'Telepon PIC': client?.pic_phone || '-',
      'Nama Alat': eq.equipment_name,
      'Jenis Alat': eq.equipment_type || '-',
      'Status': status,
      'Tgl Jatuh Tempo': eq.due_date ? new Date(eq.due_date).toLocaleDateString('id-ID') : '-',
      'Catatan Terakhir': latestLog ? latestLog.notes : '-',
      'Tgl Follow Up Terakhir': latestLog ? new Date(latestLog.created_at).toLocaleDateString('id-ID') : '-'
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  // Auto-width columns
  const wscols = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
  ws['!cols'] = wscols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Retensi Klien');

  XLSX.writeFile(wb, \`Laporan_Retensi_Klien_\${monthLabel}_\${new Date().toISOString().split('T')[0]}.xlsx\`);
};

export const exportInspectionToExcel = (
  jobs: InspectionJob[],
  manpowerList: Manpower[],
  monthLabel: string
) => {
  const data = jobs.map(job => {
    const lead = manpowerList.find(m => m.id === job.assigned_lead);
    
    // Parse notes to get count
    let notesCount = 0;
    try {
      if (job.notes && job.notes.startsWith('[')) {
        notesCount = JSON.parse(job.notes).length;
      }
    } catch(e) {}

    return {
      'Nama Perusahaan': job.client_name || '-',
      'Nama PIC': job.pic_name || '-',
      'Nama Alat': job.equipment_name,
      'Jenis Alat': job.equipment_type || '-',
      'Stage (Status)': job.stage,
      'Lead Inspector': lead?.name || 'Belum di-assign',
      'Target Selesai': job.due_date ? new Date(job.due_date).toLocaleDateString('id-ID') : '-',
      'Jml Catatan/Diskusi': notesCount,
      'Link SPK': job.spk_doc_url || '-',
      'Link Laporan': job.report_doc_url || '-',
      'Link Suket': job.suket_doc_url || '-'
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  // Auto-width columns
  const wscols = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
  ws['!cols'] = wscols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Progress Pemeriksaan');

  XLSX.writeFile(wb, \`Laporan_Progress_Pemeriksaan_\${monthLabel}_\${new Date().toISOString().split('T')[0]}.xlsx\`);
};
