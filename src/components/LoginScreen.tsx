import React, { useState } from 'react';
import { useUser, DOMAIN_SUFFIX, formatEmailIdentifier } from '../context/UserContext';
import { User, Lock, Eye, EyeOff, LogIn, Shield, AlertTriangle, Sparkles, ChevronDown } from 'lucide-react';
import Logo from './Logo';

export default function LoginScreen() {
  const { login, appUsers, mounted, loading: contextLoading } = useUser();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Prevent SSR flash
  if (!mounted || contextLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-400 font-medium font-mono mt-3">Menghubungkan sesi autentikasi...</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMsg('Harap masukkan username atau email Anda.');
      return;
    }
    if (!password) {
      setErrorMsg('Harap masukkan password Anda.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await login(identifier, password);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal masuk. Periksa kembali username dan password Anda.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectQuickUser = (username: string) => {
    setIdentifier(username.toLowerCase());
    setShowUserDropdown(false);
    setErrorMsg(null);
  };

  const previewEmail = identifier ? formatEmailIdentifier(identifier) : `username${DOMAIN_SUFFIX}`;

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center p-4 relative">
      {/* Absolute top gradient decoration */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-[#D4AF37]" />

      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Subtle decorative circles */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-50 rounded-full -z-10 opacity-60" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-teal-50 rounded-full -z-10 opacity-50" />

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center mb-1">
            <Logo className="h-14 w-14 sm:h-16 sm:w-16" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">AksaraSync AI</h1>
          <p className="text-xs text-slate-500 font-medium">
            Sistem Manajemen Plotting Jadwal, Ahli K3 & Absensi Karyawan
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-800 animate-in fade-in">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            <p className="text-xs font-semibold leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Field Username / Email */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Username / Email Karyawan</label>
              <button
                type="button"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 transition-colors"
              >
                <span>Pilih Nama</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Quick Picker Dropdown */}
            {showUserDropdown && (
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl max-h-40 overflow-y-auto space-y-1 animate-in fade-in">
                <p className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 uppercase tracking-wider">
                  Klik nama untuk mengisi otomatis:
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {appUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectQuickUser(user.username)}
                      className="text-left px-2.5 py-1.5 bg-white hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80 rounded-lg text-xs font-medium text-slate-700 transition-colors flex items-center justify-between"
                    >
                      <span>{user.username}</span>
                      <span className="text-[9px] text-slate-400 font-normal">({user.role.split(' ')[0]})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="cth: zulfan atau zulfan@aksarariksapjk3.com"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 transition-all outline-none"
                autoComplete="username"
                autoFocus
              />
            </div>

            {/* Hint about internal company domain */}
            <p className="text-[10px] text-slate-400 font-medium">
              Format Auth: <span className="font-mono text-emerald-600 font-semibold">{previewEmail}</span>
            </p>
          </div>

          {/* Field Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Masukkan password akun Anda"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 transition-all outline-none"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer active:scale-[0.99] mt-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>Masuk ke RiksaSyncs</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info: persistent session */}
        <div className="pt-2 border-t border-slate-100 text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-slate-500 text-[11px] font-semibold">
            <Sparkles className="h-3 w-3 text-emerald-500" />
            <span>Persistent Session Aktif</span>
          </div>
          <p className="text-[10px] text-slate-400">
            Anda cukup login sekali. Sesi akan tetap aktif tanpa perlu login berulang saat membuka aplikasi.
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
        <Shield className="h-3.5 w-3.5 text-emerald-600" />
        <span>Supabase Auth Protected System</span>
      </div>
    </div>
  );
}
