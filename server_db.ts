/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { Manpower, Unit, Schedule, DBState, AppUser } from './src/types';



export class DatabaseManager {
  private supabase: any = null;

  constructor() {
    this.initDatabase();
  }

  private initDatabase() {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

    if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('https://')) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        console.log('Supabase client successfully initialized on backend.');
      } catch (err) {
        console.error('Failed to initialize Supabase client:', err);
      }
    } else {
      console.error('Supabase credentials not configured in backend environment.');
    }
  }

  // --- Manpower API ---
  async getManpower(): Promise<Manpower[]> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('manpower').select('*');
    if (error) {
      throw new Error(`Error fetching manpower: ${error.message}`);
    }
    return data as Manpower[];
  }

  async addManpower(person: Omit<Manpower, 'id'>): Promise<Manpower> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('manpower').insert([person]).select();
    if (error) {
      throw new Error(`Error adding manpower: ${error.message}`);
    }
    if (!data || data.length === 0) {
      throw new Error('Failed to insert manpower: No data returned');
    }
    return data[0] as Manpower;
  }

  // --- Units API ---
  async getUnits(): Promise<Unit[]> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('units').select('*');
    if (error) {
      throw new Error(`Error fetching units: ${error.message}`);
    }
    return data as Unit[];
  }

  async addUnit(unit: Omit<Unit, 'id'>): Promise<Unit> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('units').insert([unit]).select();
    if (error) {
      throw new Error(`Error adding unit: ${error.message}`);
    }
    if (!data || data.length === 0) {
      throw new Error('Failed to insert unit: No data returned');
    }
    return data[0] as Unit;
  }

  // --- Schedules API ---
  async getSchedules(): Promise<Schedule[]> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('schedules').select('*');
    if (error) {
      throw new Error(`Error fetching schedules: ${error.message}`);
    }
    return data as Schedule[];
  }

  async addSchedule(schedule: Omit<Schedule, 'id'>): Promise<Schedule> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('schedules').insert([schedule]).select();
    if (error) {
      throw new Error(`Error adding schedule: ${error.message}`);
    }
    if (!data || data.length === 0) {
      throw new Error('Failed to insert schedule: No data returned');
    }
    return data[0] as Schedule;
  }

  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule | null> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('schedules').update(updates).eq('id', id).select();
    if (error) {
      throw new Error(`Error updating schedule: ${error.message}`);
    }
    if (!data || data.length === 0) {
      return null;
    }
    return data[0] as Schedule;
  }

  async deleteSchedule(id: string): Promise<boolean> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { error } = await this.supabase.from('schedules').delete().eq('id', id);
    if (error) {
      throw new Error(`Error deleting schedule: ${error.message}`);
    }
    return true;
  }

  async getAppUsers(): Promise<AppUser[]> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured on the backend.');
    }
    const { data, error } = await this.supabase.from('app_users').select('*');
    if (error) {
      throw new Error(`Error fetching app_users: ${error.message}`);
    }
    return data as AppUser[];
  }

  async getFullState(): Promise<DBState> {
    const [manpower, units, schedules] = await Promise.all([
      this.getManpower(),
      this.getUnits(),
      this.getSchedules()
    ]);
    return { manpower, units, schedules };
  }

  isSupabaseConnected(): boolean {
    return !!this.supabase;
  }
}

export const dbManager = new DatabaseManager();
