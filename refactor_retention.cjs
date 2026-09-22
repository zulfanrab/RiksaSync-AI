const fs = require('fs');

// 1. Refactor App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

// Replace handleCreateInspectionJob with handleCreateInspectionJobs
appCode = appCode.replace(
  /const handleCreateInspectionJob = async \(job: Partial<InspectionJob>\) => {[\s\S]*?};/,
  `const handleCreateInspectionJobs = async (jobs: Partial<InspectionJob>[]) => {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from('inspection_jobs').insert(jobs.map(j => ({ ...j, created_by: activeUser || undefined })));
    if (!error) {
      await loadAllData();
    }
  };`
);

// Update RetentionModule prop in App.tsx
appCode = appCode.replace(
  'onCreateInspectionJob={handleCreateInspectionJob}',
  'onCreateInspectionJobs={handleCreateInspectionJobs}'
);

fs.writeFileSync('src/App.tsx', appCode);

// 2. Refactor RetentionModule.tsx
let retentionCode = fs.readFileSync('src/components/RetentionModule.tsx', 'utf8');

// Change prop interface
retentionCode = retentionCode.replace(
  'onCreateInspectionJob: (job: Partial<InspectionJob>) => Promise<void>;',
  'onCreateInspectionJobs: (jobs: Partial<InspectionJob>[]) => Promise<void>;'
);

// Change destructured prop
retentionCode = retentionCode.replace(
  'onCreateInspectionJob,',
  'onCreateInspectionJobs,'
);

// We need to add state for selectedEquipmentIds
const stateInject = `  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
`;
retentionCode = retentionCode.replace(
  'const [importModalOpen, setImportModalOpen] = useState(false);',
  stateInject
);

// Replace handleCreateInspectionJob logic with handleBulkDeal
const oldHandleCreate = /const handleCreateInspectionJob = async \(\) => {[\s\S]*?onSwitchToInspection\(\);\n  };/;
const newHandleCreate = `  const handleBulkDeal = async () => {
    if (selectedEquipmentIds.length === 0) return;
    
    const jobsToCreate = selectedEquipmentIds.map(eqId => {
      const equipment = equipments.find(e => e.id === eqId);
      const client = clients.find(c => c.id === equipment?.client_id);
      
      if (!equipment || !client) return null;
      
      return {
        client_id: client.id,
        equipment_id: equipment.id,
        client_name: client.client_name,
        pic_name: client.pic_name,
        pic_phone: client.pic_phone,
        equipment_name: equipment.equipment_name,
        equipment_type: equipment.equipment_type,
        due_date: equipment.due_date,
        stage: 'Penawaran',
        created_by: activeUser,
      };
    }).filter(Boolean) as any;

    await onCreateInspectionJobs(jobsToCreate);
    setSelectedEquipmentIds([]);
    onSwitchToInspection();
  };`;
retentionCode = retentionCode.replace(oldHandleCreate, newHandleCreate);


// Inject checkboxes in ClientCard rendering
// We need to find the equipment mapping
// <tr key={eq.id} className="hover:bg-slate-50 transition-colors">
// We need to change it to include a checkbox cell
const rowReplace = `<tr key={eq.id} className="hover:bg-slate-50 transition-colors">`;
const rowNew = `<tr key={eq.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      checked={selectedEquipmentIds.includes(eq.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedEquipmentIds(prev => [...prev, eq.id]);
                        else setSelectedEquipmentIds(prev => prev.filter(id => id !== eq.id));
                      }}
                    />
                  </td>`;
retentionCode = retentionCode.split(rowReplace).join(rowNew);

// Also need to add empty th for checkbox
const thReplace = `<th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Tgl Jatuh Tempo</th>`;
const thNew = `<th className="w-10 px-4 py-3 text-left text-[10px] font-black text-slate-500">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      onChange={(e) => {
                        const ids = clientEqs.map(eq => eq.id);
                        if (e.target.checked) {
                          setSelectedEquipmentIds(prev => Array.from(new Set([...prev, ...ids])));
                        } else {
                          setSelectedEquipmentIds(prev => prev.filter(id => !ids.includes(id)));
                        }
                      }}
                      checked={clientEqs.length > 0 && clientEqs.every(eq => selectedEquipmentIds.includes(eq.id))}
                    />
                  </th>
                  ` + thReplace;
retentionCode = retentionCode.split(thReplace).join(thNew);

// Add the Floating Action Bar at the end of the return statement
// We look for:       </main>
//     </div>
//   );
const floatingBar = `
      {/* Floating Action Bar for Bulk Deals */}
      {selectedEquipmentIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-indigo-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-4 z-50 animate-bounce-short">
          <span className="font-bold whitespace-nowrap text-sm">{selectedEquipmentIds.length} Alat Terpilih</span>
          <button 
            onClick={handleBulkDeal}
            className="bg-white text-indigo-900 px-4 py-2 rounded-xl font-black text-xs sm:text-sm hover:scale-105 transition-transform flex items-center gap-2 whitespace-nowrap"
          >
            🚀 Deal & Buat Job 
          </button>
        </div>
      )}`;
retentionCode = retentionCode.replace('</main>', floatingBar + '\n      </main>');

fs.writeFileSync('src/components/RetentionModule.tsx', retentionCode);
console.log('RetentionModule and App refactored successfully.');
