const fs = require('fs');

let code = fs.readFileSync('src/components/RetentionModule.tsx', 'utf8');

// 1. Update ClientFormModal interface
code = code.replace(
  /onSave: \(clientData: Partial<RetentionClient>, equipmentData: Partial<ClientEquipment>\) => Promise<void>;/,
  'onSave: (clientData: Partial<RetentionClient>, equipmentData: Partial<ClientEquipment>[]) => Promise<void>;'
);

// 2. Update ClientFormModal states and handlers
const stateRegex = /const \[eqName, setEqName\] = useState\(initialEquipment\?\.equipment_name \|\| ''\);[\s\S]*?const handleLastDateChange = \(val: string\) => \{/;
const newStates = `const COMMON_K3_TOOLS = [
    'Elevator', 'Eskalator', 'Forklift', 'Overhead Crane', 'Hoist',
    'Loader', 'Excavator', 'Gondola', 'Instalasi Penyalur Petir',
    'Instalasi Listrik', 'Motor Diesel / Genset', 'Boiler', 'Bejana Tekan',
    'Tangki Timbun', 'Compressor'
  ];

  const [eqNames, setEqNames] = useState<string[]>(
    initialEquipment ? [initialEquipment.equipment_name] : ['']
  );
  const [activeEqIndex, setActiveEqIndex] = useState<number | null>(null);
  const [showEqSuggestions, setShowEqSuggestions] = useState(false);

  const eqSuggestions = useMemo(() => {
    if (activeEqIndex === null) return [];
    const val = eqNames[activeEqIndex].toLowerCase();
    if (!val) return COMMON_K3_TOOLS.slice(0, 5);
    return COMMON_K3_TOOLS.filter(t => t.toLowerCase().includes(val));
  }, [eqNames, activeEqIndex]);

  const handleEqChange = (index: number, val: string) => {
    const newArr = [...eqNames];
    newArr[index] = val;
    setEqNames(newArr);
  };

  const handleAddEqRow = () => setEqNames(prev => [...prev, '']);
  const handleRemoveEqRow = (index: number) => {
    if (eqNames.length > 1) setEqNames(prev => prev.filter((_, i) => i !== index));
  };
  const handleDuplicateEqRow = (index: number) => {
    const newArr = [...eqNames];
    newArr.splice(index + 1, 0, newArr[index]);
    setEqNames(newArr);
  };
  const selectEqSuggestion = (val: string) => {
    if (activeEqIndex !== null) {
      handleEqChange(activeEqIndex, val);
      setShowEqSuggestions(false);
    }
  };
  const handleAppendChip = (chip: string) => {
    if (activeEqIndex !== null) {
      const current = eqNames[activeEqIndex];
      handleEqChange(activeEqIndex, current ? \`\${current} \${chip}\` : chip);
    }
  };

  const [eqType, setEqType] = useState(initialEquipment?.equipment_type || 'PAA');
  const [lastDate, setLastDate] = useState(initialEquipment?.last_inspection_date || '');
  const [dueDate, setDueDate] = useState(initialEquipment?.due_date || '');
  const [certNo, setCertNo] = useState(initialEquipment?.certificate_number || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLastDateChange = (val: string) => {`;
code = code.replace(stateRegex, newStates);

// 3. Update handleSubmit in ClientFormModal
const handleSubmitRegex = /const handleSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?finally \{ setIsLoading\(false\); \}\n  \};/;
const newHandleSubmit = `const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) { setError('Nama PT wajib diisi.'); return; }
    if (eqNames.filter(n => n.trim()).length === 0) { setError('Minimal isi 1 Nama Alat.'); return; }
    if (!lastDate) { setError('Tanggal pemeriksaan terakhir wajib diisi.'); return; }
    setError(''); setIsLoading(true);
    try {
      const equipmentsArray = eqNames.filter(n => n.trim()).map(name => ({
        ...(initialEquipment || {}),
        equipment_name: name.trim(),
        equipment_type: eqType,
        last_inspection_date: lastDate,
        due_date: dueDate,
        certificate_number: certNo
      }));

      await onSave(
        { ...(initialClient || {}), client_name: clientName.trim(), pic_name: picName, pic_phone: picPhone, pic_email: picEmail, drive_folder_url: driveUrl, notes: clientNotes },
        equipmentsArray
      );
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data.');
    } finally { setIsLoading(false); }
  };`;
code = code.replace(handleSubmitRegex, newHandleSubmit);

