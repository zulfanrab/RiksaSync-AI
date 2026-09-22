const fs = require('fs');

let code = fs.readFileSync('src/components/InspectionPipelineModule.tsx', 'utf8');

// 1. Ensure ChevronDown is imported
if (!code.includes('ChevronDown')) {
  code = code.replace(/import \{ (.*?) \} from 'lucide-react';/, "import { $1, ChevronDown } from 'lucide-react';");
}

// 2. Refactor KanbanColumn
const kanbanTarget = /function KanbanColumn\(\{\s*stage,\s*jobs,\s*manpowerList,\s*onEdit,\s*onDelete,\s*onMoveStage\s*\}\s*:\s*KanbanColumnProps\) \{[\s\S]*?(?=function TableView)/;

const kanbanReplacement = `
function ClientAccordion({ clientName, groupJobs, manpowerList, onEdit, onDelete, onMoveStage, nextStage }: any) {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-2.5">
      <div 
        className="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div>
          <p className="text-xs font-black text-slate-800 leading-tight">{clientName}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{groupJobs.length} Unit Alat</p>
        </div>
        <ChevronDown className={\`h-4 w-4 text-slate-400 transition-transform \${isOpen ? 'rotate-180' : ''}\`} />
      </div>
      
      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-2 space-y-2">
          {groupJobs.map((job: any) => {
            const lead = manpowerList.find((m: any) => m.id === job.assigned_lead);
            const notesArray = (job.notes && job.notes.startsWith('[')) ? JSON.parse(job.notes) : [];
            const isAssigned = !!job.assigned_lead;
            return (
              <div key={job.id} className="bg-white rounded-lg p-2.5 border border-slate-200 shadow-xs relative group hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="flex-1 pr-6">
                    <p className="text-[11px] font-bold text-slate-700 leading-tight">{job.equipment_name}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5 truncate">{job.equipment_type}</p>
                  </div>
                  <div className="absolute top-2 right-2 flex -mr-1 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-100 p-0.5 z-10">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(job); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(job.id); }} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                
                <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    {lead ? (
                      <div className="flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded text-[9px] font-bold text-indigo-700" title={lead.name}>
                        <User className="h-3 w-3" />
                        <span className="truncate max-w-[60px]">{lead.name.split(' ')[0]}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-500">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        <span>Unassigned</span>
                      </div>
                    )}
                    {notesArray.length > 0 && (
                      <div className="flex items-center gap-1 bg-sky-50 px-1.5 py-0.5 rounded text-[9px] font-bold text-sky-700">
                        <MessageSquare className="h-3 w-3" />
                        <span>{notesArray.length}</span>
                      </div>
                    )}
                  </div>
                </div>

                {nextStage && (
                  <button 
                    onClick={() => onMoveStage(job.id, nextStage)}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg text-[9px] font-black text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    <span>Pindah ke {nextStage}</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ stage, jobs, manpowerList, onEdit, onDelete, onMoveStage }: KanbanColumnProps) {
  const cfg = STAGE_CONFIG[stage];
  const Icon = cfg.icon;
  const stageIdx = STAGES.indexOf(stage);
  const nextStage = stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1] : null;

  const groupedJobs = jobs.reduce((acc, job) => {
    if (!acc[job.client_name]) acc[job.client_name] = [];
    acc[job.client_name].push(job);
    return acc;
  }, {} as Record<string, InspectionJob[]>);

  return (
    <div className={\`rounded-2xl border \${cfg.border} \${cfg.bg} flex flex-col min-h-[200px]\`} style={{ minWidth: '260px' }}>
      <div className={\`flex items-center gap-2 px-4 py-3 border-b \${cfg.border}\`}>
        <Icon className={\`h-4 w-4 \${cfg.color}\`} />
        <span className={\`text-xs font-black \${cfg.color}\`}>{stage}</span>
        <span className={\`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full \${cfg.bg} \${cfg.color} border \${cfg.border}\`}>{jobs.length}</span>
      </div>

      <div className="flex-1 p-3 overflow-y-auto" style={{ maxHeight: '500px' }}>
        {jobs.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[10px] text-slate-400">Tidak ada job</p>
          </div>
        )}
        {Object.entries(groupedJobs).map(([clientName, groupJobs]) => (
          <ClientAccordion 
            key={clientName} 
            clientName={clientName} 
            groupJobs={groupJobs} 
            manpowerList={manpowerList}
            onEdit={onEdit}
            onDelete={onDelete}
            onMoveStage={onMoveStage}
            nextStage={nextStage}
          />
        ))}
      </div>
    </div>
  );
}
`;

code = code.replace(kanbanTarget, kanbanReplacement);

// 3. Refactor TableView
const tableTarget = /function TableView\(\{\s*jobs,\s*manpowerList,\s*onEdit,\s*onDelete\s*\}\s*:\s*TableViewProps\) \{[\s\S]*?(?=export default function InspectionPipelineModule)/;

const tableReplacement = `
function TableView({ jobs, manpowerList, onEdit, onDelete }: TableViewProps) {
  const groupedJobs = jobs.reduce((acc, job) => {
    if (!acc[job.client_name]) acc[job.client_name] = [];
    acc[job.client_name].push(job);
    return acc;
  }, {} as Record<string, InspectionJob[]>);

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
        <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-base font-black text-slate-800">Tidak ada data</h3>
        <p className="text-sm text-slate-500 mt-1">Belum ada job pemeriksaan untuk ditampilkan.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Klien & Alat</th>
              <th className="px-5 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Stage & Tanggal</th>
              <th className="px-5 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Lead Inspector</th>
              <th className="px-5 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Object.entries(groupedJobs).map(([clientName, groupJobs]) => (
              <React.Fragment key={clientName}>
                {/* Client Group Header */}
                <tr className="bg-slate-50/50">
                  <td colSpan={4} className="px-5 py-2.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-indigo-900 uppercase tracking-wide">{clientName}</span>
                      <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{groupJobs.length} Alat</span>
                    </div>
                  </td>
                </tr>
                
                {/* Equipment Rows */}
                {groupJobs.map((job) => {
                  const lead = manpowerList.find((m) => m.id === job.assigned_lead);
                  const stageCfg = STAGE_CONFIG[job.stage] || STAGE_CONFIG['Penawaran'];
                  
                  return (
                    <tr key={job.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-5 py-3 pl-8">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{job.equipment_name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{job.equipment_type}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1.5">
                          <span className={\`inline-flex w-fit items-center px-2 py-0.5 rounded text-[10px] font-black \${stageCfg.bg} \${stageCfg.color} border \${stageCfg.border}\`}>
                            {job.stage}
                          </span>
                          {job.due_date && (
                            <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                              Target: {new Date(job.due_date).toLocaleDateString('id-ID')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {lead ? (
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                              {lead.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-700">{lead.name}</p>
                              <p className="text-[9px] text-slate-500">Internal</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">Belum di-assign</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onEdit(job)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => onDelete(job.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`;

code = code.replace(tableTarget, tableReplacement);

fs.writeFileSync('src/components/InspectionPipelineModule.tsx', code);
console.log('InspectionPipelineModule refactored successfully.');
