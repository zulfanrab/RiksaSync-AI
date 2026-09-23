const fs = require('fs');

let code = fs.readFileSync('src/components/InspectionPipelineModule.tsx', 'utf8');

// 1. Add imports
code = code.replace(
  "import { Plus, Trash2, Edit2, AlertTriangle, User, ArrowRight, MessageSquare, ClipboardList, Download } from 'lucide-react';",
  "import { Plus, Trash2, Edit2, AlertTriangle, User, ArrowRight, MessageSquare, ClipboardList, Download, FileSpreadsheet, Filter, Search } from 'lucide-react';\nimport { MONTHS, filterByMonth, exportInspectionToExcel } from '../lib/exportUtils';"
);

// 2. Add search and filter state
const oldState = /const \[viewMode, setViewMode\] = useState\('kanban'\);/;
const newState = `const [viewMode, setViewMode] = useState('kanban');
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');

  const filteredJobs = React.useMemo(() => {
    return jobs.filter(job => {
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        job.client_name.toLowerCase().includes(searchLower) ||
        (job.equipment_name && job.equipment_name.toLowerCase().includes(searchLower)) ||
        (job.pic_name && job.pic_name.toLowerCase().includes(searchLower));

      const matchesMonth = filterByMonth(job.due_date, selectedMonth);
      return matchesSearch && matchesMonth;
    });
  }, [jobs, search, selectedMonth]);`;
code = code.replace(oldState, newState);

// 3. Update jobsByStage to use filteredJobs
const oldJobsByStage = /const jobsByStage = STAGES\.reduce\(\(acc, stage\) => \{[\s\S]*?\}, \{\} as Record<InspectionStage, InspectionJob\[\]>\);/;
const newJobsByStage = `const jobsByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = filteredJobs.filter(job => job.stage === stage);
    return acc;
  }, {} as Record<InspectionStage, InspectionJob[]>);`;
code = code.replace(oldJobsByStage, newJobsByStage);

// 4. Update the Toolbar
const oldToolbar = /\{\/\* Toolbar \*\/\}.*?<\/div>\s*<\/div>/s;
const newToolbar = `{/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button onClick={() => setViewMode('kanban')}
            className={\`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap \${viewMode === 'kanban' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}\`}>
            🗂️ Kanban
          </button>
          <button onClick={() => setViewMode('table')}
            className={\`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap \${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}\`}>
            📋 Tabel
          </button>
        </div>

        <div className="flex flex-1 items-center gap-2 w-full sm:max-w-md">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari PT atau Alat..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none bg-slate-50"
            />
          </div>

          {/* Month Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="pl-9 pr-8 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none bg-slate-50 appearance-none font-bold text-slate-700 cursor-pointer"
            >
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => exportInspectionToExcel(filteredJobs, manpowerList, MONTHS.find(m => m.value === selectedMonth)?.label || 'Semua')}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap">
            <FileSpreadsheet className="h-3.5 w-3.5" />Export Excel
          </button>
          <button onClick={() => { setEditingJob(null); setIsFormOpen(true); }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap">
            <Plus className="h-3.5 w-3.5" />Tambah Job
          </button>
        </div>
      </div>`;
code = code.replace(oldToolbar, newToolbar);

// Remove exportJobsCSV
code = code.replace(/const exportJobsCSV = \(\) => \{[\s\S]*?URL\.revokeObjectURL\(url\);\n  \};/, '');

// Fix TableView passing filteredJobs instead of jobs
code = code.replace(/<TableView\s*jobs=\{jobs\}\s*manpowerList=\{manpowerList\}/, '<TableView jobs={filteredJobs} manpowerList={manpowerList}');

fs.writeFileSync('src/components/InspectionPipelineModule.tsx', code);
console.log('InspectionPipelineModule updated for Excel and Monthly filter.');
