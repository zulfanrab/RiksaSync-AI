import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleResetCache = () => {
    try {
      localStorage.removeItem('local_attendance_logs');
      localStorage.removeItem('local_manpower_absences');
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] w-full p-6 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-3xl border border-slate-200 shadow-xs my-4 animate-in fade-in">
          <div className="h-14 w-14 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 mb-4 shadow-xs">
            <AlertTriangle className="h-7 w-7" />
          </div>

          <h3 className="text-base font-black text-slate-800 tracking-tight">
            {this.props.fallbackTitle || 'Terjadi Kendala Memuat Komponen Ini'}
          </h3>

          <p className="text-xs text-slate-500 max-w-md mt-1 mb-4 leading-relaxed">
            Sistem mendeteksi format data tidak terduga atau kesalahan runtime. Tampilan utama tetap aman dan Anda dapat memuat ulang komponen di bawah ini.
          </p>

          {this.state.error && (
            <div className="w-full max-w-lg p-3 bg-rose-50 border border-rose-200 rounded-xl text-left font-mono text-[11px] text-rose-800 overflow-x-auto mb-5 max-h-32">
              <p className="font-bold">Error: {this.state.error.message}</p>
              {this.state.error.stack && (
                <p className="text-[10px] text-rose-600/80 mt-1 whitespace-pre-wrap truncate">
                  {this.state.error.stack.split('\n').slice(0, 3).join('\n')}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={this.handleReload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Muat Ulang Halaman</span>
            </button>

            <button
              type="button"
              onClick={this.handleResetCache}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 transition-all shadow-xs cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              <span>Bersihkan Cache Lokal</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
