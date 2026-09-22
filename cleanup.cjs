const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Change activeTab state
code = code.replace(
  /const \[activeTab, setActiveTab\] = useState<'calendar' \| 'tasks' \| 'retention' \| 'inspection'>\('calendar'\);/g,
  "const [activeTab, setActiveTab] = useState<'retention' | 'inspection'>('retention');"
);

// Remove the Kalender button (and maybe others)
const tabButtonsRegex = /<div className="flex overflow-x-auto hide-scrollbar border-b border-slate-200 mt-2 sm:mt-4 px-2 sm:px-6 space-x-1">[\s\S]*?<\/div>/;
const newTabButtons = `<div className="flex overflow-x-auto hide-scrollbar border-b border-slate-200 mt-2 sm:mt-4 px-2 sm:px-6 space-x-1">
          <button
            onClick={() => setActiveTab('retention')}
            className={\`px-3.5 py-2 sm:px-5 sm:py-2.5 text-xs font-bold transition-all rounded-t-xl cursor-pointer border-b-2 whitespace-nowrap \${
              activeTab === 'retention'
                ? 'border-rose-500 bg-white text-rose-600 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }\`}
          >
            🔁 Retensi Klien
            {stats.criticalRetentionCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white shadow-sm">
                {stats.criticalRetentionCount > 9 ? '9+' : stats.criticalRetentionCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('inspection')}
            className={\`px-3.5 py-2 sm:px-5 sm:py-2.5 text-xs font-bold transition-all rounded-t-xl cursor-pointer border-b-2 whitespace-nowrap \${
              activeTab === 'inspection'
                ? 'border-violet-600 bg-white text-violet-700 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }\`}
          >
            ⚙️ Progress Pemeriksaan
            {stats.activeInspectionCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-violet-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white shadow-sm">
                {stats.activeInspectionCount > 9 ? '9+' : stats.activeInspectionCount}
              </span>
            )}
          </button>
        </div>`;

code = code.replace(tabButtonsRegex, newTabButtons);

const mainContentRegex = /\{activeTab === 'calendar' \? \([\s\S]*?\) : activeTab === 'tasks' \? \([\s\S]*?\) : activeTab === 'retention' \? \(/;
const newMainContent = `{activeTab === 'retention' ? (`;
code = code.replace(mainContentRegex, newMainContent);

fs.writeFileSync('src/App.tsx', code);
console.log('Tabs updated successfully.');
