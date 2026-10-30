import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QuickLink, QuickLinkPinsConfig } from '../types';
import { supabase } from '../lib/supabase';
import {
  Link as LinkIcon,
  ExternalLink,
  Plus,
  Lock,
  Unlock,
  KeyRound,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Copy,
  Check,
  Search,
  Filter,
  RefreshCw,
  FolderOpen,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader,
  X,
  Share2,
  Globe,
  Tag
} from 'lucide-react';

export const LINK_DIVISIONS = [
  'Teknik & Operasional',
  'Marketing & Sales',
  'Keuangan & Finance',
  'IT & Sistem',
  'Admin & HRD',
  'Umum / Shared'
];

export const DEFAULT_PINS_CONFIG: QuickLinkPinsConfig = {
  masterPin: '0000',
  divisionPins: {
    'Teknik & Operasional': '0000',
    'Marketing & Sales': '0000',
    'Keuangan & Finance': '0000',
    'IT & Sistem': '0000',
    'Admin & HRD': '0000',
    'Umum / Shared': '0000'
  }
};

export function getDivisionStyle(division?: string) {
  switch (division) {
    case 'Teknik & Operasional':
      return {
        pill: 'bg-amber-100 text-amber-800 border-amber-200',
        badge: 'bg-amber-500',
        cardBg: 'from-amber-500/10 via-amber-500/5 to-transparent',
        border: 'border-amber-200/80',
        hoverBorder: 'hover:border-amber-400',
        accentText: 'text-amber-700',
        iconBg: 'bg-amber-100 text-amber-800'
      };
    case 'Marketing & Sales':
      return {
        pill: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        badge: 'bg-emerald-500',
        cardBg: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
        border: 'border-emerald-200/80',
        hoverBorder: 'hover:border-emerald-400',
        accentText: 'text-emerald-700',
        iconBg: 'bg-emerald-100 text-emerald-800'
      };
    case 'Keuangan & Finance':
      return {
        pill: 'bg-blue-100 text-blue-800 border-blue-200',
        badge: 'bg-blue-500',
        cardBg: 'from-blue-500/10 via-blue-500/5 to-transparent',
        border: 'border-blue-200/80',
        hoverBorder: 'hover:border-blue-400',
        accentText: 'text-blue-700',
        iconBg: 'bg-blue-100 text-blue-800'
      };
    case 'IT & Sistem':
      return {
        pill: 'bg-purple-100 text-purple-800 border-purple-200',
        badge: 'bg-purple-500',
        cardBg: 'from-purple-500/10 via-purple-500/5 to-transparent',
        border: 'border-purple-200/80',
        hoverBorder: 'hover:border-purple-400',
        accentText: 'text-purple-700',
        iconBg: 'bg-purple-100 text-purple-800'
      };
    case 'Admin & HRD':
      return {
        pill: 'bg-rose-100 text-rose-800 border-rose-200',
        badge: 'bg-rose-500',
        cardBg: 'from-rose-500/10 via-rose-500/5 to-transparent',
        border: 'border-rose-200/80',
        hoverBorder: 'hover:border-rose-400',
        accentText: 'text-rose-700',
        iconBg: 'bg-rose-100 text-rose-800'
      };
    default:
      return {
        pill: 'bg-slate-100 text-slate-700 border-slate-200',
        badge: 'bg-slate-500',
        cardBg: 'from-slate-500/10 via-slate-500/5 to-transparent',
        border: 'border-slate-200/80',
        hoverBorder: 'hover:border-slate-400',
        accentText: 'text-slate-700',
        iconBg: 'bg-slate-100 text-slate-700'
      };
  }
}

const EMOJI_PRESETS = ['🔗', '📁', '📊', '📝', '🛠️', '💰', '📈', '💻', '☁️', '📄', '🔒', '🎯', '📑', '🏢', '⚡', '📦'];

interface DivisionLinksModuleProps {
  quickLinks: QuickLink[];
  activeUser: string | null;
  onRefreshAll: () => Promise<void>;
}

