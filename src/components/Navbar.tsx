/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Database, Cpu, HelpCircle, RefreshCw, LogOut } from 'lucide-react';
import Logo from './Logo';
import { useUser } from '../context/UserContext';

interface NavbarProps {
  supabaseConnected: boolean;
  geminiConnected: boolean;
  onRefreshAll: () => void;
  isRefreshing: boolean;
}

export default function Navbar({
  supabaseConnected,
  geminiConnected,
  onRefreshAll,
  isRefreshing
}: NavbarProps) {
  const { activeUser, activeUserRole, logout } = useUser();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-4 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-9" />
          <div>
            <h1 className="font-sans font-bold text-lg text-slate-800 tracking-tight leading-none">
              RiksaSync <span className="text-emerald-600 font-mono text-xs uppercase font-semibold">AI</span>
            </h1>
            <p className="text-[10px] text-slate-400 mt-1 font-sans font-medium uppercase tracking-widest">Manpower & Inspection Engine</p>
          </div>
        </div>

        {/* Integration Status & Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            {/* Supabase Status */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono border ${
                supabaseConnected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 bg-opacity-10'
                  : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}
              title={supabaseConnected ? 'Supabase Database Connected' : 'Supabase Offline (Using local JSON backup)'}
            >
              <Database className="h-3 w-3" />
              <span>Supabase: {supabaseConnected ? 'ONLINE' : 'FALLBACK'}</span>
            </div>

            {/* Gemini Status */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono border ${
                geminiConnected
                  ? 'bg-amber-500/10 border-amber-300 text-[#B8860B]'
                  : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}
              title={geminiConnected ? 'Gemini AI Active' : 'Gemini Offline (Using local smart planner)'}
            >
              <Cpu className="h-3 w-3" />
              <span>Gemini AI: {geminiConnected ? 'ACTIVE' : 'FALLBACK'}</span>
            </div>
          </div>

          {/* Quick Action Button */}
          <button
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-semibold text-xs px-3 py-1.5 rounded-lg border border-slate-200 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">Sync Data</span>
          </button>

          {/* User Badge & Switch Account */}
          {activeUser && (
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
              <div className="hidden sm:block text-right">
                <span className="text-xs font-bold text-slate-800 block leading-none">{activeUser}</span>
                <span className="text-[9px] text-emerald-600 font-bold block mt-0.5 uppercase tracking-wider">{activeUserRole || 'Staff'}</span>
              </div>
              <button
                onClick={logout}
                title="Ganti Profil Pengguna (Keluar)"
                className="p-1.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-400 rounded-lg border border-slate-200 transition-all flex items-center justify-center shrink-0 active:scale-95"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
