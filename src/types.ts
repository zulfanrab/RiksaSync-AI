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
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  start_time?: string; // Optional HH:MM
  end_time?: string;   // Optional HH:MM
  unit_ids: string[]; // Array of Unit IDs
  lead_expert_id: string;
  support_ids: string[]; // Array of Support Manpower IDs
  priority: 'P1' | 'P2' | 'P3'; // P1: Critical, P2: High, P3: Medium
  status: 'Draft' | 'Scheduled' | 'Completed' | 'Cancelled';
  unit_descriptions?: string[]; // Optional unit descriptions
  created_by?: string;
  updated_by?: string;
  agenda_type?: string;        // 'Riksa Uji' | 'Survey' | 'Lainnya'
  manual_agenda?: string;      // Manual text input for 'Lainnya'
  is_until_finished?: boolean; // Until finished option
}

export interface AppUser {
  id: string;
  username: string;
  role: string;
}

export interface DBState {
  manpower: Manpower[];
  units: Unit[];
  schedules: Schedule[];
}
