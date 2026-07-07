/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function SummaryWidget({ refreshTrigger }: { refreshTrigger: number }) {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-summary');
      if (!res.ok) throw new Error('Gagal memuat ringkasan AI.');
      const data = await res.json();
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message || 'Koneksi bermasalah');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [refreshTrigger]);

  return (
    <div className="bg-emerald-900 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[160px]">
      {/* Absolute decorative icon in background */}
      <div className="absolute top-0 right-0 p-4 opacity-20 text-emerald-300">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
          <path d="M3 10h18" />
          <path d="M7 15h1" />
          <path d="M11 15h1" />
          <path d="M7 19h1" />
          <path d="M11 19h1" />
          <path d="M17 22v-5" />
          <path d="M20 19l-3-3-3 3" />
        </svg>
      </div>
      
      <div className="flex items-center justify-between mb-3 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-800/50 p-2 rounded-lg border border-emerald-700/50">
            <Sparkles className="h-4 w-4 text-emerald-300 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-emerald-100 text-xs tracking-wider uppercase">Gemini AI Summary</h3>
            <p className="text-[9px] text-emerald-400 font-mono tracking-tight font-medium uppercase">Insight Accuracy 98%</p>
          </div>
        </div>
        <button
          onClick={fetchSummary}
          disabled={loading}
          className="text-[10px] text-emerald-100 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/10 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Menganalisis...' : 'Refresh'}
        </button>
      </div>

      <div className="min-h-[70px] flex flex-col justify-center z-10">
        {loading ? (
          <div className="space-y-2 py-2">
            <div className="h-3 bg-white/10 rounded w-full animate-pulse" />
            <div className="h-3 bg-white/10 rounded w-5/6 animate-pulse" />
            <div className="h-3 bg-white/10 rounded w-4/5 animate-pulse" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-rose-300 text-xs bg-rose-500/20 p-3 rounded-lg border border-rose-500/20">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <motion.p 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-emerald-50 leading-relaxed font-sans font-medium"
          >
            "{summary}"
          </motion.p>
        )}
      </div>
    </div>
  );
}
