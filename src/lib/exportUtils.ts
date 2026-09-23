import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

export const YEARS = [
  { value: 'all', label: 'Semua Tahun' },
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
  { value: '2027', label: '2027' },
  { value: '2028', label: '2028' },
  { value: '2029', label: '2029' }
];

export const filterByDate = (dateString: string | null | undefined, selectedMonth: string, selectedYear: string) => {
  if (selectedMonth === 'all' && selectedYear === 'all') return true;
  if (!dateString) return false;
  
  const [year, month] = dateString.split('-');
  
  const monthMatch = selectedMonth === 'all' || month === selectedMonth;
  const yearMatch = selectedYear === 'all' || year === selectedYear;
  
  return monthMatch && yearMatch;
};

// ==========================================
// EXCEL EXPORT FUNCTIONS
// ==========================================

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
  const wscols = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
  ws['!cols'] = wscols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Retensi Klien');

  XLSX.writeFile(wb, `Laporan_Retensi_Klien_${monthLabel}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportInspectionToExcel = (
  jobs: InspectionJob[],
  manpowerList: Manpower[],
  monthLabel: string
) => {
  const data = jobs.map(job => {
    const lead = manpowerList.find(m => m.id === job.assigned_lead);
    
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
  const wscols = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
  ws['!cols'] = wscols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Progress Pemeriksaan');

  XLSX.writeFile(wb, `Laporan_Progress_Pemeriksaan_${monthLabel}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// ==========================================
// PDF EXPORT FUNCTIONS
// ==========================================

export const exportRetentionToPDF = (
  clients: RetentionClient[],
  equipments: ClientEquipment[],
  logs: FollowUpLog[],
  monthLabel: string
) => {
  const doc = new jsPDF('landscape');
  
  doc.setFontSize(16);
  doc.text(`Laporan Retensi Klien - ${monthLabel}`, 14, 22);
  doc.setFontSize(10);
  doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`, 14, 30);

  const tableColumn = ["Perusahaan", "PIC", "Telepon", "Nama Alat", "Tipe", "Status", "Jatuh Tempo", "Follow Up"];
  const tableRows: any[] = [];

  equipments.forEach(eq => {
    const client = clients.find(c => c.id === eq.client_id);
    const eqLogs = logs.filter(l => l.client_id === eq.client_id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latestLog = eqLogs[0];

    let status = 'Aman';
    if (eq.due_date) {
      const today = new Date();
      const due = new Date(eq.due_date);
      const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (eq.status === 'deal' || eq.status === 'lost') {
        status = eq.status.toUpperCase();
      } else if (diffDays < 0) {
        status = 'OVERDUE';
      } else if (diffDays <= 30) {
        status = 'KRITIS (H-30)';
      } else if (diffDays <= 90) {
        status = 'SIAGA (H-90)';
      }
    }

    const rowData = [
      client?.client_name || '-',
      client?.pic_name || '-',
      client?.pic_phone || '-',
      eq.equipment_name,
      eq.equipment_type || '-',
      status,
      eq.due_date ? new Date(eq.due_date).toLocaleDateString('id-ID') : '-',
      latestLog ? new Date(latestLog.created_at).toLocaleDateString('id-ID') : '-'
    ];
    tableRows.push(rowData);
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [5, 150, 105] } // Emerald 600
  });

  doc.save(`Laporan_Retensi_Klien_${monthLabel}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportInspectionToPDF = (
  jobs: InspectionJob[],
  manpowerList: Manpower[],
  monthLabel: string
) => {
  const doc = new jsPDF('landscape');
  
  doc.setFontSize(16);
  doc.text(`Laporan Progress Pemeriksaan - ${monthLabel}`, 14, 22);
  doc.setFontSize(10);
  doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`, 14, 30);

  const tableColumn = ["Perusahaan", "Nama Alat", "Jenis Alat", "Stage", "Lead Inspector", "Target Selesai", "Diskusi"];
  const tableRows: any[] = [];

  jobs.forEach(job => {
    const lead = manpowerList.find(m => m.id === job.assigned_lead);
    
    let notesCount = 0;
    try {
      if (job.notes && job.notes.startsWith('[')) {
        notesCount = JSON.parse(job.notes).length;
      }
    } catch(e) {}

    const rowData = [
      job.client_name || '-',
      job.equipment_name,
      job.equipment_type || '-',
      job.stage,
      lead?.name || 'Unassigned',
      job.due_date ? new Date(job.due_date).toLocaleDateString('id-ID') : '-',
      notesCount.toString()
    ];
    tableRows.push(rowData);
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 70, 229] } // Indigo 600
  });

  doc.save(`Laporan_Progress_Pemeriksaan_${monthLabel}_${new Date().toISOString().split('T')[0]}.pdf`);
};
