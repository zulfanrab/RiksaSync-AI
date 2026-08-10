/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HelpCircle, RefreshCw, LogOut } from 'lucide-react';
import Logo from './Logo';
import { useUser } from '../context/UserContext';
import NotificationCenter from './NotificationCenter';

interface NavbarProps {
  supabaseConnected: boolean;
  geminiConnected: boolean;
  onRefreshAll: () => void;
  isRefreshing: boolean;
  onOpenGuide: () => void;
}

export default function Navbar({
  supabaseConnected,
  geminiConnected,
  onRefreshAll,
  isRefreshing,
  onOpenGuide
}: NavbarProps) {
  const { activeUser, activeUserRole, logout } = useUser();

  return (
    <header className="bg-white border-b border-slate-200 relative md:sticky md:top-0 z-50 px-3.5 py-2.5 sm:px-6 sm:py-4 shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Logo className="h-8 w-8 sm:h-11 sm:w-11 shrink-0" />
          <div>
            <h1 className="font-sans font-extrabold text-sm sm:text-lg text-slate-800 tracking-tight leading-none">
              AksaraSync <span className="text-emerald-600 font-mono text-[10px] sm:text-xs uppercase font-bold">AI</span>
            </h1>
            <p className="hidden xs:block text-[9px] text-slate-400 mt-0.5 font-sans font-medium uppercase tracking-widest">
              Manpower & Inspection Engine
            </p>
          </div>
        </div>

        {/* Integration Status & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Notification Center */}
          <NotificationCenter className="hidden md:block" />

          {/* Guide Button */}
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] sm:text-xs px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-emerald-200 transition-all cursor-pointer shadow-2xs active:scale-95"
            title="Buku Panduan Penggunaan Aplikasi"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Panduan</span>
          </button>

          {/* Quick Action Button */}
          <button
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-bold text-[11px] sm:text-xs px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync Data</span>
          </button>

          {/* User Badge & Switch Account */}
          {activeUser && (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-2 sm:pl-3">
              <div className="hidden sm:block text-right">
                <span className="text-xs font-bold text-slate-800 block leading-none">{activeUser}</span>
                <span className="text-[9px] text-emerald-600 font-bold block mt-0.5 uppercase tracking-wider">{activeUserRole || 'Staff'}</span>
              </div>
              <button
                onClick={logout}
                title="Ganti Profil Pengguna (Keluar)"
                className="p-1.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-400 rounded-lg border border-slate-200 transition-all flex items-center justify-center shrink-0 active:scale-95"
              >
                <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
