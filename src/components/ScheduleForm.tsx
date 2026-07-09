/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, Calendar, User, Save, X, AlertTriangle, Info, HelpCircle, Plus, Trash2, Check, Phone, MapPin, Copy } from 'lucide-react';
import { Schedule, Manpower, Unit, ManpowerAbsence } from '../types';

interface ScheduleFormProps {
  initialSchedule?: Schedule | null;
  manpowerList: Manpower[];
  units: Unit[];
  schedules: Schedule[]; // for checking overlap conflicts
  clients: { id: string; client_name: string; pic_name: string; pic_phone: string }[];
  absences?: ManpowerAbsence[];
  onSave: (scheduleData: Omit<Schedule, 'id'> & { id?: string }) => void;
  onCancel: () => void;
}

const HEAVY_EQUIPMENT_DICT = [
  // --- KATEGORI PAA (PESAWAT ANGKAT DAN ANGKUT) ---
  "Forklift", "Mobile Crane", "Overhead Crane", "Tower Crane", "Truck Mounted Crane",
  "Gantry Crane", "Excavator", "Dump Truck", "Wheel Loader", "Bulldozer", "Hoist Crane",
  "Belt Conveyor", "Reach Stacker", "Passenger Hoist", "Tractor", "Motor Grader", 
  "Skid Steer Loader", "Crawler Crane", "Jib Crane", "Monorail Crane", "Pedestal Crane", 
  "Portal Crane", "Bucket Elevator", "Screw Conveyor", "Pneumatic Conveyor", 
  "Roller Conveyor", "Chain Conveyor", "Hand Pallet", "Pallet Mover", "Reach Truck", 
  "Bobcat", "Backhoe Loader", "Scraper", "Compactor", "Tandem Roller", "Asphalt Finisher",

  // --- KATEGORI PTP (PESAWAT TENAGA DAN PRODUKSI) ---
  "Genset (Generator Set)", "Mesin Bubut", "Mesin Press", "Mesin CNC", "Mesin Milling",
  "Mesin Kompresor", "Mesin Pemecah Batu (Crusher)", "Mesin Tenun", "Mesin Plong", 
  "Mesin Potong (Cutting Machine)", "Mesin Las (Welding Machine)", "Mesin Bor (Drilling Machine)", 
  "Mesin Gerinda", "Mesin Gergaji (Saw Machine)", "Mesin Cetak (Printing Press)", 
  "Mesin Kemas (Packaging Machine)", "Mesin Mixer", "Mesin Penggiling (Grinding)", 
  "Mesin Injeksi Plastik (Injection Molding)", "Mesin Sentrifugal", "Furnace (Tungku Peleburan)", 
  "Turbin Uap", "Turbin Gas", "Kincir Angin", "Pompa Air (Water Pump)",

  // --- KATEGORI PUBT (PESAWAT UAP DAN BEJANA TEKAN) ---
  "Boiler", "Ketel Uap", "Bejana Tekan", "Tangki Timbun", "Air Compressor Tank",
  "Sterilizer", "Autoclave", "Tangki LPG", "Silo", "Pemanas Air (Water Heater)",
  "Heat Exchanger", "Tangki Reaktor", "Tangki Oksigen", "Tangki Nitrogen", 
  "Tangki Amoniak", "Accumulator", "Dearator", "Evaporator", "Separator", 
  "Jacketed Vessel", "Pipanisasi Bertekanan", "Tangki Solar (Fuel Storage Tank)",

  // --- KATEGORI ELEVATOR & ESKALATOR ---
  "Lift Penumpang (Passenger Elevator)", "Lift Barang (Freight Elevator)", 
  "Eskalator", "Travelator (Moving Walk)", "Dumbwaiter", "Lift Rumah Sakit (Bed Elevator)", 
  "Lift Panorama (Panoramic Elevator)", "Lift Servis (Service Elevator)", "Platform Lift",

  // --- KATEGORI INSTALASI LISTRIK & PENYALUR PETIR ---
  "Panel Listrik (MDP/SDP/LVMDP)", "Transformator (Trafo)", "Instalasi Penyalur Petir", 
  "Sistem Grounding (Pembumian)", "Kabel Feeder", "Panel Kapasitor Bank", 
  "Genset Control Panel (AMF/ATS)", "UPS (Uninterruptible Power Supply)", 
  "Instalasi Listrik Gedung", "Gardu Hubung", "Panel Sinkron",

  // --- KATEGORI PROTEKSI KEBAKARAN (HYDRANT & ALARM) ---
  "Fire Alarm System", "Instalasi Hydrant", "Sprinkler System", "APAR (Alat Pemadam Api Ringan)", 
  "Pompa Diesel Hydrant", "Pompa Elektrik Hydrant", "Jockey Pump", "FM200 Suppression System",

  // --- KATEGORI TKPK & LINGKUNGAN KERJA KETINGGIAN ---
  "Angkur (Anchor Point)", "Gondola (Temporary Suspended Platform)", "Scaffolding (Perancah)", 
  "Lifeline System", "Fall Arrester", "Safety Net"
];

