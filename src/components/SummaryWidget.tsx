/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, MessageSquare, Bot, User, Trash2, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function SummaryWidget() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: 'Halo Zulfan, butuh ringkasan jadwal untuk hari ini, minggu ini, atau bulan ini? Mau versi lengkap atau ringkasannya saja?'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of messages
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    setError(null);
    const userMsg: Message = { role: 'user', text: textToSend };
    
    // Add user message to log
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages // Pass existing logs for session continuity
        })
      });

      if (!response.ok) {
        throw new Error('Gagal berkomunikasi dengan asisten AI.');
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, { role: 'model', text: data.reply }]);
    } catch (err: any) {
      setError(err.message || 'Koneksi bermasalah. Pastikan server aktif.');
      setMessages(prev => [...prev, { role: 'model', text: 'Maaf Zulfan, terjadi gangguan jaringan saat menghubungi pusat otak Gemini. Coba lagi dalam beberapa saat.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSummary = (type: 'Harian' | 'Mingguan' | 'Bulanan') => {
    const prompt = `Berikan ringkasan ${type.toLowerCase()} lengkap untuk status operasional, jadwal, dan pembagian personil K3 saat ini.`;
    handleSendMessage(prompt);
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: 'model',
        text: 'Halo Zulfan, percakapan telah dibersihkan. Butuh ringkasan jadwal untuk hari ini, minggu ini, atau bulan ini? Silakan klik tombol di bawah atau ketik pertanyaan langsung.'
      }
    ]);
    setError(null);
  };

  return (
    <div className="bg-emerald-900 text-white rounded-2xl p-4 shadow-lg flex flex-col h-[400px] border border-emerald-800 relative overflow-hidden">
      {/* Background Decorative Grid Accent */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#022c22_1px,transparent_1px),linear-gradient(to_bottom,#022c22_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] opacity-20 pointer-events-none" />

      {/* Widget Header */}
      <div className="flex items-center justify-between border-b border-emerald-800/80 pb-3 mb-3 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-950 p-2 rounded-xl border border-emerald-800">
            <Sparkles className="h-4 w-4 text-emerald-300 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-100 text-xs tracking-wider uppercase flex items-center gap-1.5">
              AksaraSync AI Chatbot
            </h3>
            <p className="text-[9px] text-emerald-400 font-mono uppercase tracking-wider">
              Interactive Operational Assistant
            </p>
          </div>
        </div>
        
        {messages.length > 1 && (
          <button
            onClick={handleClearChat}
            title="Bersihkan Percakapan"
            className="p-1.5 hover:bg-emerald-800/80 rounded-lg text-emerald-300 hover:text-white transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 mb-3 scrollbar-thin scrollbar-thumb-emerald-800 scrollbar-track-transparent z-10">
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role !== 'user' && (
                <div className="bg-emerald-950 p-1.5 rounded-lg border border-emerald-800 shrink-0 mt-0.5 shadow-md">
                  <Bot className="h-3.5 w-3.5 text-emerald-300" />
                </div>
              )}
              
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-xs leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-none'
                    : 'bg-emerald-950/80 text-emerald-100 border border-emerald-800/50 rounded-tl-none whitespace-pre-wrap'
                }`}
              >
                {msg.text}
              </div>

              {msg.role === 'user' && (
                <div className="bg-emerald-800 p-1.5 rounded-lg shrink-0 mt-0.5 shadow-md">
                  <User className="h-3.5 w-3.5 text-emerald-100" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <div className="flex items-start gap-2.5 justify-start">
            <div className="bg-emerald-950 p-1.5 rounded-lg border border-emerald-800 shrink-0 mt-0.5">
              <Bot className="h-3.5 w-3.5 text-emerald-300 animate-bounce" />
            </div>
            <div className="bg-emerald-950/50 rounded-2xl px-4 py-3 border border-emerald-800/50 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Quick Action Summary Buttons */}
      <div className="z-10 pb-2 flex flex-wrap gap-1.5 border-t border-emerald-800/50 pt-3">
        <button
          onClick={() => handleQuickSummary('Harian')}
          disabled={loading}
          className="bg-emerald-950/80 hover:bg-emerald-800 border border-emerald-800 text-[10px] text-emerald-300 hover:text-white px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
        >
          <CalendarDays className="h-3 w-3" />
          <span>Summary Harian</span>
        </button>
        <button
          onClick={() => handleQuickSummary('Mingguan')}
          disabled={loading}
          className="bg-emerald-950/80 hover:bg-emerald-800 border border-emerald-800 text-[10px] text-emerald-300 hover:text-white px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
        >
          <CalendarDays className="h-3 w-3" />
          <span>Summary Mingguan</span>
        </button>
        <button
          onClick={() => handleQuickSummary('Bulanan')}
          disabled={loading}
          className="bg-emerald-950/80 hover:bg-emerald-800 border border-emerald-800 text-[10px] text-emerald-300 hover:text-white px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
        >
          <CalendarDays className="h-3 w-3" />
          <span>Summary Bulanan</span>
        </button>
      </div>

      {/* Chat Manual Input Form */}
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
          disabled={loading}
          placeholder="Tanya asisten, contoh: Siapa yang bertugas minggu ini?"
          className="flex-1 bg-emerald-950 border border-emerald-800 rounded-xl px-3 py-2 text-xs text-white placeholder-emerald-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20"
        />
        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white p-2 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0 w-9 h-9 disabled:opacity-50 cursor-pointer active:scale-95"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
