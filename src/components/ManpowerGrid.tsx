/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { User, ShieldCheck, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Manpower, Schedule } from '../types';

interface ManpowerGridProps {
  manpowerList: Manpower[];
  schedules: Schedule[];
  selectedDate: string; // YYYY-MM-DD
}

export default function ManpowerGrid({ manpowerList, schedules, selectedDate }: ManpowerGridProps) {
  // Check if a person is booked on a specific date
  const getBookingStatus = (manId: string, dateStr: string): { status: 'Free' | 'Booked'; clientName?: string; isLead?: boolean } => {
    const activeSchedules = schedules.filter(s => s.status !== 'Cancelled');
    const matchingSchedule = activeSchedules.find(s => {
      const isBooked = s.lead_expert_id === manId || s.support_ids.includes(manId);
      const isOverlapping = dateStr >= s.start_date && dateStr <= s.end_date;
      return isBooked && isOverlapping;
    });

    if (matchingSchedule) {
      return {
        status: 'Booked',
        clientName: matchingSchedule.client_name,
        isLead: matchingSchedule.lead_expert_id === manId
      };
    }
    return { status: 'Free' };
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-800 text-sm tracking-tight">Status Manpower & Direktori SKP</h3>
          <p className="text-xs text-slate-500">Status penugasan tim pada tanggal <span className="text-emerald-600 font-mono font-semibold">{selectedDate}</span></p>
        </div>
        <div className="flex gap-2 text-[10px]">
          <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full border border-emerald-100 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" /> Tersedia
          </span>
          <span className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full border border-amber-100 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Bertugas
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
        {manpowerList.map((person) => {
          const booking = getBookingStatus(person.id, selectedDate);
          const isBooked = booking.status === 'Booked';

          return (
            <div
              key={person.id}
              className={`p-3 rounded-xl border transition-all ${
                isBooked
                  ? 'bg-amber-50/30 border-amber-200 hover:border-amber-300'
                  : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg border ${
                    isBooked 
                      ? 'bg-amber-100/40 border-amber-200 text-amber-700' 
                      : 'bg-emerald-100/40 border-emerald-200 text-emerald-700'
                  }`}>
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 text-xs">{person.name}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase border ${
                        person.status === 'internal' 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                          : 'bg-purple-50 text-purple-600 border-purple-100'
                      }`}>
                        {person.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">{person.role}</span>
                  </div>
                </div>

                {/* Booking status badge */}
                <div className="text-right">
                  {isBooked ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      <Clock className="h-2.5 w-2.5" /> Sibuk
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Ready
                    </span>
                  )}
                </div>
              </div>

              {/* SKP List */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1 items-center">
                <span className="text-[9px] text-slate-400 mr-1 flex items-center gap-0.5 font-sans font-semibold uppercase tracking-wider">
                  <ShieldCheck className="h-3 w-3 text-amber-500" /> SKP:
                </span>
                {person.skp && person.skp.length > 0 ? (
                  person.skp.map((license) => (
                    <span
                      key={license}
                      className="text-[9px] bg-slate-100 text-slate-600 font-mono font-semibold px-2 py-0.5 rounded border border-slate-200"
                    >
                      {license}
                    </span>
                  ))
                ) : (
                  <span className="text-[9px] text-slate-400 italic">Tidak ada SKP</span>
                )}
              </div>

              {/* Assignment detail if booked */}
              {isBooked && (
                <div className="mt-2 text-[10px] bg-amber-50 text-amber-800 px-2.5 py-1.5 rounded-lg border border-amber-200 flex items-start gap-1.5 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span className="truncate">
                    {booking.isLead ? 'Lead Expert' : 'Support'} di <strong className="text-amber-900 font-bold">"{booking.clientName}"</strong>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