// 4. Update the equipment section in the render function
const equipmentSectionRegex = /<div>\s*<label className="text-\[10px\] font-bold text-slate-600 block mb-1">Nama Alat \*\s*<\/label>[\s\S]*?<\/div>\s*<div className="grid grid-cols-2 gap-3">/;
const newEquipmentSection = `
                {/* Dynamic Equipment Array */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Daftar Nama Alat *</label>
                    <span className="text-[10px] text-slate-400 font-medium">{eqNames.filter(d => d.trim() !== '').length} terisi</span>
                  </div>

                  {!initialEquipment && (
                    <div className="flex flex-wrap gap-1.5 mb-2 bg-slate-50/50 p-1.5 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-extrabold text-slate-400 self-center uppercase mr-1 ml-1">Template Chips:</span>
                      {[
                        { label: '+ Merek', value: 'Merek' },
                        { label: '+ Kapas', value: 'Kapasitas' },
                        { label: '+ No.Seri', value: 'No.Seri' }
                      ].map(chip => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => handleAppendChip(chip.value)}
                          className="px-2 py-1 text-[9px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 rounded-md transition-all active:scale-95"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2 max-h-48 overflow-y-auto p-1">
                    {eqNames.map((desc, index) => (
                      <div key={index} className="flex items-center gap-2 relative">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={desc}
                            onChange={e => handleEqChange(index, e.target.value)}
                            onFocus={() => { setActiveEqIndex(index); setShowEqSuggestions(true); }}
                            onBlur={() => setTimeout(() => setShowEqSuggestions(false), 250)}
                            placeholder="Misal: Forklift 5 Ton Unit-01"
                            className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-300 outline-none"
                          />
                          
                          {activeEqIndex === index && showEqSuggestions && eqSuggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto divide-y divide-slate-50">
                              {eqSuggestions.map(tool => (
                                <button
                                  key={tool}
                                  type="button"
                                  onMouseDown={() => selectEqSuggestion(tool)}
                                  className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 text-slate-800 text-xs font-bold transition-colors"
                                >
                                  {tool}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {!initialEquipment && (
                          <>
                            <button type="button" onClick={() => handleDuplicateEqRow(index)} title="Duplikat"
                              className="p-2 bg-slate-100 hover:bg-emerald-50 text-slate-600 rounded-lg transition-all h-[36px] w-[36px] flex items-center justify-center">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => handleRemoveEqRow(index)} title="Hapus"
                              className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-all h-[36px] w-[36px] flex items-center justify-center disabled:opacity-50"
                              disabled={eqNames.length === 1}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {!initialEquipment && (
                    <button type="button" onClick={handleAddEqRow}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 mt-2 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors w-full justify-center border border-emerald-100">
                      <Plus className="h-3.5 w-3.5" /> Tambah Baris Alat Lainnya
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-3">`;
code = code.replace(equipmentSectionRegex, newEquipmentSection);


// 5. Update handleSaveClientEquipment signature and implementation
const saveHandlerRegex = /const handleSaveClientEquipment = async \(clientData: Partial<RetentionClient>, eqData: Partial<ClientEquipment>\) => \{[\s\S]*?\}\n    await onRefresh\(\);\n  \};/;

const newSaveHandler = `const handleSaveClientEquipment = async (clientData: Partial<RetentionClient>, eqDataList: Partial<ClientEquipment>[]) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase tidak terkonfigurasi. Data tidak dapat disimpan.');
    }
    setIsSaving(true);
    try {
      let clientId = editingClient?.id;

      if (!editingClient) {
        // New client
        const { data: newClient, error } = await supabase
          .from('clients')
          .upsert([{ client_name: clientData.client_name, pic_name: clientData.pic_name, pic_phone: clientData.pic_phone, pic_email: clientData.pic_email, drive_folder_url: clientData.drive_folder_url, notes: clientData.notes }], { onConflict: 'client_name' })
          .select('id')
          .single();
        if (error) throw new Error(error.message);
        clientId = newClient.id;
      } else {
        // Update existing client
        const { error } = await supabase.from('clients').update({
          client_name: clientData.client_name, pic_name: clientData.pic_name, pic_phone: clientData.pic_phone,
          pic_email: clientData.pic_email, drive_folder_url: clientData.drive_folder_url, notes: clientData.notes
        }).eq('id', editingClient.id);
        if (error) throw new Error(error.message);
      }

      // Save equipment(s)
      if (editingEquipment) {
        // Edit mode (single equipment)
        const eqData = eqDataList[0];
        const { error } = await supabase.from('client_equipments').update({
          equipment_name: eqData.equipment_name, equipment_type: eqData.equipment_type,
          last_inspection_date: eqData.last_inspection_date, due_date: eqData.due_date,
          certificate_number: eqData.certificate_number
        }).eq('id', editingEquipment.id);
        if (error) throw new Error(error.message);
      } else {
        // Add mode (bulk equipments)
        const inserts = eqDataList.map(eq => ({
          client_id: clientId,
          equipment_name: eq.equipment_name,
          equipment_type: eq.equipment_type,
          last_inspection_date: eq.last_inspection_date,
          due_date: eq.due_date,
          certificate_number: eq.certificate_number
        }));
        
        const { error } = await supabase.from('client_equipments').insert(inserts);
        if (error) throw new Error(error.message);
      }

      setIsFormOpen(false);
      setEditingClient(null);
      setEditingEquipment(null);
    } catch (err: any) {
      alert('Gagal menyimpan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
    await onRefresh();
  };`;

code = code.replace(saveHandlerRegex, newSaveHandler);

fs.writeFileSync('src/components/RetentionModule.tsx', code);
console.log('Update Complete!');
