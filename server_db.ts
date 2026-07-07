/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { Manpower, Unit, Schedule, DBState, AppUser } from './src/types';

const DB_FILE_PATH = path.join(process.cwd(), 'schedules_db.json');

const INITIAL_APP_USERS: AppUser[] = [
  { id: 'u1', username: 'Zulfan', role: 'IT Staff' },
  { id: 'u2', username: 'Angga', role: 'Leader & Ahli Utama' },
  { id: 'u3', username: 'Imam', role: 'Ahli Spesialis' },
  { id: 'u4', username: 'Fakhziar', role: 'Ahli Spesialis' },
  { id: 'u5', username: 'Fauzan', role: 'Ahli Spesialis' },
  { id: 'u6', username: 'Ajay', role: 'Support Staff' },
  { id: 'u7', username: 'Arya', role: 'Support Staff' }
];

// Hardcoded initial data as specified in the prompt
const INITIAL_MANPOWER: Manpower[] = [
  { id: 'm1', name: 'Angga', role: 'Leader & Ahli Utama', status: 'internal', skp: ['PTP', 'PAA', 'Elevator', 'Eskalator'] },
  { id: 'm2', name: 'Imam', role: 'Ahli Spesialis', status: 'internal', skp: ['PUBT', 'Instalasi Listrik'] },
  { id: 'm3', name: 'Fakhziar', role: 'Ahli Spesialis', status: 'internal', skp: ['PUBT'] },
  { id: 'm4', name: 'Fauzan', role: 'Ahli Spesialis', status: 'internal', skp: ['Instalasi Listrik', 'PAA'] },
  { id: 'm5', name: 'Katez', role: 'Ahli Eksternal', status: 'external', skp: ['Angkur TKPK'] },
  { id: 'm6', name: 'Riyan', role: 'Helper & Teknisi', status: 'external', skp: [] },
  { id: 'm7', name: 'Ajay', role: 'Support Staff', status: 'internal', skp: [] },
  { id: 'm8', name: 'Arya', role: 'Support Staff', status: 'internal', skp: [] }
];

const INITIAL_UNITS: Unit[] = [
  { id: 'u1', unit_name: 'Pesawat Tenaga dan Produksi (PTP)', required_skp: 'PTP' },
  { id: 'u2', unit_name: 'Pesawat Angkat dan Angkut (PAA)', required_skp: 'PAA' },
  { id: 'u3', unit_name: 'Elevator & Eskalator', required_skp: 'Elevator' },
  { id: 'u4', unit_name: 'Pesawat Uap dan Bejana Tekan (PUBT)', required_skp: 'PUBT' },
  { id: 'u5', unit_name: 'Instalasi Penyalur Petir', required_skp: 'Instalasi Listrik' },
  { id: 'u6', unit_name: 'Angkur & TKPK', required_skp: 'Angkur TKPK' },
  { id: 'u7', unit_name: 'Instalasi Listrik', required_skp: 'Instalasi Listrik' }
];

// Let's pre-populate some realistic initial schedules to make the app gorgeous and testable immediately
const INITIAL_SCHEDULES: Schedule[] = [
  {
    id: 's1',
    client_name: 'PT Maju Jaya Sentosa',
    pic_name: 'Bpk. Budi',
    start_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days ago
    end_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],   // tomorrow
    unit_ids: ['u1', 'u2'],
    lead_expert_id: 'm1', // Angga
    support_ids: ['m7', 'm8'], // Ajay & Arya
    priority: 'P2',
    status: 'Scheduled'
  },
  {
    id: 's2',
    client_name: 'Rumah Sakit Sehat Sejahtera',
    pic_name: 'Ibu Linda',
    start_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // in 2 days
    end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],   // in 3 days
    unit_ids: ['u4'],
    lead_expert_id: 'm2', // Imam
    support_ids: ['m6'], // Riyan (Helper)
    priority: 'P1',
    status: 'Scheduled'
  },
  {
    id: 's3',
    client_name: 'Apartemen Green View',
    pic_name: 'Bpk. Rahmat',
    start_date: new Date().toISOString().split('T')[0], // today
    end_date: new Date().toISOString().split('T')[0],   // today
    unit_ids: ['u3'],
    lead_expert_id: 'm1', // Angga
    support_ids: ['m6', 'm7'], // Riyan & Ajay
    priority: 'P3',
    status: 'Scheduled'
  }
];

export class DatabaseManager {
  private localState: DBState = {
    manpower: INITIAL_MANPOWER,
    units: INITIAL_UNITS,
    schedules: INITIAL_SCHEDULES
  };

  private supabase: any = null;
  private useSupabase = false;

  constructor() {
    this.initDatabase();
  }

