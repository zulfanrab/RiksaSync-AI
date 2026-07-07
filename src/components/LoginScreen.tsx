import React from 'react';
import { useUser } from '../context/UserContext';
import { User, Sparkles, LogIn, Shield } from 'lucide-react';
import { motion } from 'motion/react';

export default function LoginScreen() {
  const { appUsers, setActiveUser, loading } = useUser();

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center p-4">
      {/* Absolute background decoration */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-[#D4AF37]" />

      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-8 space-y-8 relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-50 rounded-full -z-10 opacity-60" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-teal-50 rounded-full -z-10 opacity-50" />

        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 mb-2">
            <Sparkles className="h-6 w-6 text-emerald-600 animate-pulse" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">RiksaSync AI</h1>
          <p className="text-xs text-slate-500 font-medium">
            Sistem Manajemen Plotting Jadwal & Ahli Keselamatan Kerja PJK3
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <User className="h-4 w-4 text-slate-400" />
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pilih Profil Pengguna</h2>
          </div>

          {loading ? (
            <div className="space-y-3 py-6 text-center">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-medium font-mono">Memuat daftar pengguna...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {appUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setActiveUser(user.username)}
                  className="w-full text-left bg-slate-50 hover:bg-emerald-50/40 border border-slate-200/80 hover:border-emerald-300 rounded-2xl p-4 flex items-center justify-between transition-all duration-200 group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-emerald-600 group-hover:border-emerald-200 transition-colors">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-sm block group-hover:text-emerald-900 transition-colors">
                        {user.username}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                        {user.role}
                      </span>
                    </div>
                  </div>
                  
                  <div className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:border-emerald-500 group-hover:text-white transition-all shadow-sm">
                    <LogIn className="h-3.5 w-3.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            Auto-Login aktif: Sesi Anda akan disimpan di browser ini.
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
        <Shield className="h-3.5 w-3.5 text-emerald-600" />
        <span>Secure Password-less Environment</span>
      </div>
    </div>
  );
}