export default function ScheduleForm({
  initialSchedule,
  manpowerList,
  units,
  schedules,
  clients,
  absences = [],
  onSave,
  onCancel
}: ScheduleFormProps) {
  // Form States
  const [clientName, setClientName] = useState('');
  const [picName, setPicName] = useState('');
  const [picPhone, setPicPhone] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [unitDescriptions, setUnitDescriptions] = useState<string[]>(['']);
  const [leadExpertId, setLeadExpertId] = useState('');
  const [selectedSupportIds, setSelectedSupportIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<'P1' | 'P2' | 'P3'>('P2');
  const [status, setStatus] = useState<Schedule['status']>('Scheduled');

  // New Upgrade Features States
  const [agendaType, setAgendaType] = useState<string>('Riksa Uji');
  const [manualAgenda, setManualAgenda] = useState('');
  const [isUntilFinished, setIsUntilFinished] = useState<boolean>(false);
  const [isTodayChecked, setIsTodayChecked] = useState<boolean>(false);
  const [location, setLocation] = useState('');

  // Autocomplete & UI Helper States
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [activeDescIndex, setActiveDescIndex] = useState<number | null>(null);
  const [showDescSuggestions, setShowDescSuggestions] = useState(false);
  const [historyTerms, setHistoryTerms] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('equipment_history') || '[]');
    } catch {
      return [];
    }
  });

  // Sync end date with start date if isUntilFinished is true
  useEffect(() => {
    if (isUntilFinished && startDate) {
      setEndDate(startDate);
    }
  }, [startDate, isUntilFinished]);

  // AI Recommendation Feedback State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<{
    recommendedLeadExpertId: string;
    recommendedSupportIds: string[];
    rescheduleAdvice: string;
    reasoning: string;
  } | null>(null);

  // Load initial values if editing
  useEffect(() => {
    if (initialSchedule) {
      setClientName(initialSchedule.client_name || '');
      setPicName(initialSchedule.pic_name || '');
      setPicPhone(initialSchedule.pic_phone || '');
      setStartDate(initialSchedule.start_date || new Date().toISOString().split('T')[0]);
      setEndDate(initialSchedule.end_date || new Date().toISOString().split('T')[0]);
      setStartTime(initialSchedule.start_time || '');
      setEndTime(initialSchedule.end_time || '');
      setSelectedUnitIds(initialSchedule.unit_ids || []);
      setUnitDescriptions(initialSchedule.unit_descriptions && initialSchedule.unit_descriptions.length > 0 ? initialSchedule.unit_descriptions : ['']);
      setLeadExpertId(initialSchedule.lead_expert_id || '');
      setSelectedSupportIds(initialSchedule.support_ids || []);
      setPriority(initialSchedule.priority || 'P2');
      setStatus(initialSchedule.status || 'Scheduled');
      
      // Load new fields
      setAgendaType(initialSchedule.agenda_type || 'Riksa Uji');
      setManualAgenda(initialSchedule.manual_agenda || '');
      setIsUntilFinished(initialSchedule.is_until_finished || false);
      setLocation(initialSchedule.location || '');
      
      const todayStr = new Date().toISOString().split('T')[0];
      setIsTodayChecked(initialSchedule.start_date === todayStr && initialSchedule.end_date === todayStr);
    } else {
      // Clear form & Set Dynamic defaults
      setClientName('');
      setPicName('');
      setPicPhone('');
      const todayStr = new Date().toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
      setStartTime('09:00'); // Default Start Time is automatically 09:00
      setEndTime('');
      setSelectedUnitIds([]);
      setUnitDescriptions(['']);
      setLeadExpertId('');
      setSelectedSupportIds([]);
      setPriority('P2');
      setStatus('Scheduled');
      setAiRecommendation(null);
      
      // Reset new fields
      setAgendaType('Riksa Uji');
      setManualAgenda('');
      setIsUntilFinished(false);
      setIsTodayChecked(false);
      setLocation('');
    }
  }, [initialSchedule]);

  // Client Autocomplete List Filtering
  const filteredClients = useMemo(() => {
    if (!clientName.trim()) return [];
    return (clients || []).filter(c =>
      c.client_name.toLowerCase().includes(clientName.toLowerCase().trim())
    );
  }, [clientName, clients]);

  // K3 Technical Tool Autocomplete Suggestions
  const descSuggestions = useMemo(() => {
    if (activeDescIndex === null) return [];
    const val = unitDescriptions[activeDescIndex] || '';
    if (!val.trim()) return [];

    const words = val.split(/\s+/);
    const lastWord = words[words.length - 1] || '';
    if (!lastWord || lastWord.trim().length === 0) return [];

    const searchStr = lastWord.toLowerCase();

    // Combine static dictionary, dynamic history, and units
    const unitsList = (units || []).map(u => u.unit_name);
    const combinedList = Array.from(new Set([...HEAVY_EQUIPMENT_DICT, ...historyTerms, ...unitsList]));

    // Match case-insensitive anywhere in the word. Prioritize prefix matches.
    const matches = combinedList.filter(item => {
      return item.toLowerCase().includes(searchStr);
    });

    // Sort: Prefix matches first, then internal matches.
    matches.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aStarts = aLower.startsWith(searchStr);
      const bStarts = bLower.startsWith(searchStr);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    });

    // Limit to top 15 suggestions
    return matches.slice(0, 15);
  }, [activeDescIndex, unitDescriptions, historyTerms, units]);

  // Apply K3 autocomplete recommendation to the current focused description input
  const selectDescSuggestion = (suggestion: string) => {
    if (activeDescIndex === null) return;
    setUnitDescriptions(prev => {
      const updated = [...prev];
      const currentVal = updated[activeDescIndex] || '';
      const words = currentVal.split(/\s+/);
      words.pop(); // remove last typed character/prefix
      words.push(suggestion);
      updated[activeDescIndex] = words.join(' ');
      return updated;
    });
    setShowDescSuggestions(false);
  };

  // Capture Enter / Tab keys for autocomplete select
  const handleDescKeyDown = (e: React.KeyboardEvent, index: number) => {
    if ((e.key === 'Enter' || e.key === 'Tab') && descSuggestions.length > 0 && showDescSuggestions) {
      e.preventDefault();
      selectDescSuggestion(descSuggestions[0]);
    }
  };

  // Helper: append Quick-Add template chip labels
  const handleAppendChip = (chipLabel: string) => {
    const targetIdx = activeDescIndex !== null ? activeDescIndex : 0;
    setUnitDescriptions(prev => {
      const updated = [...prev];
      const currentVal = updated[targetIdx] || '';
      // append custom formatting template
      updated[targetIdx] = currentVal + (currentVal ? ' ' : '') + chipLabel + ': ';
      return updated;
    });
  };

  // Handle unit checkbox toggle
  const handleUnitToggle = (unitId: string) => {
    setSelectedUnitIds(prev => {
      const exists = prev.includes(unitId);
      if (exists) {
        return prev.filter(id => id !== unitId);
      } else {
        return [...prev, unitId];
      }
    });
  };

  // Check if manpower is absent within the selected date range
  const getAbsenceInDateRange = (manId: string): { date: string; type: string; reason?: string }[] => {
    if (!absences || absences.length === 0 || !startDate || !endDate) return [];
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const dateList: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dateList.push(d.toISOString().split('T')[0]);
      }
      return absences
        .filter(a => a.manpower_id === manId && dateList.includes(a.date))
        .map(a => ({ date: a.date, type: a.absence_type, reason: a.reason }));
    } catch (e) {
      return [];
    }
  };

  // Find required SKPs based on selected units
  const requiredSKPs = useMemo(() => {
    const skps = new Set<string>();
    selectedUnitIds.forEach(uid => {
      const unit = units.find(u => u.id === uid);
      if (unit) {
        skps.add(unit.required_skp);
      }
    });
    return Array.from(skps);
  }, [selectedUnitIds, units]);

  // SMART DROP-DOWN FILTER: Filter Lead Experts based on required SKP licenses
  const filteredLeadExperts = useMemo(() => {
    if (requiredSKPs.length === 0) {
      // If no unit is selected, show all experts who have at least one SKP license
      return manpowerList.filter(m => m.skp.length > 0);
    }
    // Filter to only experts whose licenses overlap with ANY of the required SKPs for selected units
    return manpowerList.filter(m => {
      return m.skp.some(license => requiredSKPs.includes(license));
    });
  }, [requiredSKPs, manpowerList]);

  // Reset Lead Expert if they no longer match the filtered list (unless it's empty)
  useEffect(() => {
    if (leadExpertId && filteredLeadExperts.length > 0 && agendaType === 'Riksa Uji') {
      const isStillEligible = filteredLeadExperts.some(e => e.id === leadExpertId);
      if (!isStillEligible) {
        setLeadExpertId('');
      }
    }
  }, [filteredLeadExperts, leadExpertId, agendaType]);

  // Helper: check overlap between two date ranges
  const checkDateOverlap = (s1: string, e1: string, s2: string, e2: string) => {
    return s1 <= e2 && e1 >= s2;
  };

  // Conflict lists: check who is booked on the current dates
  const bookingsForCurrentDates = useMemo(() => {
    if (!startDate || !endDate) return [];
    
    // Filter active schedules (excluding this schedule itself if we are editing)
    const activeSchedules = schedules.filter(s => {
      if (s.status === 'Cancelled') return false;
      if (initialSchedule && s.id === initialSchedule.id) return false;
      return checkDateOverlap(s.start_date, s.end_date, startDate, endDate);
    });

    const bookings: { manId: string; clientName: string; priority: string; isLead: boolean }[] = [];
    activeSchedules.forEach(s => {
      if (s.lead_expert_id) {
        bookings.push({
          manId: s.lead_expert_id,
          clientName: s.client_name,
          priority: s.priority,
          isLead: true
        });
      }
      (s.support_ids || []).forEach(sid => {
        bookings.push({
          manId: sid,
          clientName: s.client_name,
          priority: s.priority,
          isLead: false
        });
      });
    });

    return bookings;
  }, [startDate, endDate, schedules, initialSchedule]);

  // Conflict maps
  const leadExpertConflict = useMemo(() => {
    if (!leadExpertId || agendaType !== 'Riksa Uji') return null;
    return bookingsForCurrentDates.find(b => b.manId === leadExpertId) || null;
  }, [leadExpertId, bookingsForCurrentDates, agendaType]);

  const supportConflictsMap = useMemo(() => {
    const map = new Map<string, typeof bookingsForCurrentDates[0]>();
    selectedSupportIds.forEach(sid => {
      const booking = bookingsForCurrentDates.find(b => b.manId === sid);
      if (booking) map.set(sid, booking);
    });
    return map;
  }, [selectedSupportIds, bookingsForCurrentDates]);

  // Support list & Toggle Bulk Select Helpers
  const availableSupportList = useMemo(() => {
    return manpowerList.filter(m => agendaType !== 'Riksa Uji' || m.id !== leadExpertId);
  }, [manpowerList, agendaType, leadExpertId]);

  const areAllSupportSelected = useMemo(() => {
    if (availableSupportList.length === 0) return false;
    return availableSupportList.every(m => selectedSupportIds.includes(m.id));
  }, [availableSupportList, selectedSupportIds]);

  const handleToggleSelectAllSupport = () => {
    if (areAllSupportSelected) {
      const displayedIds = availableSupportList.map(m => m.id);
      setSelectedSupportIds(prev => prev.filter(id => !displayedIds.includes(id)));
    } else {
      setSelectedSupportIds(prev => {
        const currentSet = new Set(prev);
        availableSupportList.forEach(m => currentSet.add(m.id));
        return Array.from(currentSet);
      });
    }
  };

  // AI Sudden Plotter action
  const handleAiAutoPlot = async () => {
    if (!startDate || !endDate || selectedUnitIds.length === 0) {
      setAiError('Mohon isi Tanggal dan pilih minimal 1 Unit sebelum menggunakan AI Auto-Plot.');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiRecommendation(null);

    try {
      const response = await fetch('/api/ai-plotter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName || 'Sudden Inspection',
          pic_name: picName || 'Operator',
          start_date: startDate,
          end_date: endDate,
          unit_ids: selectedUnitIds,
          priority
        })
      });

      if (!response.ok) {
        throw new Error('Gagal memproses rekomendasi AI.');
      }

      const recommendation = await response.json();
      setAiRecommendation(recommendation);

      // Automatically apply the recommendation to the form states!
      if (recommendation.recommendedLeadExpertId) {
        setLeadExpertId(recommendation.recommendedLeadExpertId);
      }
      if (recommendation.recommendedSupportIds && recommendation.recommendedSupportIds.length > 0) {
        setSelectedSupportIds(recommendation.recommendedSupportIds);
      }
    } catch (err: any) {
      setAiError(err.message || 'Gagal berkomunikasi dengan AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddDescriptionRow = () => {
    setUnitDescriptions(prev => [...prev, '']);
  };

  const handleDuplicateDescriptionRow = (index: number) => {
    setUnitDescriptions(prev => {
      const updated = [...prev];
      const valToDuplicate = updated[index] || '';
      updated.splice(index + 1, 0, valToDuplicate);
      return updated;
    });
  };

  const handleDescriptionChange = (index: number, value: string) => {
    setUnitDescriptions(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleRemoveDescriptionRow = (index: number) => {
    setUnitDescriptions(prev => {
      if (prev.length <= 1) {
        return [''];
      }
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return alert('Mohon isi Nama Klien');
    if (!picPhone.trim()) return alert('Mohon isi Kontak PIC');
    if (!agendaType) return alert('Mohon tentukan Jenis Agenda');
    if (!startDate || !endDate) return alert('Mohon tentukan tanggal');

    // Strict validation guidelines: only technical fields are conditional based on type Riksa Uji
    if (agendaType === 'Riksa Uji') {
      if (selectedUnitIds.length === 0) return alert('Mohon pilih minimal satu unit untuk Riksa Uji');
      if (!leadExpertId) return alert('Mohon tentukan Lead Expert');
    }

    // Save to local storage history on submit
    const newItems = unitDescriptions.filter(val => val.trim() !== '');
    if (newItems.length > 0) {
      try {
        const currentHist = JSON.parse(localStorage.getItem('equipment_history') || '[]');
        const updatedHist = Array.from(new Set([...newItems, ...currentHist])).slice(0, 100);
        localStorage.setItem('equipment_history', JSON.stringify(updatedHist));
        setHistoryTerms(updatedHist);
      } catch (err) {
        console.error(err);
      }
    }

    onSave({
      client_name: clientName.trim(),
      pic_name: picName.trim() || 'Staff PIC',
      pic_phone: picPhone.trim(),
      start_date: startDate,
      end_date: endDate,
      start_time: startTime || undefined,
      end_time: isUntilFinished ? undefined : (endTime || undefined),
      unit_ids: agendaType === 'Riksa Uji' ? selectedUnitIds : [],
      unit_descriptions: agendaType === 'Riksa Uji' ? unitDescriptions.filter(val => val.trim() !== '') : [],
      lead_expert_id: agendaType === 'Riksa Uji' ? leadExpertId : undefined,
      support_ids: selectedSupportIds,
      priority,
      status,
      agenda_type: agendaType,
      manual_agenda: agendaType === 'Lainnya' ? manualAgenda : undefined,
      is_until_finished: isUntilFinished,
      location: location || undefined
    });
  };

  return (
    <form
      id="schedule_plotting_form"
      onSubmit={handleSaveForm}
      className="bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] md:max-h-[85vh] text-slate-800 overflow-hidden w-full transition-all"
    >
      {/* STICKY HEADER */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0 bg-white z-10">
        <div>
          <h3 className="font-bold text-slate-800 text-sm md:text-base tracking-tight uppercase">
            {initialSchedule ? 'Ubah Plotting Jadwal' : 'Tambah Plotting Baru'}
          </h3>
          <p className="text-[10px] text-slate-450 mt-0.5">Lengkapi data koordinasi riksa teknik di bawah ini</p>
        </div>
        <button
          id="btn_cancel_form"
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-all"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* SCROLLABLE FORM BODY */}
      <div className="overflow-y-auto flex-1 p-5 md:p-6 space-y-5">
        
        {/* Basic Inputs (Klien, PIC, and Contact) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* PT Client input with beautiful dropdown autocomplete suggestions */}
          <div className="space-y-1 relative">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Nama Klien / Perusahaan</label>
            <input
              id="input_client_name"
              type="text"
              required
              value={clientName}
              onChange={e => {
                setClientName(e.target.value);
                setShowClientSuggestions(true);
              }}
              onFocus={() => setShowClientSuggestions(true)}
              onBlur={() => {
                // Slight delay so suggestions list items registers clicks properly
                setTimeout(() => setShowClientSuggestions(false), 250);
              }}
              placeholder="PT Sukses Sejahtera"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 placeholder-slate-400 font-medium h-10"
            />
            {showClientSuggestions && filteredClients.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-50 border-t-0">
                {filteredClients.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => {
                      setClientName(c.client_name);
                      setPicName(c.pic_name);
                      setPicPhone(c.pic_phone);
                      setShowClientSuggestions(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-emerald-50/50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800">{c.client_name}</p>
                      <p className="text-[10px] text-slate-450">PIC: {c.pic_name} ({c.pic_phone})</p>
                    </div>
                    <span className="text-[8px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded-lg border border-emerald-100 flex items-center gap-1 shrink-0">
                      <Check className="h-2 w-2" />
                      Database
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">PIC Lapangan</label>
            <input
              id="input_pic_name"
              type="text"
              value={picName}
              onChange={e => setPicName(e.target.value)}
              placeholder="Budi Setiawan"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 placeholder-slate-400 font-medium h-10"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
              <span>Kontak PIC (WA/HP)</span>
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="input_pic_phone"
                type="text"
                required
                value={picPhone}
                onChange={e => setPicPhone(e.target.value)}
                placeholder="0812-xxxx-xxxx"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 placeholder-slate-400 font-medium h-10"
              />
              <Phone className="absolute left-2.5 top-3 h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Jenis Agenda */}
        <div className="space-y-1.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60">
          <label className="text-[11px] font-extrabold text-slate-450 uppercase tracking-wider block">Jenis Agenda Kegiatan</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'Riksa Uji', label: 'Riksa Uji' },
              { id: 'Meeting', label: 'Meeting' },
              { id: 'Survey', label: 'Survey' },
              { id: 'Lainnya', label: 'Lainnya' }
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAgendaType(opt.id)}
                className={`px-1.5 py-2 text-[10px] md:text-[11px] font-extrabold rounded-lg border text-center transition-all ${
                  agendaType === opt.id
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-white border-slate-250 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {agendaType === 'Lainnya' && (
            <div className="mt-2.5">
              <input
                id="input_manual_agenda"
                type="text"
                required
                value={manualAgenda}
                onChange={e => setManualAgenda(e.target.value)}
                placeholder="Tuliskan nama kegiatan manual riksa teknik..."
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-medium h-10"
              />
            </div>
          )}
        </div>

        {/* Conditional Location Field for Meeting, Survey or Lainnya */}
        {agendaType !== 'Riksa Uji' && (
          <div className="space-y-1 bg-emerald-50/20 p-3 rounded-xl border border-emerald-100">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              <span>Lokasi Kegiatan (Ruangan/Situs)</span>
            </label>
            <input
              id="input_location"
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Contoh: Gedung A Lt. 3 atau Ruang Rapat Utama"
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 placeholder-slate-400 font-medium h-10"
            />
          </div>
        )}

        {/* Date Row with Options */}
        <div className="space-y-2 bg-slate-50/40 p-3.5 rounded-xl border border-slate-200/50">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Tanggal Kegiatan</label>
            <div className="flex items-center gap-4">
              {/* Checkbox Hari Ini */}
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-extrabold text-slate-500 hover:text-emerald-600 select-none">
                <input
                  type="checkbox"
                  checked={isTodayChecked}
                  onChange={e => {
                    const checked = e.target.checked;
                    setIsTodayChecked(checked);
                    if (checked) {
                      const todayStr = new Date().toISOString().split('T')[0];
                      setStartDate(todayStr);
                      setEndDate(todayStr);
                    }
                  }}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/10 h-3.5 w-3.5"
                />
                <span>Hari Ini (Survey Cepat)</span>
              </label>

              {/* Checkbox Sampai Selesainya */}
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-extrabold text-slate-500 hover:text-emerald-600 select-none">
                <input
                  type="checkbox"
                  checked={isUntilFinished}
                  onChange={e => {
                    const checked = e.target.checked;
                    setIsUntilFinished(checked);
                    if (checked) {
                      setEndDate(startDate);
                    }
                  }}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/10 h-3.5 w-3.5"
                />
                <span>Sampai Selesai</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[9px] font-extrabold text-slate-400 block uppercase">Mulai</span>
              <input
                type="date"
                required
                value={startDate}
                disabled={isTodayChecked}
                onChange={e => {
                  setStartDate(e.target.value);
                  setIsTodayChecked(false);
                }}
                className="w-full bg-white border border-slate-200 disabled:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-semibold h-10"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-extrabold text-slate-400 block uppercase">Selesai</span>
              {isUntilFinished ? (
                <input
                  type="text"
                  disabled
                  value="Sampai Selesainya"
                  className="w-full bg-slate-100 border border-slate-200 disabled:opacity-90 rounded-lg px-3 py-2 text-xs text-emerald-700 font-extrabold italic h-10 text-center"
                />
              ) : (
                <input
                  type="date"
                  required
                  value={endDate}
                  disabled={isTodayChecked}
                  onChange={e => {
                    setEndDate(e.target.value);
                    setIsTodayChecked(false);
                  }}
                  className="w-full bg-white border border-slate-200 disabled:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-semibold h-10"
                />
              )}
            </div>
          </div>
        </div>

        {/* Jam Kerja */}
        <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-200/60 space-y-2">
          <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">Jam Kerja / Operasional</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Jam Mulai</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-mono h-10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Jam Selesai</label>
              <input
                type="time"
                value={isUntilFinished ? '' : endTime}
                disabled={isUntilFinished}
                onChange={e => setEndTime(e.target.value)}
                placeholder="Sampai Selesai"
                className="w-full bg-white border border-slate-250 disabled:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-mono h-10"
              />
            </div>
          </div>
        </div>

        {/* Priority & Status Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Prioritas Riksa</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-semibold h-10"
            >
              <option value="P1">P1 - Critical (Red)</option>
              <option value="P2">P2 - High (Yellow)</option>
              <option value="P3">P3 - Medium (Green)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Status Riksa</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-semibold h-10"
            >
              <option value="Draft">Draft (Rencana)</option>
              <option value="Scheduled">Scheduled (Aktif)</option>
              <option value="Completed">Completed (Selesai)</option>
              <option value="Cancelled">Cancelled (Batal)</option>
            </select>
          </div>
        </div>

        {/* TECHNICAL SHIELD: ONLY DISPLAY UNITS CHECKLIST AND DETAILS IF RIKSA UJI TYPE */}
        {agendaType === 'Riksa Uji' ? (
          <>
            {/* Unit Inspeksi (Checkboxes) */}
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Unit Alat yang Diinspeksi</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/50 p-3 rounded-xl border border-slate-200">
                {units.map(unit => {
                  const isChecked = selectedUnitIds.includes(unit.id);
                  return (
                    <label
                      key={unit.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-emerald-50/50 border-emerald-300 text-emerald-900'
                          : 'bg-slate-100/30 border-slate-200 text-slate-600 hover:bg-slate-100/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleUnitToggle(unit.id)}
                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 shrink-0 cursor-pointer"
                      />
                      <div className="text-[11px]">
                        <p className="font-bold leading-tight">{unit.unit_name}</p>
                        <span className="text-[9px] text-[#B8860B] font-mono font-semibold">Lisensi SKP: {unit.required_skp}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Detail Deskripsi Unit with active word lookup Suggestions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Detail Deskripsi Unit (Opsional)
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  {unitDescriptions.filter(d => d.trim() !== '').length} terisi
                </span>
              </div>

              {/* Quick-Add Template Chips */}
              <div className="flex flex-wrap gap-1.5 mb-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-[9px] font-extrabold text-slate-400 self-center uppercase mr-1">Template Chips:</span>
                {[
                  { label: '+ Merek', value: 'Merek' },
                  { label: '+ Kapasitas', value: 'Kapasitas' },
                  { label: '+ No. Seri', value: 'No. Seri' },
                  { label: '+ Kode Lokasi', value: 'Kode Lokasi' }
                ].map(chip => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleAppendChip(chip.value)}
                    className="px-2 py-1 text-[10px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 rounded-md transition-all active:scale-95"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-200">
                <div className="space-y-2">
                  {unitDescriptions.map((desc, index) => (
                    <div key={index} className="flex items-center gap-2 relative">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={desc}
                          onChange={e => handleDescriptionChange(index, e.target.value)}
                          onKeyDown={e => handleDescKeyDown(e, index)}
                          onFocus={() => {
                            setActiveDescIndex(index);
                            setShowDescSuggestions(true);
                          }}
                          onBlur={() => {
                            // delay slightly so mouse clicks can trigger selectDescSuggestion
                            setTimeout(() => {
                              setShowDescSuggestions(false);
                            }, 250);
                          }}
                          placeholder={`Contoh: Forklift No. Ser_09${index + 1} atau Boiler`}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 placeholder-slate-400 font-medium h-10"
                        />

                        {/* Floating Autocomplete recommendation for specified K3 tools */}
                        {activeDescIndex === index && showDescSuggestions && descSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto divide-y divide-slate-50">
                            {descSuggestions.map(tool => (
                              <button
                                key={tool}
                                type="button"
                                onMouseDown={() => selectDescSuggestion(tool)}
                                className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 text-slate-800 text-xs font-bold transition-colors flex items-center justify-between"
                              >
                                <span>{tool}</span>
                                <span className="text-[8px] text-emerald-600 bg-emerald-50 px-1 rounded uppercase font-mono tracking-wider">K3 Tool</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Duplicate Button */}
                      <button
                        type="button"
                        onClick={() => handleDuplicateDescriptionRow(index)}
                        title="Duplikat Baris"
                        className="p-2.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 rounded-lg transition-all flex items-center justify-center shrink-0 h-10 w-10 active:scale-95"
                      >
                        <Copy className="h-4 w-4" />
                      </button>

                      {/* Trash Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveDescriptionRow(index)}
                        title="Hapus Baris"
                        className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-lg transition-all flex items-center justify-center shrink-0 h-10 w-10 active:scale-95"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Row Button at the bottom */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleAddDescriptionRow}
                    className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-emerald-300 text-emerald-700 bg-emerald-50/20 hover:bg-emerald-50 hover:border-emerald-500 rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer select-none h-10"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah Unit / Baris Baru</span>
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 italic font-sans leading-tight mt-2.5">
                  Ketik nama alat teknis K3 (e.g. Forklift, Crane, Boiler, Genset, Panel, Hydrant) untuk memunculkan autocomplete cerdas dari database & kamus K3. Tekan <strong>Enter</strong> atau <strong>Tab</strong> untuk memilih.
                </p>
              </div>
            </div>

            {/* AI AUTO-PLOTTER BUTTON */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleAiAutoPlot}
                disabled={aiLoading}
                className="w-full bg-[#D4AF37] hover:bg-[#B8860B] text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-50 h-11"
              >
                <Sparkles className={`h-4 w-4 text-white ${aiLoading ? 'animate-spin' : ''}`} />
                {aiLoading ? 'Mengotomatisasi Plotting via AI...' : 'AI Auto-Plot (Smart Planner)'}
              </button>
              <p className="text-[10px] text-slate-400 text-center mt-1.5 font-sans leading-tight">
                AI akan memeriksa SKP, mencocokkan ketersediaan jadwal, & merekomendasikan personil secara instan!
              </p>
            </div>

            {/* AI Output Alert Area */}
            {aiError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg flex items-start gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{aiError}</span>
              </div>
            )}

            {aiRecommendation && (
              <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-3.5 relative overflow-hidden space-y-2">
                <div className="absolute top-0 right-0 p-1 text-[8px] bg-amber-100 text-[#B8860B] uppercase font-mono tracking-wider rounded-bl border-l border-b border-amber-200 font-bold">
                  Rekomendasi AI
                </div>
                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px]">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  <span>Saran Plotting & Penjadwalan Ulang</span>
                </div>
                <p className="text-xs text-slate-700 italic leading-relaxed font-medium">
                  "{aiRecommendation.rescheduleAdvice}"
                </p>
                <div className="text-[10px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-800">Justifikasi Teknis:</span> {aiRecommendation.reasoning}
                </div>
              </div>
            )}

            {/* SMART DROPDOWN: Lead Expert Selection */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                  Lead Expert (Ahli SKP)
                </label>
                <span className="text-[9px] text-slate-400 font-bold font-mono">
                  {filteredLeadExperts.length} qualified
                </span>
              </div>

              {requiredSKPs.length > 0 && (
                <div className="text-[9px] bg-amber-50 text-[#B8860B] px-2 py-1 rounded border border-amber-200 uppercase font-mono font-bold inline-block mb-1">
                  Butuh SKP: {requiredSKPs.join(', ')}
                </div>
              )}

              <select
                value={leadExpertId}
                required={agendaType === 'Riksa Uji'}
                onChange={e => setLeadExpertId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 font-semibold h-10"
              >
                <option value="">-- Pilih Lead Expert (Disaring Berdasarkan SKP) --</option>
                {filteredLeadExperts.map(expert => {
                  const rangeAbsences = getAbsenceInDateRange(expert.id);
                  const prefix = rangeAbsences.length > 0 
                    ? `[🔴 ABSEN: ${rangeAbsences.map(ra => ra.type).join(',')}] ` 
                    : '';
                  return (
                    <option key={expert.id} value={expert.id}>
                      {prefix}{expert.name} ({expert.role}) - SKP: {expert.skp.join(', ')}
                    </option>
                  );
                })}
              </select>

              {/* Warning Badge if Selected Lead Expert is Absent */}
              {(() => {
                if (!leadExpertId) return null;
                const rangeAbsences = getAbsenceInDateRange(leadExpertId);
                if (rangeAbsences.length === 0) return null;
                return (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-2.5 rounded-lg flex items-start gap-2 mt-1 font-medium animate-pulse">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                    <div>
                      <span className="font-extrabold">⚠️ Peringatan Manpower Absen/Izin:</span> {manpowerList.find(m => m.id === leadExpertId)?.name} tercatat berhalangan hadir pada tanggal berikut:
                      <ul className="list-disc list-inside mt-1 font-bold">
                        {rangeAbsences.map((ra, idx) => (
                          <li key={idx}>
                            {ra.date}: {ra.type} {ra.reason ? `("${ra.reason}")` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })()}

              {/* Warning Badge if Lead Expert has Schedule Conflict */}
              {leadExpertConflict && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2.5 rounded-lg flex items-start gap-2 mt-1 font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  <div>
                    <span className="font-bold">⚠️ Warning Konflik Jadwal:</span> {manpowerList.find(m => m.id === leadExpertId)?.name} sudah memiliki jadwal riksa aktif pada tanggal ini di <strong className="text-slate-850">"{leadExpertConflict.clientName}"</strong> ({leadExpertConflict.priority}).
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}

        {/* Support Team Selection / Participants Selector - Different Labels depending on Riksa Uji / Meeting-Survey */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
              {agendaType === 'Riksa Uji' 
                ? 'Daftar Tim Support (Rekomendasi 1-3 orang)' 
                : 'Daftar Peserta / Personel yang Ditugaskan'}
            </label>
            {availableSupportList.length > 0 && (
              <button
                type="button"
                onClick={handleToggleSelectAllSupport}
                className={`text-[10px] font-extrabold px-2.5 py-1 rounded-md border transition-all active:scale-95 flex items-center gap-1 cursor-pointer select-none shrink-0 ${
                  areAllSupportSelected
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                }`}
              >
                {areAllSupportSelected ? 'Batalkan Semua' : 'Pilih Semua'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/50 p-3 rounded-xl border border-slate-200">
            {availableSupportList.map(support => {
              const isChecked = selectedSupportIds.includes(support.id);
              const conflict = supportConflictsMap.get(support.id);
              return (
                <div
                  key={support.id}
                  className={`p-2.5 rounded-lg border flex flex-col justify-between transition-all ${
                    isChecked
                      ? 'bg-emerald-50/40 border-emerald-300'
                      : 'bg-slate-100/40 border-slate-200 hover:bg-slate-100/80'
                  }`}
                >
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setSelectedSupportIds(prev =>
                          isChecked ? prev.filter(id => id !== support.id) : [...prev, support.id]
                        );
                      }}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer shrink-0"
                    />
                    <div className="text-[11px]">
                      <span className="font-bold text-slate-800 block leading-tight">{support.name}</span>
                      <span className="text-[9px] text-slate-500 block mt-1 font-medium">
                        {support.role} {support.skp.length > 0 ? `- SKP: ${support.skp.join(', ')}` : ''}
                      </span>
                    </div>
                  </label>

                  {(() => {
                    const rangeAbsences = getAbsenceInDateRange(support.id);
                    if (rangeAbsences.length === 0) return null;
                    return (
                      <span className="text-[8px] text-rose-750 font-bold bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded mt-1.5 block leading-normal" title="Berhalangan hadir">
                        🔴 Absen: {rangeAbsences.map(ra => `${ra.type} (${ra.date})`).join(', ')}
                      </span>
                    );
                  })()}

                  {conflict && (
                    <span className="text-[8px] text-amber-700 font-bold bg-amber-50 border border-amber-150 px-1.5 py-0.5 rounded mt-1.5 block truncate" title={`Bentrok di ${conflict.clientName}`}>
                      ⚠️ Bentrok di {conflict.clientName}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* STICKY FOOTER */}
      <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0 z-10">
        <button
          id="btn_cancel_form_footer"
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all shadow-sm h-10"
        >
          Batalkan
        </button>
        <button
          id="btn_submit_form"
          type="submit"
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 h-10"
        >
          <Save className="h-4 w-4" />
          Simpan Jadwal Plotting
        </button>
      </div>
    </form>
  );
}