  private initDatabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.useSupabase = true;
        console.log('Supabase client successfully initialized.');
      } catch (err) {
        console.error('Failed to initialize Supabase client:', err);
      }
    }

    // Load local storage JSON backup if it exists
    if (fs.existsSync(DB_FILE_PATH)) {
      try {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.manpower && parsed.units && parsed.schedules) {
          this.localState = parsed;
          console.log('Loaded database state from local file schedules_db.json');
        }
      } catch (err) {
        console.error('Error reading local database file, using fallback initial data:', err);
      }
    } else {
      this.saveLocal();
    }
  }

  private saveLocal() {
    try {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(this.localState, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write local database file:', err);
    }
  }

  // --- Manpower API ---
  async getManpower(): Promise<Manpower[]> {
    if (this.useSupabase) {
      try {
        const { data, error } = await this.supabase.from('manpower').select('*');
        if (!error && data) return data as Manpower[];
        console.log('[DB Sync Info] Supabase manpower is not available, using local data source.');
      } catch (err) {
        // Safe silent catch
      }
    }
    return this.localState.manpower;
  }

  async addManpower(person: Omit<Manpower, 'id'>): Promise<Manpower> {
    const newPerson: Manpower = {
      ...person,
      id: 'm_' + Math.random().toString(36).substr(2, 9)
    };

    if (this.useSupabase) {
      try {
        const { data, error } = await this.supabase.from('manpower').insert([newPerson]).select();
        if (!error && data && data[0]) return data[0] as Manpower;
        console.log('[DB Sync Info] Supabase addManpower is not available, using local data source.');
      } catch (err) {
        // Safe silent catch
      }
    }

    this.localState.manpower.push(newPerson);
    this.saveLocal();
    return newPerson;
  }

  // --- Units API ---
  async getUnits(): Promise<Unit[]> {
    if (this.useSupabase) {
      try {
        const { data, error } = await this.supabase.from('units').select('*');
        if (!error && data) return data as Unit[];
        console.log('[DB Sync Info] Supabase units is not available, using local data source.');
      } catch (err) {
        // Safe silent catch
      }
    }
    return this.localState.units;
  }

  async addUnit(unit: Omit<Unit, 'id'>): Promise<Unit> {
    const newUnit: Unit = {
      ...unit,
      id: 'u_' + Math.random().toString(36).substr(2, 9)
    };

    if (this.useSupabase) {
      try {
        const { data, error } = await this.supabase.from('units').insert([newUnit]).select();
        if (!error && data && data[0]) return data[0] as Unit;
        console.log('[DB Sync Info] Supabase addUnit is not available, using local data source.');
      } catch (err) {
        // Safe silent catch
      }
    }

    this.localState.units.push(newUnit);
    this.saveLocal();
    return newUnit;
  }

  // --- Schedules API ---
  async getSchedules(): Promise<Schedule[]> {
    if (this.useSupabase) {
      try {
        const { data, error } = await this.supabase.from('schedules').select('*');
        if (!error && data) return data as Schedule[];
        console.log('[DB Sync Info] Supabase schedules is not available, using local data source.');
      } catch (err) {
        // Safe silent catch
      }
    }
    return this.localState.schedules;
  }

  async addSchedule(schedule: Omit<Schedule, 'id'>): Promise<Schedule> {
    const newSchedule: Schedule = {
      ...schedule,
      id: 's_' + Math.random().toString(36).substr(2, 9)
    };

    if (this.useSupabase) {
      try {
        const { data, error } = await this.supabase.from('schedules').insert([newSchedule]).select();
        if (!error && data && data[0]) return data[0] as Schedule;
        console.log('[DB Sync Info] Supabase addSchedule is not available, using local data source.');
      } catch (err) {
        // Safe silent catch
      }
    }

    this.localState.schedules.push(newSchedule);
    this.saveLocal();
    return newSchedule;
  }

  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule | null> {
    if (this.useSupabase) {
      try {
        const { data, error } = await this.supabase.from('schedules').update(updates).eq('id', id).select();
        if (!error && data && data[0]) return data[0] as Schedule;
        console.log('[DB Sync Info] Supabase updateSchedule is not available, using local data source.');
      } catch (err) {
        // Safe silent catch
      }
    }

    const idx = this.localState.schedules.findIndex(s => s.id === id);
    if (idx === -1) return null;

    this.localState.schedules[idx] = {
      ...this.localState.schedules[idx],
      ...updates
    };
    this.saveLocal();
    return this.localState.schedules[idx];
  }

  async deleteSchedule(id: string): Promise<boolean> {
    if (this.useSupabase) {
      try {
        const { error } = await this.supabase.from('schedules').delete().eq('id', id);
        if (!error) return true;
        console.log('[DB Sync Info] Supabase deleteSchedule is not available, using local data source.');
      } catch (err) {
        // Safe silent catch
      }
    }

    const idx = this.localState.schedules.findIndex(s => s.id === id);
    if (idx === -1) return false;

    this.localState.schedules.splice(idx, 1);
    this.saveLocal();
    return true;
  }

  async getAppUsers(): Promise<AppUser[]> {
    if (this.useSupabase) {
      try {
        const { data, error } = await this.supabase.from('app_users').select('*');
        if (!error && data) {
          const users = data as AppUser[];
          const hasAjay = users.some(u => u.username.toLowerCase() === 'ajay');
          const hasArya = users.some(u => u.username.toLowerCase() === 'arya');
          if (!hasAjay) {
            users.push({ id: 'u6', username: 'Ajay', role: 'Support Staff' });
          }
          if (!hasArya) {
            users.push({ id: 'u7', username: 'Arya', role: 'Support Staff' });
          }
          return users;
        }
        console.log('[DB Sync Info] Supabase app_users is not available, using local user list.');
      } catch (err) {
        // Safe silent catch
      }
    }
    return INITIAL_APP_USERS;
  }

  async getFullState(): Promise<DBState> {
    return {
      manpower: await this.getManpower(),
      units: await this.getUnits(),
      schedules: await this.getSchedules()
    };
  }

  isSupabaseConnected(): boolean {
    return this.useSupabase;
  }
}

export const dbManager = new DatabaseManager();
