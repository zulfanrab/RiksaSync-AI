const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');
const missing = fs.readFileSync('missingRouting.txt', 'utf8');

// 1. Fix activeTab type
code = code.replace(
  /const \[activeTab, setActiveTab\] = useState<'retention' \| 'inspection'>\('retention'\);/,
  "const [activeTab, setActiveTab] = useState<'calendar' | 'tasks' | 'retention' | 'inspection'>('calendar');"
);

// 2. Inject missing routing
const searchReplace = "{activeTab === 'retention' ? (";
code = code.replace(searchReplace, missing + "\n        ) : activeTab === 'retention' ? (");

// 3. Ensure utf-16 characters like ΓùÅ are correctly converted back. 
// "ΓùÅ" is a misdecoded bullet point character '●'.
code = code.replace(/ΓùÅ/g, '●');

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx routing restored!');
