const fs = require('fs');

let code = fs.readFileSync('src/components/RetentionModule.tsx', 'utf8');

// 1. Add imports
code = code.replace(
  "import { Search, Download, Upload, Trash2, Edit2, Wrench, Calendar, Phone, AlertTriangle, ArrowRight, MessageSquare, Plus, Bell, Clock, TrendingUp, TrendingDown, RefreshCcw } from 'lucide-react';",
  "import { Search, Download, Upload, Trash2, Edit2, Wrench, Calendar, Phone, AlertTriangle, ArrowRight, MessageSquare, Plus, Bell, Clock, TrendingUp, TrendingDown, RefreshCcw, FileSpreadsheet, Filter } from 'lucide-react';\nimport { MONTHS, filterByMonth, exportRetentionToExcel } from '../lib/exportUtils';"
);

// 2. Add state
const stateInject = `  const [selectedMonth, setSelectedMonth] = React.useState('all');`;
code = code.replace(
  "const [search, setSearch] = useState('');",
  "const [search, setSearch] = useState('');\n" + stateInject
);

// 3. Update filteredClients logic
const oldFilterClients = /const filteredClients = clients\.filter\(c => \{[\s\S]*?return matchesSearch;\n    if \(activeFilter === 'overdue'\) return clientEqs\.some\(eq => \{\n/;
const newFilterClients = `const filteredClients = clients.filter(c => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      c.client_name.toLowerCase().includes(searchLower) ||
      c.pic_name.toLowerCase().includes(searchLower) ||
      c.pic_phone.includes(searchLower);

    const clientEqs = equipments.filter(e => e.client_id === c.id);
    const hasEqInMonth = selectedMonth === 'all' || clientEqs.some(eq => filterByMonth(eq.due_date, selectedMonth));
    if (!hasEqInMonth) return false;

    if (activeFilter === 'all') return matchesSearch;
    if (activeFilter === 'overdue') return clientEqs.some(eq => {
`;
code = code.replace(oldFilterClients, newFilterClients);

// 4. Update the ClientCard clientEqs mapping so it only shows equipments in that month
const oldClientEqsMap = /const clientEqs = equipments\.filter\(e => e\.client_id === client\.id\);/g;
code = code.replace(oldClientEqsMap, "const clientEqs = equipments.filter(e => e.client_id === client.id && filterByMonth(e.due_date, selectedMonth));");

// 5. Inject the Month Dropdown and Export Excel Button
const oldToolbar = /<div className="relative flex-1 min-w-0 max-w-sm">\s*<Search/;
const newToolbar = `<div className="relative flex-1 min-w-0 max-w-sm">
            <Search`;
code = code.replace(oldToolbar, newToolbar);

const oldSearchBlock = /<input\s*type="text"\s*value=\{search\}\s*onChange=\{e => setSearch\(e\.target\.value\)\}\s*placeholder="Cari nama PT, PIC, atau nomor WA..."\s*className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-300 outline-none bg-slate-50"\s*\/>\s*<\/div>/;

const newSearchBlock = `<input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama PT, PIC..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-300 outline-none bg-slate-50"
            />
          </div>

          {/* Month Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-300 outline-none bg-slate-50 appearance-none font-bold text-slate-700 cursor-pointer"
            >
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>`;

code = code.replace(oldSearchBlock, newSearchBlock);

// 6. Replace Export CSV with Export Excel
const oldExportBtn = /<button onClick=\{\(\) => exportToCSV.*?<\/button>/s;
const newExportBtn = `<button onClick={() => {
              const eqFiltered = equipments.filter(e => filteredClients.some(c => c.id === e.client_id) && filterByMonth(e.due_date, selectedMonth));
              exportRetentionToExcel(filteredClients, eqFiltered, logs, MONTHS.find(m => m.value === selectedMonth)?.label || 'Semua');
            }}
              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer shadow-sm">
              <FileSpreadsheet className="h-3.5 w-3.5" />Export Excel
            </button>`;
code = code.replace(oldExportBtn, newExportBtn);

// Remove the old exportToCSV function to avoid errors/warnings
const exportCsvFunc = /const exportToCSV = \([\s\S]*?URL\.revokeObjectURL\(url\);\n  };/;
code = code.replace(exportCsvFunc, '');

fs.writeFileSync('src/components/RetentionModule.tsx', code);
console.log('RetentionModule updated for Excel and Monthly filter.');
