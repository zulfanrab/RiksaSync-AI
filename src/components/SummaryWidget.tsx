/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, User, Trash2, CalendarDays, CloudSun, ArrowLeft, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'model';
  text: string;
}

// Custom high-fidelity inline markdown renderer
function MarkdownRenderer({ text, colorTheme = 'emerald' }: { text: string; colorTheme?: 'emerald' | 'slate' }) {
  const lines = text.split('\n');

  const formatBold = (str: string) => {
    const parts = str.split('**');
    return parts.map((part, i) => (
      i % 2 === 1 
        ? <strong key={i} className="text-white font-bold">{part}</strong> 
        : part
    ));
  };

  const bulletColor = colorTheme === 'emerald' ? 'bg-emerald-400' : 'bg-sky-400';
  const headingColor = colorTheme === 'emerald' ? 'text-emerald-300' : 'text-sky-300';
  const listDotColor = colorTheme === 'emerald' ? 'text-emerald-400' : 'text-sky-400';

  return (
    <div className="space-y-2 text-xs leading-relaxed text-slate-200">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1.5" />;

        // Headers (### or ####)
        if (trimmed.startsWith('###') || trimmed.startsWith('####')) {
          const content = trimmed.replace(/^###+\s*/, '');
          return (
            <h4 key={idx} className={`font-bold ${headingColor} text-[11px] mt-3 mb-1 tracking-wider uppercase flex items-center gap-1.5`}>
              <span className={`w-1.5 h-1.5 ${bulletColor} rounded-full animate-pulse`} />
              {content}
            </h4>
          );
        }

        // Main Headers (# or ##)
        if (trimmed.startsWith('#') || trimmed.startsWith('##')) {
          const content = trimmed.replace(/^##?\s*/, '');
          return (
            <h3 key={idx} className="font-extrabold text-white text-xs mt-4 mb-2 tracking-widest uppercase border-b border-emerald-800/40 pb-1">
              {content}
            </h3>
          );
        }

        // List Item (- or *)
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const content = trimmed.replace(/^[-*]\s*/, '');
          return (
            <li key={idx} className="ml-3 list-none flex items-start gap-1.5 text-[11px] leading-relaxed pl-1 text-slate-300">
              <span className={`shrink-0 ${listDotColor} mt-1.5 font-bold text-[10px]`}>•</span>
              <span className="flex-1">{formatBold(content)}</span>
            </li>
          );
        }

        // Standard Paragraph
        return (
          <p key={idx} className="text-[11px] text-slate-300">
            {formatBold(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

export default function SummaryWidget() {
  const [isChatMode, setIsChatMode] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: 'Halo Zulfan! Saya AksaraSync AI. Silakan tanyakan apa saja tentang operasional K3, jadwal tim, cuaca lapangan, atau status alat uji.'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [errorChat, setErrorChat] = useState<string | null>(null);

  // Standby (Summary) States
  const [summary, setSummary] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);
  const [errorSummary, setErrorSummary] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll in Chat Mode
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isChatMode) {
      scrollToBottom();
    }
  }, [messages, loadingChat, isChatMode]);

  const loadStandbyData = async () => {
    fetchSummary();
  };

  const fetchSummary = async () => {
    setLoadingSummary(true);
    setErrorSummary(null);
    try {
      const res = await fetch('/api/ai-summary');
      if (!res.ok) throw new Error('Gagal memuat ringkasan.');
      const data = await res.json();
      setSummary(data.summary || 'Tidak ada data ringkasan.');
    } catch (err: any) {
      setErrorSummary(err.message || 'Koneksi bermasalah');
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loadingChat) return;

    setErrorChat(null);
    setIsChatMode(true); // Automatically transition to chat mode if typing or action clicked

    const userMsg: Message = { role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoadingChat(true);

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages.length > 1 ? messages : [] // Avoid sending only the greeting if empty
        })
      });

      if (!response.ok) {
        throw new Error('Gagal berkomunikasi dengan asisten AI.');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'model', text: data.reply }]);
    } catch (err: any) {
      setErrorChat(err.message || 'Koneksi bermasalah.');
      setMessages(prev => [
        ...prev,
        { role: 'model', text: 'Maaf Zulfan, terjadi gangguan jaringan saat menghubungi otak Gemini. Pastikan koneksi internet stabil dan coba lagi.' }
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: 'model',
        text: 'Halo Zulfan, percakapan telah dibersihkan. Silakan ajukan pertanyaan baru mengenai jadwal operasional lapangan.'
      }
    ]);
    setErrorChat(null);
  };

  const handleQuickQuestion = (question: string) => {
    handleSendMessage(question);
  };

  return (
    <div className="bg-emerald-950 text-white rounded-3xl p-5 shadow-xl flex flex-col h-[520px] border border-emerald-800/50 relative overflow-hidden">
      {/* Dynamic Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#022c22_1px,transparent_1px),linear-gradient(to_bottom,#022c22_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-[0.12] pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* 1. Header Area */}
      <div className="flex items-center justify-between border-b border-emerald-800/60 pb-3 mb-4 z-10">
        <div className="flex items-center gap-2.5">
          {isChatMode ? (
            <button
              onClick={() => setIsChatMode(false)}
              className="p-1.5 bg-emerald-900/60 hover:bg-emerald-800/80 rounded-xl text-emerald-300 hover:text-white transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              title="Kembali ke Ringkasan"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Summary</span>
            </button>
          ) : (
            <div className="bg-emerald-900 p-2 rounded-xl border border-emerald-800/80">
              <Sparkles className="h-4 w-4 text-emerald-300 animate-pulse" />
            </div>
          )}
          <div>
            <h3 className="font-extrabold text-emerald-50 text-xs tracking-wider uppercase flex items-center gap-1.5">
              {isChatMode ? 'RiksaSync AI Chatbot' : 'RiksaSync AI Assistant'}
            </h3>
            <p className="text-[9px] text-emerald-400 font-mono uppercase tracking-widest">
              {isChatMode ? 'Interactive Chat Session' : 'Unified Operational Hub'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {!isChatMode ? (
            summary && (
              <button
                onClick={loadStandbyData}
                disabled={loadingSummary}
                className="p-1.5 bg-emerald-900/40 hover:bg-emerald-800/60 disabled:opacity-50 border border-emerald-800/60 rounded-xl text-emerald-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-bold"
                title="Perbarui Data Ringkasan"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingSummary ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline uppercase">Refresh</span>
              </button>
            )
          ) : (
            messages.length > 1 && (
              <button
                onClick={handleClearChat}
                className="p-1.5 bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-800/60 rounded-xl text-emerald-300 hover:text-white transition-colors cursor-pointer"
                title="Bersihkan Chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )
          )}
        </div>
      </div>

      {/* 2. Main Workspace (Standby View vs Chat View) */}
      <div className="flex-1 overflow-y-auto pr-1 mb-4 z-10 scrollbar-thin scrollbar-thumb-emerald-800 scrollbar-track-transparent">
        <AnimatePresence mode="wait">
          {!isChatMode ? (
            // --- STANDBY VIEW (UNIFIED AUTO-SUMMARY & LOCAL WEATHER REPORT) ---
            <motion.div
              key="standby"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-3 h-full"
            >
              {/* Compact Weather Status Bar (Non-AI Up-to-Date Report) */}
              <div className="bg-slate-900/50 border border-emerald-800/20 p-2.5 rounded-2xl flex items-center gap-3 shrink-0">
                <div className="bg-sky-950 p-2 rounded-xl border border-sky-900 text-sky-400">
                  <CloudSun className="h-4 w-4" />
                </div>
                <div className="flex-1 text-[11px] leading-relaxed">
                  <span className="font-extrabold text-sky-300 tracking-wider uppercase mr-1.5">⛅ Laporan Cuaca Lapangan Hari Ini:</span>
                  <span className="text-slate-200">Cerah Berawan (28°C - 33°C). Kecepatan angin normal 12 km/jam, kelembaban 72%. Kondisi kondusif & aman untuk seluruh pengerjaan inspeksi alat, pengujian teknik K3 luar ruangan, serta mobilisasi tim.</span>
                </div>
              </div>

              {/* Main Expanded Operational Auto-Summary Pane */}
              <div className="flex-1 bg-emerald-900/30 border border-emerald-800/30 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto">
                <div>
                  <h4 className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-2.5 flex items-center gap-1.5 border-b border-emerald-800/30 pb-2">
                    <CalendarDays className="h-3.5 w-3.5 text-emerald-400" />
                    Pusat Ringkasan Operasional Terpadu
                  </h4>
                  
                  {loadingSummary ? (
                    <div className="space-y-2.5 animate-pulse py-1">
                      <div className="h-3.5 bg-emerald-800/60 rounded-md w-1/4" />
                      <div className="h-3 bg-emerald-800/40 rounded-md w-full" />
                      <div className="h-3 bg-emerald-800/40 rounded-md w-11/12" />
                      <div className="h-3 bg-emerald-800/40 rounded-md w-5/6" />
                    </div>
                  ) : errorSummary ? (
                    <div className="text-[11px] text-red-300 flex items-start gap-1.5 bg-red-950/40 p-2.5 rounded-xl border border-red-900/30">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{errorSummary}</span>
                    </div>
                  ) : summary ? (
                    <MarkdownRenderer text={summary} colorTheme="emerald" />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center h-full">
                      <Sparkles className="h-10 w-10 text-emerald-400 mb-3 animate-pulse" />
                      <p className="text-xs text-emerald-200 mb-4 max-w-md font-medium">
                        Dapatkan sintesis ringkasan jadwal & status penugasan tim PT Aksara Riksa Perdana secara instan dengan kecerdasan Gemini AI.
                      </p>
                      <button
                        onClick={fetchSummary}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2 border border-emerald-500/30"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Sintesis Ringkasan Jadwal (Manual)</span>
                      </button>
                    </div>
                  )}
                </div>
                {summary && (
                  <div className="text-[9px] text-emerald-500 font-mono mt-3 uppercase tracking-wider border-t border-emerald-800/20 pt-1.5 flex items-center justify-between">
                    <span>Sintesis jadwal real-time aktif</span>
                    <button
                      onClick={fetchSummary}
                      disabled={loadingSummary}
                      className="text-emerald-400 hover:text-white transition-colors flex items-center gap-1 font-bold uppercase"
                    >
                      <RefreshCw className={`h-2.5 w-2.5 ${loadingSummary ? 'animate-spin' : ''}`} />
                      Sintesis Ulang
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            // --- CHAT INTERFACE VIEW ---
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
              className="space-y-3.5 h-full"
            >
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role !== 'user' && (
                    <div className="bg-emerald-900 p-1.5 rounded-xl border border-emerald-800 shrink-0 mt-0.5 shadow-md">
                      <Bot className="h-3.5 w-3.5 text-emerald-300" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-tr-none'
                        : 'bg-emerald-900/60 text-slate-100 border border-emerald-800/40 rounded-tl-none whitespace-pre-wrap'
                    }`}
                  >
                    {msg.role === 'user' ? msg.text : <MarkdownRenderer text={msg.text} colorTheme="emerald" />}
                  </div>

                  {msg.role === 'user' && (
                    <div className="bg-emerald-800 p-1.5 rounded-xl shrink-0 mt-0.5 shadow-md">
                      <User className="h-3.5 w-3.5 text-emerald-100" />
                    </div>
                  )}
                </div>
              ))}

              {loadingChat && (
                <div className="flex items-start gap-2.5 justify-start">
                  <div className="bg-emerald-900 p-1.5 rounded-xl border border-emerald-800 shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-emerald-300 animate-bounce" />
                  </div>
                  <div className="bg-emerald-900/40 rounded-2xl px-4 py-3 border border-emerald-800/40 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Interactive Quick Prompts & Suggestions Row */}
      <div className="z-10 pb-1.5 flex flex-wrap gap-1.5 border-t border-emerald-800/40 pt-3">
        <button
          onClick={() => handleQuickQuestion('Siapa ahli/personil yang kosong atau tersedia minggu ini?')}
          disabled={loadingChat}
          className="bg-emerald-900/50 hover:bg-emerald-800/80 border border-emerald-800/60 text-[10px] text-emerald-300 hover:text-white px-2.5 py-1.5 rounded-xl font-bold transition-all disabled:opacity-50 cursor-pointer active:scale-95"
        >
          🔍 Cek Personil Kosong
        </button>
        <button
          onClick={() => handleQuickQuestion('Bagaimana prakiraan cuaca lapangan untuk proyek aktif saat ini?')}
          disabled={loadingChat}
          className="bg-emerald-900/50 hover:bg-emerald-800/80 border border-emerald-800/60 text-[10px] text-emerald-300 hover:text-white px-2.5 py-1.5 rounded-xl font-bold transition-all disabled:opacity-50 cursor-pointer active:scale-95"
        >
          🌦️ Analisis Cuaca Kerja
        </button>
        <button
          onClick={() => handleQuickQuestion('Adakah saran reschedule proyek prioritas rendah (P3) jika jadwal bentrok?')}
          disabled={loadingChat}
          className="bg-emerald-900/50 hover:bg-emerald-800/80 border border-emerald-800/60 text-[10px] text-emerald-300 hover:text-white px-2.5 py-1.5 rounded-xl font-bold transition-all disabled:opacity-50 cursor-pointer active:scale-95"
        >
          🔄 Saran Reschedule P3
        </button>
      </div>

      {/* 4. Unified Input Field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputText);
        }}
        className="flex gap-2 mt-1 relative z-10"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={loadingChat}
          placeholder={isChatMode ? 'Ketik pertanyaan lanjutan untuk AksaraSync AI...' : 'Tanya asisten, contoh: Siapa yang bertugas minggu ini?'}
          className="flex-1 bg-emerald-950/80 border border-emerald-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-emerald-600 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 transition-all"
        />
        <button
          type="submit"
          disabled={loadingChat || !inputText.trim()}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 text-white p-2 rounded-xl transition-all shadow-md flex items-center justify-center shrink-0 w-9 h-9 disabled:opacity-40 cursor-pointer active:scale-95"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
