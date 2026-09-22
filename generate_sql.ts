import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const csvPath = 'C:\\Users\\colorful\\.gemini\\antigravity-ide\\brain\\0b013053-fb73-4149-a8b0-2c0172b21025\\scratch\\master_data_2025.csv';
const sqlPath = path.join(process.cwd(), 'import_master_2025.sql');

function generateSQL() {
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  // Parse CSV
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  let sql = `-- ==========================================\n`;
  sql += `-- SQL SCRIPT UNTUK IMPORT DATA MASTER 2025\n`;
  sql += `-- ==========================================\n\n`;

  // 1. Generate INSERT for clients
  sql += `-- 1. INSERT DATA KLIEN\n`;
  sql += `INSERT INTO clients (client_name, pic_name, pic_phone, notes, drive_folder_url)\nVALUES \n`;
  
  const clientRows = records.map((r: any) => {
    let clientName = r['Nama Perusahaan'].replace(/'/g, "''");
    let pic = (r['PIC'] || '-').replace(/'/g, "''");
    let phone = (r['Nomor WhatsApp'] || '-').replace(/'/g, "''");
    let notes = (r['Lokasi'] || '-').replace(/'/g, "''");
    let link = (r['Link Penawaran (Drive)'] || '-').replace(/'/g, "''");
    
    return `('${clientName}', '${pic}', '${phone}', '${notes}', '${link}')`;
  });
  
  sql += clientRows.join(',\n');
  sql += `\nON CONFLICT (client_name) DO NOTHING;\n\n`; // Prevent duplicates

  // 2. Generate INSERT for equipments
  sql += `-- 2. INSERT DATA ALAT (Dikaitkan dengan Klien)\n`;
  sql += `INSERT INTO client_equipments (client_id, equipment_name, equipment_type, last_inspection_date, due_date)\nVALUES \n`;
  
  const equipmentRows: string[] = [];
  
  records.forEach((r: any) => {
    let clientName = r['Nama Perusahaan'].replace(/'/g, "''");
    let alatRaw = r['Rangkuman Alat 2025'] || '';
    let tglRiksa = r['Tgl Riksa Terakhir (2025)'] || '';
    
    if (!tglRiksa || tglRiksa === '-' || alatRaw === '-') return;
    
    // Calculate Due Date (Exactly 1 year after last_inspection_date)
    let dueDate = '';
    try {
      const d = new Date(tglRiksa);
      if (!isNaN(d.getTime())) {
        d.setFullYear(d.getFullYear() + 1);
        dueDate = d.toISOString().split('T')[0];
      } else {
        dueDate = tglRiksa; // Fallback
      }
    } catch {
      dueDate = tglRiksa; // Fallback
    }

    // Parse equipments: "Elevator (13), Listrik (2)" -> ["Elevator (13 Unit)", "Listrik (2 Unit)"]
    const alatList = alatRaw.split(',').map((s: string) => s.trim()).filter((s: string) => s);
    
    alatList.forEach((alat: string) => {
      // Add "Unit" if it has number in bracket
      let cleanAlat = alat.replace(/'/g, "''");
      if (cleanAlat.match(/\(\d+\)/)) {
        cleanAlat = cleanAlat.replace(/\)/, ' Unit)');
      }
      
      equipmentRows.push(`((SELECT id FROM clients WHERE client_name = '${clientName}'), '${cleanAlat}', 'Lainnya', '${tglRiksa}', '${dueDate}')`);
    });
  });

  sql += equipmentRows.join(',\n');
  sql += `;\n`;

  fs.writeFileSync(sqlPath, sql, 'utf-8');
  console.log(`Berhasil membuat file SQL di ${sqlPath}`);
}

generateSQL();