export default function DivisionLinksModule({
  quickLinks,
  activeUser,
  onRefreshAll
}: DivisionLinksModuleProps) {
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Centralized PIN Security Configuration
  const [pinsConfig, setPinsConfig] = useState<QuickLinkPinsConfig>(() => {
    try {
      const saved = localStorage.getItem('quick_links_pins_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          masterPin: parsed.masterPin || '0000',
          divisionPins: { ...DEFAULT_PINS_CONFIG.divisionPins, ...(parsed.divisionPins || {}) }
        };
      }
    } catch (e) {}
    return DEFAULT_PINS_CONFIG;
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('quick_links_pins_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        setPinsConfig({
          masterPin: parsed.masterPin || '0000',
          divisionPins: { ...DEFAULT_PINS_CONFIG.divisionPins, ...(parsed.divisionPins || {}) }
        });
      }
    } catch (e) {}
  }, [quickLinks]);

  // Session-based unlocked links & divisions
  const [unlockedLinkIds, setUnlockedLinkIds] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem('unlocked_quick_links');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [unlockedDivisions, setUnlockedDivisions] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem('unlocked_divisions');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Modal States
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkEmoji, setLinkEmoji] = useState('🔗');
  const [linkDivision, setLinkDivision] = useState('Teknik & Operasional');
  const [customDivision, setCustomDivision] = useState('');
  const [linkIsLocked, setLinkIsLocked] = useState(true);
  const [useCustomPin, setUseCustomPin] = useState(false);
  const [linkPin, setLinkPin] = useState('');
  const [isSavingLink, setIsSavingLink] = useState(false);

  // PIN Settings Modal State
  const [isPinSettingsOpen, setIsPinSettingsOpen] = useState(false);
  const [tempMasterPin, setTempMasterPin] = useState('0000');
  const [tempDivisionPins, setTempDivisionPins] = useState<Record<string, string>>({});
  const [isSavingPins, setIsSavingPins] = useState(false);
  const [pinSettingsSuccess, setPinSettingsSuccess] = useState(false);

  // PIN Unlock Modal State
  const [pinModalLink, setPinModalLink] = useState<QuickLink | null>(null);
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);
  const [showPinMask, setShowPinMask] = useState(false);
  const pinInput0 = useRef<HTMLInputElement>(null);
  const pinInput1 = useRef<HTMLInputElement>(null);
  const pinInput2 = useRef<HTMLInputElement>(null);
  const pinInput3 = useRef<HTMLInputElement>(null);
  const pinInputs = [pinInput0, pinInput1, pinInput2, pinInput3];

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshAll();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filtered links
  const filteredLinks = useMemo(() => {
    return quickLinks.filter(l => {
      // Division match
      const div = l.division || 'Umum / Shared';
      if (selectedDivision !== 'all' && div !== selectedDivision) {
        return false;
      }
      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = l.title.toLowerCase().includes(q);
        const matchUrl = l.url.toLowerCase().includes(q);
        const matchDiv = div.toLowerCase().includes(q);
        return matchTitle || matchUrl || matchDiv;
      }
      return true;
    });
  }, [quickLinks, selectedDivision, searchQuery]);

  // Dynamic divisions list (Predefined + Any custom existing divisions)
  const allAvailableDivisions = useMemo(() => {
    const set = new Set<string>(LINK_DIVISIONS);
    quickLinks.forEach(l => {
      if (l.division && l.division.trim()) {
        set.add(l.division.trim());
      }
    });
    return Array.from(set);
  }, [quickLinks]);

  // Statistics
  const stats = useMemo(() => {
    const total = quickLinks.length;
    const locked = quickLinks.filter(l => l.is_locked !== false).length;
    const unlocked = quickLinks.filter(l => {
      const isLocked = l.is_locked !== false;
      const div = l.division || 'Umum';
      return isLocked && (unlockedLinkIds.has(l.id) || unlockedDivisions.has(div));
    }).length;
    return { total, locked, unlocked };
  }, [quickLinks, unlockedLinkIds, unlockedDivisions]);

  // Handlers for PIN Settings
  const openPinSettingsModal = () => {
    setTempMasterPin(pinsConfig.masterPin || '0000');
    setTempDivisionPins({ ...DEFAULT_PINS_CONFIG.divisionPins, ...pinsConfig.divisionPins });
    setPinSettingsSuccess(false);
    setIsPinSettingsOpen(true);
  };

  const handleSavePinsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPins(true);

    const cleanMaster = tempMasterPin.replace(/\D/g, '').slice(0, 4) || '0000';
    const cleanDivPins: Record<string, string> = {};
    for (const [k, v] of Object.entries(tempDivisionPins)) {
      cleanDivPins[k] = v.replace(/\D/g, '').slice(0, 4) || cleanMaster;
    }

    const newConfig: QuickLinkPinsConfig = {
      masterPin: cleanMaster,
      divisionPins: cleanDivPins
    };

    try {
      const payload = {
        title: '__SYS_PINS_CONFIG__',
        url: 'sys://quick-links/pins-config',
        emoji: '🔐',
        created_by: JSON.stringify(newConfig)
      };

      const { data: existing } = await supabase
        .from('quick_links')
        .select('id')
        .eq('url', 'sys://quick-links/pins-config')
        .maybeSingle();

      if (existing && existing.id) {
        await supabase
          .from('quick_links')
          .update(payload)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('quick_links')
          .insert([payload]);
      }
    } catch (err) {
      console.warn('Error saving pins config to Supabase:', err);
    }

    setPinsConfig(newConfig);
    localStorage.setItem('quick_links_pins_config', JSON.stringify(newConfig));
    setPinSettingsSuccess(true);
    await onRefreshAll();
    setTimeout(() => {
      setIsSavingPins(false);
      setIsPinSettingsOpen(false);
      setPinSettingsSuccess(false);
    }, 600);
  };

  // Handlers for Link Creation / Editing
  const openAddLinkModal = () => {
    setEditingLink(null);
    setLinkTitle('');
    setLinkUrl('');
    setLinkEmoji('🔗');
    setLinkDivision(selectedDivision !== 'all' ? selectedDivision : 'Teknik & Operasional');
    setCustomDivision('');
    setLinkIsLocked(true);
    setUseCustomPin(false);
    setLinkPin('');
    setIsLinkModalOpen(true);
  };

  const openEditLinkModal = (link: QuickLink, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingLink(link);
    setLinkTitle(link.title);
    setLinkUrl(link.url);
    setLinkEmoji(link.emoji || '🔗');
    if (LINK_DIVISIONS.includes(link.division || '')) {
      setLinkDivision(link.division || 'Umum / Shared');
      setCustomDivision('');
    } else {
      setLinkDivision('Kustom');
      setCustomDivision(link.division || '');
    }
    setLinkIsLocked(link.is_locked !== false);
    if (link.pin && link.pin.trim() !== '') {
      setUseCustomPin(true);
      setLinkPin(link.pin);
    } else {
      setUseCustomPin(false);
      setLinkPin('');
    }
    setIsLinkModalOpen(true);
  };

  const handleSaveQuickLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle || !linkUrl) return;
    setIsSavingLink(true);

    const resolvedDiv = linkDivision === 'Kustom' ? (customDivision.trim() || 'Umum') : linkDivision;
    const divPin = pinsConfig.divisionPins[resolvedDiv] || pinsConfig.masterPin || '0000';
    const resolvedPin = linkIsLocked ? (useCustomPin && linkPin ? linkPin.replace(/\D/g, '').slice(0, 4) : divPin) : '';

    const authorMetadata = JSON.stringify({
      u: activeUser || 'System',
      d: resolvedDiv,
      l: linkIsLocked,
      p: resolvedPin
    });

    const linkPayload: QuickLink = {
      id: editingLink ? editingLink.id : ('ql-' + Date.now()),
      title: linkTitle.trim(),
      url: linkUrl.startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`,
      emoji: linkEmoji || '🔗',
      division: resolvedDiv,
      is_locked: linkIsLocked,
      pin: resolvedPin,
      created_by: authorMetadata,
      created_at: editingLink ? editingLink.created_at : new Date().toISOString()
    };

    try {
      if (editingLink && !editingLink.id.startsWith('ql-')) {
        const { error } = await supabase.from('quick_links').update({
          title: linkPayload.title,
          url: linkPayload.url,
          emoji: linkPayload.emoji,
          division: linkPayload.division,
          is_locked: linkPayload.is_locked,
          pin: linkPayload.pin,
          created_by: authorMetadata
        }).eq('id', editingLink.id);

        if (error) {
          await supabase.from('quick_links').update({
            title: linkPayload.title,
            url: linkPayload.url,
            emoji: linkPayload.emoji,
            created_by: authorMetadata
          }).eq('id', editingLink.id);
        }
      } else {
        const { data, error } = await supabase.from('quick_links').insert([{
          title: linkPayload.title,
          url: linkPayload.url,
          emoji: linkPayload.emoji,
          division: linkPayload.division,
          is_locked: linkPayload.is_locked,
          pin: linkPayload.pin,
          created_by: authorMetadata
        }]).select();

        if (error) {
          const { data: fbData } = await supabase.from('quick_links').insert([{
            title: linkPayload.title,
            url: linkPayload.url,
            emoji: linkPayload.emoji,
            created_by: authorMetadata
          }]).select();
          if (fbData && fbData[0]) {
            linkPayload.id = fbData[0].id;
          }
        } else if (data && data[0]) {
          linkPayload.id = data[0].id;
        }
      }
    } catch (err: any) {
      console.warn('Fallback save quick link locally:', err);
    }

    const local = JSON.parse(localStorage.getItem('local_quick_links') || '[]');
    const filtered = local.filter((l: any) => l.id !== linkPayload.id && l.url !== linkPayload.url);
    localStorage.setItem('local_quick_links', JSON.stringify([linkPayload, ...filtered]));

    await onRefreshAll();
    setIsSavingLink(false);
    setIsLinkModalOpen(false);
    setEditingLink(null);
  };

  const handleDeleteQuickLink = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Apakah Anda yakin ingin menghapus tautan ini secara permanen?')) return;
    try {
      if (!id.startsWith('ql-')) {
        await supabase.from('quick_links').delete().eq('id', id);
      }
      const local = JSON.parse(localStorage.getItem('local_quick_links') || '[]');
      localStorage.setItem('local_quick_links', JSON.stringify(local.filter((l: any) => l.id !== id)));

      const updated = new Set(unlockedLinkIds);
      updated.delete(id);
      setUnlockedLinkIds(updated);
      sessionStorage.setItem('unlocked_quick_links', JSON.stringify(Array.from(updated)));

      await onRefreshAll();
    } catch (err) {
      console.warn('Delete quick link error:', err);
    }
  };

  const handleOpenLink = (link: QuickLink, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    const isLocked = link.is_locked !== false;
    const div = link.division || 'Umum';
    const isUnlocked = unlockedLinkIds.has(link.id) || unlockedDivisions.has(div);

    if (isLocked && !isUnlocked) {
      setPinModalLink(link);
      setPinDigits(['', '', '', '']);
      setPinError('');
      setPinSuccess(false);
      setShowPinMask(false);
      setTimeout(() => pinInputs[0]?.current?.focus(), 150);
    } else {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleVerifyPin = (link: QuickLink, enteredDigits: string[]) => {
    const entered = enteredDigits.join('');
    const div = link.division || 'Umum';
    const divPin = (pinsConfig.divisionPins && pinsConfig.divisionPins[div]) ? pinsConfig.divisionPins[div] : (pinsConfig.masterPin || '0000');
    const master = pinsConfig.masterPin || '0000';
    const customPin = (link.pin && link.pin.trim() !== '') ? link.pin.trim() : null;

    const isMatch = (customPin && entered === customPin) || entered === divPin || entered === master;

    if (isMatch) {
      setPinSuccess(true);
      setPinError('');

      const updatedLinks = new Set(unlockedLinkIds);
      updatedLinks.add(link.id);
      setUnlockedLinkIds(updatedLinks);

      const updatedDivs = new Set(unlockedDivisions);
      updatedDivs.add(div);
      setUnlockedDivisions(updatedDivs);

      try {
        sessionStorage.setItem('unlocked_quick_links', JSON.stringify(Array.from(updatedLinks)));
        sessionStorage.setItem('unlocked_divisions', JSON.stringify(Array.from(updatedDivs)));
      } catch {}

      setTimeout(() => {
        window.open(link.url, '_blank', 'noopener,noreferrer');
        setPinModalLink(null);
        setPinSuccess(false);
      }, 350);
    } else {
      setPinError('PIN salah! Silakan coba lagi.');
      setPinDigits(['', '', '', '']);
      setTimeout(() => pinInputs[0]?.current?.focus(), 100);
    }
  };

  const handleDigitChange = (index: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...pinDigits];
    newDigits[index] = char;
    setPinDigits(newDigits);
    setPinError('');

    if (char && index < 3) {
      pinInputs[index + 1]?.current?.focus();
    }

    if (char && index === 3 && pinModalLink) {
      handleVerifyPin(pinModalLink, newDigits);
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinInputs[index - 1]?.current?.focus();
    } else if (e.key === 'Enter' && pinModalLink) {
      handleVerifyPin(pinModalLink, pinDigits);
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;
    const newDigits = ['', '', '', ''];
    for (let i = 0; i < 4; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setPinDigits(newDigits);
    setPinError('');

    const lastIdx = Math.min(pasted.length - 1, 3);
    pinInputs[lastIdx]?.current?.focus();

    if (pasted.length === 4 && pinModalLink) {
      handleVerifyPin(pinModalLink, newDigits);
    }
  };

  const handleRelockDivision = (division: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = new Set(unlockedDivisions);
    updated.delete(division);
    setUnlockedDivisions(updated);
    try {
      sessionStorage.setItem('unlocked_divisions', JSON.stringify(Array.from(updated)));
    } catch {}
  };

  const handleCopyLink = (url: string, id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Header Card (Bersih, Jelas, & Nyaman Digunakan) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-2xl shrink-0 shadow-2xs">
            🔗
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight">
                Link &amp; Akses Cepat Divisi
              </h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {stats.total} Link Tersimpan
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
              Kumpulan link penting per divisi (Google Drive, formulir, spreadsheet, dan dokumen kerja) agar tim dapat langsung membukanya dalam satu klik.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
          <button
            onClick={openPinSettingsModal}
            className="flex-1 sm:flex-none px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            title="Atur PIN Master &amp; PIN per Divisi"
          >
            <KeyRound className="h-4 w-4 text-amber-600" />
            <span>Atur PIN Divisi</span>
          </button>

          <button
            onClick={openAddLinkModal}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Link Baru</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Bar: Division Tabs + Search Box */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Division Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-1">
            <button
              onClick={() => setSelectedDivision('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                selectedDivision === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <span>🌐 Semua Divisi</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedDivision === 'all' ? 'bg-indigo-700/60 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {quickLinks.length}
              </span>
            </button>

            {allAvailableDivisions.map(divName => {
              const count = quickLinks.filter(l => (l.division || 'Umum / Shared') === divName).length;
              const isSelected = selectedDivision === divName;
              const style = getDivisionStyle(divName);
              return (
                <button
                  key={divName}
                  onClick={() => setSelectedDivision(divName)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : `bg-slate-50 ${style.pill} hover:bg-slate-100 border`
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${style.badge}`} />
                  <span>{divName}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-indigo-700/60 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Search Input */}
          <div className="relative shrink-0 sm:w-64">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nama tautan atau link..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Link Cards Grid */}
      {filteredLinks.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
            🔗
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {searchQuery ? 'Tautan Tidak Ditemukan' : 'Belum Ada Tautan di Divisi Ini'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {searchQuery
              ? `Tidak ada tautan yang cocok dengan kata kunci "${searchQuery}". Silakan coba kata kunci lain.`
              : 'Mulai simpan tautan penting, Google Drive, atau formulir kerja dengan menekan tombol Tambah Tautan Baru.'}
          </p>
          <button
            onClick={openAddLinkModal}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Tautan Pertama</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLinks.map(link => {
            const isLocked = link.is_locked !== false;
            const div = link.division || 'Umum';
            const isUnlocked = unlockedLinkIds.has(link.id) || unlockedDivisions.has(div);
            const style = getDivisionStyle(link.division);

            // Extract display hostname
            let hostname = link.url;
            try {
              const u = new URL(link.url);
              hostname = u.hostname + (u.pathname !== '/' && u.pathname.length > 1 ? u.pathname : '');
            } catch (e) {}

            return (
              <div
                key={link.id}
                className={`bg-white border ${style.border} ${style.hoverBorder} rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3.5 group relative overflow-hidden`}
              >
                {/* Subtle top division gradient stripe */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${style.cardBg}`} />

                <div className="space-y-3">
                  {/* Card Header: Icon, Division, Title & Badges */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div
                      onClick={(e) => handleOpenLink(link, e)}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      title={`Buka ${link.title}`}
                    >
                      <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-2xl shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                        {link.emoji || '🔗'}
                      </div>
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border inline-block ${style.pill}`}>
                          {link.division || 'Umum'}
                        </span>
                        <h4 className="text-sm font-extrabold text-slate-800 leading-snug truncate group-hover:text-indigo-600 transition-colors" title={link.title}>
                          {link.title}
                        </h4>
                      </div>
                    </div>

                    {/* Security Status Badge */}
                    <div className="shrink-0 pt-0.5">
                      {isLocked ? (
                        isUnlocked ? (
                          <span
                            className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg shadow-2xs"
                            title="PIN Terbuka untuk sesi browser ini"
                          >
                            <Unlock className="h-3 w-3 text-emerald-600" />
                            <span>Terbuka</span>
                          </span>
                        ) : (
                          <span
                            className="flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg shadow-2xs"
                            title="Tautan terkunci dengan PIN 4-digit"
                          >
                            <Lock className="h-3 w-3 text-amber-600" />
                            <span>Perlu PIN</span>
                          </span>
                        )
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                          <Globe className="h-3 w-3 text-slate-400" />
                          <span>Publik</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* URL Preview (Clickable directly to open) */}
                  <div
                    onClick={(e) => handleOpenLink(link, e)}
                    className="bg-slate-50/90 hover:bg-slate-100/90 border border-slate-200/70 rounded-xl px-3 py-2 text-[11px] text-slate-500 hover:text-indigo-600 font-mono truncate flex items-center gap-1.5 cursor-pointer transition-colors"
                    title={`Klik untuk buka: ${link.url}`}
                  >
                    <ExternalLink className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="truncate">{hostname}</span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleCopyLink(link.url, link.id, e)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title={copiedId === link.id ? 'URL Tersalin!' : 'Salin alamat URL'}
                    >
                      {copiedId === link.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>

                    <button
                      onClick={(e) => openEditLinkModal(link, e)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit link ini"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={(e) => handleDeleteQuickLink(link.id, e)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus link ini"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    {/* Re-lock button if currently unlocked */}
                    {isLocked && isUnlocked && (
                      <button
                        onClick={(e) => handleRelockDivision(div, e)}
                        className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                        title="Kunci kembali seluruh link di divisi ini"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Primary Open Button */}
                  <button
                    onClick={(e) => handleOpenLink(link, e)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    title={`Buka ${link.title}`}
                  >
                    <span>Buka Link</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. PIN Unlock Modal (Masukkan PIN 4-Digit) */}
      <AnimatePresence>
        {pinModalLink && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm" onClick={() => setPinModalLink(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 pt-6 pb-4 flex flex-col items-center text-center bg-gradient-to-b from-amber-50 to-white border-b border-slate-100">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-sm transition-all ${
                  pinSuccess ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                }`}>
                  {pinSuccess ? <Unlock className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
                </div>
                <h3 className="text-base font-black text-slate-800 leading-tight">
                  Tautan Terkunci
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
                  Masukkan PIN 4-digit untuk membuka tautan khusus divisi ini.
                </p>

                {/* Target Link Info Pill */}
                <div className="mt-3 flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl max-w-full">
                  <span className="text-base">{pinModalLink.emoji || '🔗'}</span>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate max-w-[180px]">{pinModalLink.title}</p>
                    <p className="text-[10px] text-amber-700 font-semibold">{pinModalLink.division || 'Umum'}</p>
                  </div>
                </div>
              </div>

              {/* PIN Input Digits */}
              <div className="p-6 flex flex-col items-center">
                <div className="flex items-center gap-3 justify-center mb-2" onPaste={handleDigitPaste}>
                  {[0, 1, 2, 3].map(i => (
                    <input
                      key={i}
                      ref={pinInputs[i]}
                      type={showPinMask ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={pinDigits[i]}
                      onChange={e => handleDigitChange(i, e.target.value)}
                      onKeyDown={e => handleDigitKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-2xl font-bold font-mono rounded-xl border transition-all focus:outline-none shadow-xs ${
                        pinError
                          ? 'border-rose-400 bg-rose-50/50 text-rose-700 animate-shake'
                          : pinSuccess
                          ? 'border-emerald-400 bg-emerald-50/50 text-emerald-700'
                          : pinDigits[i]
                          ? 'border-indigo-400 bg-indigo-50/30 text-indigo-700'
                          : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-indigo-500 focus:bg-white'
                      }`}
                    />
                  ))}
                </div>

                {/* Show/Hide PIN toggle & Error Message */}
                <div className="h-6 flex items-center justify-center mt-1">
                  {pinError ? (
                    <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {pinError}
                    </span>
                  ) : pinSuccess ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      PIN Benar! Membuka tautan...
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowPinMask(!showPinMask)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {showPinMask ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      <span>{showPinMask ? 'Sembunyikan angka' : 'Tampilkan angka'}</span>
                    </button>
                  )}
                </div>

                <div className="mt-3 text-center">
                  <span className="text-[11px] text-slate-400 bg-slate-100/80 px-2.5 py-1 rounded-full font-medium">
                    💡 PIN default: <strong className="text-slate-700 font-mono">0000</strong>
                  </span>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPinModalLink(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-200/60 rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleVerifyPin(pinModalLink, pinDigits)}
                  disabled={pinDigits.some(d => !d) || pinSuccess}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Buka Tautan</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Centralized PIN Settings Modal */}
      <AnimatePresence>
        {isPinSettingsOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsPinSettingsOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-amber-50/80 via-white to-slate-50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shadow-2xs">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">
                      Pengaturan PIN Keamanan Divisi
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Tersinkronisasi otomatis ke seluruh perangkat tim melalui database.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPinSettingsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 bg-white hover:bg-slate-100 rounded-full transition-all shadow-xs"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5">
                <form id="pin-settings-form" onSubmit={handleSavePinsConfig} className="space-y-5">
                  {/* Master PIN */}
                  <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-indigo-600" />
                          Master PIN Global (4-Digit)
                        </label>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          PIN master yang berlaku untuk semua divisi dan tautan terkunci secara umum.
                        </p>
                      </div>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={tempMasterPin}
                      onChange={e => setTempMasterPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-full bg-white border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5 text-center text-xl font-mono font-bold tracking-[0.5em] text-indigo-900 shadow-2xs"
                      placeholder="0000"
                      required
                    />
                  </div>

                  {/* Division PINs Grid */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-amber-600" />
                        PIN Khusus per Divisi
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const resetMap: Record<string, string> = {};
                          LINK_DIVISIONS.forEach(d => { resetMap[d] = tempMasterPin || '0000'; });
                          setTempDivisionPins(resetMap);
                        }}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                      >
                        Samakan Semua dengan Master PIN
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {LINK_DIVISIONS.map(divName => {
                        const style = getDivisionStyle(divName);
                        return (
                          <div key={divName} className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border inline-block mb-1 ${style.pill}`}>
                                {divName}
                              </span>
                              <p className="text-[10px] text-slate-400">PIN 4-digit divisi</p>
                            </div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={4}
                              value={tempDivisionPins[divName] ?? tempMasterPin}
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setTempDivisionPins(prev => ({ ...prev, [divName]: val }));
                              }}
                              className="w-24 bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-400 rounded-lg px-2 py-1.5 text-center text-sm font-mono font-bold tracking-widest text-slate-800 focus:outline-none"
                              placeholder={tempMasterPin}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {pinSettingsSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>PIN berhasil disimpan dan disinkronkan ke seluruh tim!</span>
                    </div>
                  )}
                </form>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPinSettingsOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-200/60 rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="pin-settings-form"
                  disabled={isSavingPins}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isSavingPins ? <Loader className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  <span>{isSavingPins ? 'Menyimpan & Sinkron...' : 'Simpan & Sinkronkan'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Add/Edit Link Dialog Modal */}
      <AnimatePresence>
        {isLinkModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsLinkModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50/70 to-slate-50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                    <LinkIcon className="h-4 w-4" />
                  </div>
                  {editingLink ? 'Edit Tautan Divisi' : 'Tambah Tautan Divisi Baru'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 bg-white hover:bg-slate-100 rounded-full transition-all shadow-xs"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                <form id="link-form" onSubmit={handleSaveQuickLink} className="space-y-4">
                  {/* Title & Emoji Picker */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Nama Tautan & Ikon Emoji <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative shrink-0">
                        <input
                          type="text"
                          value={linkEmoji}
                          onChange={e => setLinkEmoji(e.target.value)}
                          maxLength={3}
                          className="w-12 h-11 text-center text-xl bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-2xs font-bold"
                          title="Pilih atau ketik emoji"
                        />
                      </div>
                      <input
                        type="text"
                        value={linkTitle}
                        onChange={e => setLinkTitle(e.target.value)}
                        placeholder="Contoh: Google Drive Laporan Riksa 2026"
                        required
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs font-semibold"
                      />
                    </div>

                    {/* Emoji Preset Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-400 font-medium">Preset:</span>
                      {EMOJI_PRESETS.map(em => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setLinkEmoji(em)}
                          className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all cursor-pointer ${
                            linkEmoji === em ? 'bg-indigo-100 ring-2 ring-indigo-400 scale-110' : 'bg-slate-100 hover:bg-slate-200'
                          }`}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* URL */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Alamat URL / Web Link <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                      placeholder="https://drive.google.com/... atau https://app.example.com"
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs font-mono"
                    />
                  </div>

                  {/* Division Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Kategori Divisi <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={linkDivision}
                      onChange={e => setLinkDivision(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                    >
                      {LINK_DIVISIONS.map(divName => (
                        <option key={divName} value={divName}>{divName}</option>
                      ))}
                      <option value="Kustom">+ Tulis Divisi Lainnya...</option>
                    </select>

                    {linkDivision === 'Kustom' && (
                      <input
                        type="text"
                        value={customDivision}
                        onChange={e => setCustomDivision(e.target.value)}
                        className="w-full mt-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs"
                        placeholder="Ketik nama divisi baru..."
                        required
                      />
                    )}
                  </div>

                  {/* PIN Lock Protection Card */}
                  <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                          <Lock className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Kunci dengan PIN Divisi</p>
                          <p className="text-[10px] text-slate-500">
                            Menggunakan PIN Divisi <strong className="text-amber-800">{linkDivision === 'Kustom' ? (customDivision || 'Umum') : linkDivision}</strong>
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={linkIsLocked}
                          onChange={e => setLinkIsLocked(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                      </label>
                    </div>

                    {linkIsLocked && (
                      <div className="pt-2 border-t border-amber-200/60 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-600">
                            PIN Aktif Divisi Ini: <strong className="font-mono text-amber-800">{pinsConfig.divisionPins[linkDivision === 'Kustom' ? (customDivision || 'Umum') : linkDivision] || pinsConfig.masterPin || '0000'}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => setUseCustomPin(!useCustomPin)}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                          >
                            {useCustomPin ? 'Gunakan PIN Divisi Saja' : 'Custom PIN Khusus Link Ini?'}
                          </button>
                        </div>

                        {useCustomPin && (
                          <div>
                            <label className="text-[11px] font-bold text-amber-900 block mb-1">
                              Custom PIN 4-Digit Khusus:
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={4}
                              value={linkPin}
                              onChange={e => setLinkPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              className="w-full bg-white border border-amber-300 rounded-xl px-4 py-2 text-center text-base font-mono font-bold tracking-[0.5em] text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                              placeholder="0000"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </form>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-200/60 rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="link-form"
                  disabled={isSavingLink}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingLink ? <Loader className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  <span>{editingLink ? 'Simpan Perubahan' : 'Simpan Tautan'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
