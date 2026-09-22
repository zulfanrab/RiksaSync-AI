/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Manpower {
  id: string;
  name: string;
  role: string;
  status: 'internal' | 'external';
  skp: string[]; // List of SKP licenses/skills
}

export interface Unit {
  id: string;
  unit_name: string;
  required_skp: string;
}

export interface Schedule {
  id: string;
  client_name: string;
  pic_name: string;
  pic_phone?: string; // Contact PIC
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  start_time?: string; // Optional HH:MM
  end_time?: string;   // Optional HH:MM
  unit_ids?: string[]; // Array of Unit IDs (optional for non-technical agendas)
  lead_expert_id?: string; // Optional for non-technical agendas
  support_ids: string[]; // Array of Support Manpower IDs / Participants
  priority: 'P1' | 'P2' | 'P3'; // P1: Critical, P2: High, P3: Medium
  status: 'Draft' | 'Scheduled' | 'Completed' | 'Cancelled';
  unit_descriptions?: string[]; // Optional unit descriptions
  created_by?: string;
  updated_by?: string;
  agenda_type?: string;        // 'Riksa Uji' | 'Meeting' | 'Survey' | 'Lainnya'
  manual_agenda?: string;      // Manual text input for 'Lainnya'
  is_until_finished?: boolean; // Until finished option
  location?: string;           // Meeting or Survey Location
}

export interface Client {
  id: string;
  client_name: string;
  pic_name: string;
  pic_phone: string;
}

export interface AppUser {
  id: string;
  username: string;
  role: string;
}

export interface ManpowerAbsence {
  id: string;
  manpower_id: string;
  date: string; // YYYY-MM-DD
  absence_type: 'Sakit' | 'Cuti' | 'Izin';
  reason?: string;
}

export type TaskCategory = 
  | 'Notulensi' 
  | 'Laporan Bulanan' 
  | 'Buat Surat' 
  | 'Ketemu Klien' 
  | 'Riksa Uji' 
  | 'Survey' 
  | 'Follow-up' 
  | 'Lainnya';

export interface TeamTask {
  id: string;
  title: string;
  description: string;
  assignee_id: string; // References Manpower.id (primary or first assignee)
  assignee_ids?: string[]; // Multiple assignees (array of Manpower.id)
  due_date: string; // YYYY-MM-DD
  due_time?: string; // HH:MM
  priority: 'P1' | 'P2' | 'P3'; // P1: Tinggi (Red), P2: Sedang (Yellow), P3: Rendah (Green)
  status: 'To Do' | 'In Progress' | 'Done' | 'Cancelled';
  category: TaskCategory | string;
  recurrence: 'None' | 'Daily' | 'Weekly' | 'Monthly';
  visibility: 'Public' | 'Private';
  cancel_reason?: string;
  created_at: string;
  created_by?: string;
  updated_at?: string;
}

export interface QuickLink {
  id: string;
  title: string;
  url: string;
  emoji: string;
  created_by?: string;
  created_at: string;
}

export interface DBState {
  manpower: Manpower[];
  units: Unit[];
  schedules: Schedule[];
  tasks: TeamTask[];
}

// ============================================================
// MODULE: Retensi & Follow-Up (Client Retention Tracker)
// ============================================================

export interface ClientEquipment {
  id: string;
  client_id: string;
  equipment_name: string;          // e.g. "Forklift 5 Ton Unit-01"
  equipment_type: string;          // e.g. "PAA", "PUBT", "PTP"
  last_inspection_date: string;    // YYYY-MM-DD
  due_date: string;                // YYYY-MM-DD (last + 365 days)
  certificate_number?: string;     // No. Suket Disnaker
  created_at?: string;
  updated_at?: string;
}

export type FollowUpStage = 'FU 1' | 'FU 2' | 'FU 3';
export type FollowUpStatus = 'Pending' | 'Contacted' | 'Minta Mundur' | 'Deal (Lanjut)' | 'Lost (Lepas)';

export interface FollowUpLog {
  id: string;
  client_id: string;
  equipment_id?: string;
  stage: FollowUpStage;
  status: FollowUpStatus;
  contacted_at?: string;           // ISO timestamp kapan WA dikirim / kontak dibuat
  contacted_by?: string;           // Username admin
  notes?: string;                  // Catatan / respon klien
  offer_doc_url?: string;          // Link Google Drive - Dokumen Penawaran
  invoice_doc_url?: string;        // Link Google Drive - Invoice
  created_at?: string;
}

// Combined view: client + its equipments + latest follow-up log per equipment
export interface RetentionClient {
  id: string;
  client_name: string;
  pic_name: string;
  pic_phone: string;
  pic_email?: string;
  drive_folder_url?: string;       // Link folder Google Drive milik klien
  notes?: string;
  created_at?: string;
  // Joined data
  equipments?: ClientEquipment[];
  // Latest log for quick display
  latest_log?: FollowUpLog;
}

// Helper: compute urgency level from due_date
export type UrgencyLevel = 'critical' | 'warning' | 'safe' | 'overdue' | 'deal' | 'lost';

// ============================================================
// MODULE: Progress Pemeriksaan (Inspection Pipeline)
// ============================================================

export type InspectionStage =
  | 'Penawaran'
  | 'Negosiasi'
  | 'Penjadwalan'
  | 'Pelaksanaan'
  | 'Laporan'
  | 'Proses Disnaker'
  | 'Suket Terbit';

export interface JobNote {
  id: string;
  text: string;
  created_at: string;
  created_by: string; // User Name
  linked_task_id?: string;
}

export interface InspectionJob {
  id: string;
  client_id?: string;
  equipment_id?: string;
  client_name: string;             // Denormalized for quick display
  pic_name: string;
  pic_phone?: string;
  equipment_name: string;
  equipment_type: string;
  due_date?: string;               // Original certificate due date
  stage: InspectionStage;
  offer_doc_url?: string;
  spk_doc_url?: string;
  report_doc_url?: string;
  suket_doc_url?: string;
  scheduled_date?: string;         // YYYY-MM-DD planned inspection
  completed_date?: string;         // YYYY-MM-DD actual completion
  assigned_lead?: string;          // Manpower ID
  notes?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}
