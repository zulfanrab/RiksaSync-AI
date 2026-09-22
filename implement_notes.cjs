const fs = require('fs');

let code = fs.readFileSync('src/components/InspectionPipelineModule.tsx', 'utf8');

// 1. Add JobNote import
code = code.replace(
  /import \{ InspectionJob, InspectionStage, Manpower \} from '\.\.\/types';/,
  "import { InspectionJob, InspectionStage, Manpower, JobNote } from '../types';"
);

// 2. Add MessageSquare to lucide-react imports if not there
if (!code.includes('MessageSquare')) {
  code = code.replace(
    /ChevronRight, ArrowRight, Building2, Phone, AlertTriangle, Download, Handshake, Landmark/,
    "ChevronRight, ArrowRight, Building2, Phone, AlertTriangle, Download, Handshake, Landmark, MessageSquare, Send"
  );
}

// 3. Update JobFormProps
const jobFormPropsRegex = /interface JobFormProps \{[\s\S]*?function JobForm\(\{ initial, manpowerList = \[\], onClose, onSave \}: JobFormProps\) \{/;
const newJobFormProps = `interface JobFormProps {
  initial?: InspectionJob;
  manpowerList?: Manpower[];
  activeUser?: string;
  onClose: () => void;
  onSave: (job: Partial<InspectionJob>) => Promise<void>;
  onNoteToTask?: (note: JobNote) => void;
}

function JobForm({ initial, manpowerList = [], activeUser = 'Admin', onClose, onSave, onNoteToTask }: JobFormProps) {`;

code = code.replace(jobFormPropsRegex, newJobFormProps);

// 4. Update the state inside JobForm
const notesStateRegex = /const \[notes, setNotes\] = useState\(initial\?\.notes \|\| ''\);/;
const newNotesState = `const [jobNotes, setJobNotes] = useState<JobNote[]>(() => {
    try {
      if (initial?.notes && initial.notes.startsWith('[')) {
        return JSON.parse(initial.notes);
      }
    } catch(e) {}
    if (initial?.notes) {
      return [{
        id: \`note-legacy-\${Date.now()}\`,
        text: initial.notes,
        created_at: new Date().toISOString(),
        created_by: 'Sistem (Migrasi)'
      }];
    }
    return [];
  });
  const [newNoteText, setNewNoteText] = useState('');

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    const note: JobNote = {
      id: \`note-\${Date.now()}\`,
      text: newNoteText.trim(),
      created_at: new Date().toISOString(),
      created_by: activeUser
    };
    setJobNotes([...jobNotes, note]);
    setNewNoteText('');
  };`;

code = code.replace(notesStateRegex, newNotesState);

// 5. Update handleSubmit to save jobNotes
const submitNotesRegex = /notes,/;
const submitNotesNew = `notes: JSON.stringify(jobNotes),`;
code = code.replace(submitNotesRegex, submitNotesNew);

// 6. Replace the textarea with the new UI
const textareaRegex = /<textarea value=\{notes\} onChange=\{e => setNotes\(e.target.value\)\}[\s\S]*?outline-none" \/>/;
const newNotesUI = `
            {/* DISCUSSION TIMELINE */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-indigo-500" /> Diskusi & Catatan Progres
              </h3>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-3">
                {jobNotes.length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-2">Belum ada catatan.</p>
                ) : (
                  jobNotes.map(n => (
                    <div key={n.id} className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm relative group">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[9px] font-bold text-slate-700">{n.created_by}</span>
                        <span className="text-[8px] text-slate-400">{new Date(n.created_at).toLocaleString('id-ID')}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">{n.text}</p>
                      
                      {n.linked_task_id ? (
                        <div className="mt-2 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-flex items-center gap-1 border border-emerald-100">
                          <CheckCircle2 className="h-3 w-3" /> Telah ditugaskan
                        </div>
                      ) : (
                        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => onNoteToTask && onNoteToTask(n)}
                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors inline-flex items-center gap-1 border border-indigo-100 cursor-pointer">
                            <Plus className="h-3 w-3" /> Jadikan Tugas
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input value={newNoteText} onChange={e => setNewNoteText(e.target.value)}
                  onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleAddNote(); } }}
                  placeholder="Ketik catatan baru..."
                  className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-300 outline-none" />
                <button type="button" onClick={handleAddNote} disabled={!newNoteText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>`;
code = code.replace(textareaRegex, newNotesUI);


// 7. Add handleNoteToTask in InspectionPipelineModule
// It needs to be inside InspectionPipelineModule component
const moduleEndRegex = /const handleSave = async \(jobData: Partial<InspectionJob>\) => \{/;
const handleNoteToTask = `
  const handleNoteToTask = async (note: JobNote) => {
    if (!editingJob) return;
    if (!isSupabaseConfigured || !supabase) {
      alert('Supabase tidak terkonfigurasi. Tidak dapat membuat tugas.');
      return;
    }

    try {
      // 1. Create a task in tasks table
      const taskData = {
        title: \`Tindak Lanjut: \${editingJob.client_name} - \${editingJob.equipment_name}\`,
        description: \`Berdasarkan catatan diskusi pada tahap "\${editingJob.stage}":\\n\\n"\${note.text}"\\n\\nMohon segera ditindaklanjuti.\`,
        assignee_id: editingJob.assigned_lead || manpowerList[0]?.id || '',
        assignee_ids: editingJob.assigned_lead ? [editingJob.assigned_lead] : (manpowerList[0] ? [manpowerList[0].id] : []),
        due_date: new Date().toISOString().split('T')[0],
        priority: 'P2',
        status: 'To Do',
        category: 'Follow Up',
        recurrence: 'None',
        visibility: 'Public',
        created_by: activeUser
      };

      const { data: newTask, error: taskError } = await supabase.from('tasks').insert([taskData]).select('id').single();
      if (taskError) throw new Error(taskError.message);

      // 2. Update the note in the current job
      let currentNotes = [];
      try {
        if (editingJob.notes && editingJob.notes.startsWith('[')) {
          currentNotes = JSON.parse(editingJob.notes);
        }
      } catch(e) {}
      
      const updatedNotes = currentNotes.map((n: JobNote) => 
        n.id === note.id ? { ...n, linked_task_id: newTask.id } : n
      );

      // 3. Update the job's notes in DB
      const { error: jobError } = await supabase.from('inspection_jobs')
        .update({ notes: JSON.stringify(updatedNotes) })
        .eq('id', editingJob.id);

      if (jobError) throw new Error(jobError.message);

      // 4. Close form and refresh to reflect changes
      setIsFormOpen(false);
      setEditingJob(null);
      await onRefresh();
      alert('Tugas berhasil dibuat dan ditautkan!');
      
    } catch (err: any) {
      alert('Gagal membuat tugas: ' + err.message);
    }
  };

  const handleSave = async (jobData: Partial<InspectionJob>) => {`;
code = code.replace(moduleEndRegex, handleNoteToTask);

// 8. Update <JobForm> call inside InspectionPipelineModule
const jobFormCallRegex = /<JobForm\s+initial=\{editingJob \|\| undefined\}\s+manpowerList=\{manpowerList\}\s+onClose=\{\(\) => \{ setIsFormOpen\(false\); setEditingJob\(null\); \}\}\s+onSave=\{handleSave\}\s+\/>/;
const newJobFormCall = `<JobForm
            initial={editingJob || undefined}
            manpowerList={manpowerList}
            activeUser={activeUser}
            onClose={() => { setIsFormOpen(false); setEditingJob(null); }}
            onSave={handleSave}
            onNoteToTask={handleNoteToTask}
          />`;
code = code.replace(jobFormCallRegex, newJobFormCall);

fs.writeFileSync('src/components/InspectionPipelineModule.tsx', code);
console.log('InspectionPipelineModule updated!');
