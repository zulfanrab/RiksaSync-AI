/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CloudSun, RefreshCw, Sparkles, ShieldAlert, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

// Custom lightweight line-by-line markdown renderer for elegant, fast presentation
function MarkdownMini({ text }: { text: string }) {
  const lines = text.split('\n');

  const formatBold = (str: string) => {
    // Replaces **text** with styled strong tag
    const parts = str.split('**');
    return parts.map((part, i) => (i % 2 === 1 ? <strong key={i} className="text-white font-semibold">{part}</strong> : part));
  };

  return (
    <div className="space-y-2 text-xs text-slate-300">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;

        // Heading 3 or 4
        if (trimmed.startsWith('###') || trimmed.startsWith('####')) {
          const content = trimmed.replace(/^###+\s*/, '');
          return (
            <h4 key={idx} className="font-bold text-sky-300 text-xs mt-3 mb-1 tracking-wide uppercase flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-sky-400 rounded-full" />
              {content}
            </h4>
          );
        }

        // Heading 1 or 2
        if (trimmed.startsWith('#') || trimmed.startsWith('##')) {
          const content = trimmed.replace(/^##?\s*/, '');
          return (
            <h3 key={idx} className="font-bold text-sky-200 text-sm mt-4 mb-2 tracking-wider uppercase border-b border-slate-800 pb-1">
              {content}
            </h3>
          );
        }

        // List Item
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const content = trimmed.replace(/^[-*]\s*/, '');
          return (
            <li key={idx} className="ml-4 list-disc text-[11px] leading-relaxed text-slate-300 pl-1">
              {formatBold(content)}
            </li>
          );
        }

        // Standard Paragraph
        return (
          <p key={idx} className="leading-relaxed text-[11px]">
            {formatBold(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

export default function OperationalInsight() {
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load persisted insight on mount if exists
    const cached = localStorage.getItem('aksara_operational_insight');
    if (cached) {
      setInsight(cached);
    }
  }, []);

  const fetchInsight = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-operational-insight');
      if (!res.ok) throw new Error('Gagal memuat insight operasional.');
      const data = await res.json();
      const output = data.insight || 'Tidak ada analisis yang tersedia.';
      
      setInsight(output);
      localStorage.setItem('aksara_operational_insight', output);
    } catch (err: any) {
      setError(err.message || 'Koneksi bermasalah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-lg flex flex-col h-[400px] relative overflow-hidden">
      {/* Background Subtle Accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Widget Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
            <CloudSun className="h-4 w-4 text-sky-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-xs tracking-wider uppercase">
              Operational Insight
            </h3>
            <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">
              Weather & National Holiday Advisor
            </p>
          </div>
        </div>
        
        <button
          onClick={fetchInsight}
          disabled={loading}
          className="text-[10px] text-slate-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Menganalisis...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pr-1 mb-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent z-10">
        {loading ? (
          <div className="space-y-3 py-2 animate-pulse">
            <div className="h-4 bg-slate-800 rounded w-1/3" />
            <div className="space-y-2">
              <div className="h-3 bg-slate-800 rounded w-full" />
              <div className="h-3 bg-slate-800 rounded w-11/12" />
              <div className="h-3 bg-slate-800 rounded w-5/6" />
            </div>
            <div className="h-4 bg-slate-800 rounded w-1/4 pt-2" />
            <div className="space-y-2">
              <div className="h-3 bg-slate-800 rounded w-full" />
              <div className="h-3 bg-slate-800 rounded w-10/12" />
            </div>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-rose-300 text-xs bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : insight ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <MarkdownMini text={insight} />
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 space-y-3">
            <div className="bg-slate-950 p-3 rounded-full border border-slate-800 text-slate-400">
              <Sparkles className="h-5 w-5 text-sky-400 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Insight Belum Di-generate</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                Tekan tombol di atas untuk menganalisis risiko cuaca dan kalender libur nasional berdasarkan jadwal aktif saat ini.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tactic Disclaimer */}
      <div className="text-[9px] text-slate-500 border-t border-slate-800/80 pt-2 flex items-center gap-1 z-10 shrink-0">
        <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
        <span>Rekomendasi bersifat taktis operasional. Selalu verifikasi langsung di lapangan.</span>
      </div>
    </div>
  );
}
