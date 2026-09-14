const db = require('./db');
const migrate = require('./migrate');
const bcrypt = require('bcryptjs');
migrate();
db.pragma('foreign_keys = OFF');

// Reset existing data (keep schema)
const tables = ['ledger_entries','users','classes','students','fees','payments','expenses','suppliers','purchases','employees','payroll','inventory_items','stock_movements','assets','chart_of_accounts','attendance','grades'];
db.exec(`DELETE FROM ledger_entries; DELETE FROM sqlite_sequence;`);
tables.forEach(t => { try { db.exec(`DELETE FROM ${t}`); } catch (e) {} });
db.exec(`DELETE FROM sqlite_sequence WHERE 1`);

// Helper
function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

console.log('🌱 Seeding database...');

// ── Users ──────────────────────────────────────
const insUser = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
insUser.run('Administrator', 'admin@school.com', bcrypt.hashSync('admin123', 10), 'admin');
insUser.run('Bursar Moyo', 'bursar@school.com', bcrypt.hashSync('bursar123', 10), 'bursar');
insUser.run('Mr. Tembo', 'teacher@school.com', bcrypt.hashSync('teacher123', 10), 'teacher');
insUser.run('Dr. Mwangi', 'headmaster@school.com', bcrypt.hashSync('headmaster123', 10), 'headmaster');
console.log('  ✓ 4 users');

// ── Classes ────────────────────────────────────
const insClass = db.prepare('INSERT INTO classes (name, stream, capacity, year_level, school_fees, development_levy) VALUES (?, ?, ?, ?, ?, ?)');
const classes = [
  ['Form 1', 'A', 40, 1, 350, 100], ['Form 1', 'B', 40, 1, 350, 100],
  ['Form 2', 'A', 38, 2, 380, 100], ['Form 2', 'B', 38, 2, 380, 100],
  ['Form 3', 'A', 35, 3, 420, 120], ['Form 3', 'B', 35, 3, 420, 120],
  ['Form 4', 'A', 32, 4, 450, 120], ['Form 4', 'B', 32, 4, 450, 120],
];
classes.forEach(c => insClass.run(...c));
console.log('  ✓ 8 classes');

// ── Students ───────────────────────────────────
const firstNames = ['Tinashe', 'Nyasha', 'Blessing', 'Tafadzwa', 'Rudo', 'Kudzai', 'Munyaradzi', 'Chipo', 'Farai', 'Tendai',
  'Sharon', 'Tatenda', 'Ropafadzo', 'Anesu', 'Takudzwa', 'Mudariro', 'Chiedza', 'Tinashe', 'Blessing', 'Nyasha',
  'Farai', 'Tendai', 'Chipo', 'Rudo', 'Kudzai', 'Tafadzwa', 'Munyaradzi', 'Tatenda', 'Ropafadzo', 'Sharon'];
const lastNames = ['Moyo', 'Dube', 'Ndlovu', 'Moyo', 'Chikanda', 'Mabhena', 'Nkomo', 'Sibanda', 'Mpofu', 'Tshuma',
  'Mhlanga', 'Moyo', 'Ncube', 'Sibanda', 'Dlamini', 'Nkomo', 'Moyo', 'Mpofu', 'Tshuma', 'Dube',
  'Chikanda', 'Mabhena', 'Nkomo', 'Sibanda', 'Mpofu', 'Ncube', 'Tshuma', 'Mhlanga', 'Moyo', 'Dube'];
const genders = ['Male', 'Female'];
const streets = ['Samora Machel Ave', 'Robert Mugabe Rd', 'Jason Moyo St', 'Nelson Mandela Ave', 'Julius Nyerere Way',
  'Kennedy Drive', 'Cecil Rd', 'Enterprise St', 'King George Rd', 'Borrowdale St'];

const insStudent = db.prepare(`INSERT INTO students (student_id, first_name, last_name, gender, date_of_birth, class_id, guardian_name, guardian_contact, address, date_enrolled, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const students = [];

db.transaction(() => {
  for (let i = 0; i < 30; i++) {
    const classId = (i % 8) + 1;
    const studentId = 'STU' + String(i + 1).padStart(3, '0');
    const r = insStudent.run(
      studentId, firstNames[i], lastNames[i], genders[i % 2],
      `199${5 + (i % 10)}-0${(i % 12) + 1}-${(i % 28) + 1}`,
      classId,
      `Mr/Mrs ${lastNames[i]}`,
      `+263 77 ${String(1000000 + i).slice(0, 3)} ${String(1000 + i)}`,
      `${100 + i} ${streets[i % 10]}, Harare`,
      `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
      i === 29 ? 'inactive' : 'active'
    );
    students.push({ id: r.lastInsertRowid, classId });
  }
})();
console.log('  ✓ 30 students');

// ── Fees ───────────────────────────────────────
const insFee = db.prepare('INSERT INTO fees (student_id, term, fee_type, amount, due_date, status) VALUES (?, ?, ?, ?, ?, ?)');
const terms = ['Term 1 2025', 'Term 2 2025', 'Term 3 2025'];
const feeAmounts = { 'Form 1': [350, 400, 380], 'Form 2': [380, 420, 400], 'Form 3': [420, 450, 430], 'Form 4': [450, 480, 460] };

db.transaction(() => {
  for (const s of students) {
    if (s.id > 30) continue;
    const className = classes[s.classId - 1][0];
    for (let t = 0; t < 3; t++) {
      insFee.run(s.id, terms[t], 'School Fees', feeAmounts[className][t], '2025-03-31', 'unpaid');
      insFee.run(s.id, terms[t], 'Development Levy', [100, 120, 110][t], '2025-03-31', 'unpaid');
    }
  }
})();
console.log('  ✓ 180 fee records');

// ── Payments ───────────────────────────────────
const insPay = db.prepare('INSERT INTO payments (student_id, receipt_number, amount, date, method, term, description) VALUES (?, ?, ?, ?, ?, ?, ?)');
let rcptNum = 0;

db.transaction(() => {
  for (const s of students) {
    if (s.id > 30) continue;
    const className = classes[s.classId - 1][0];
    // Randomly pay 1-3 terms
    const paidCount = 1 + (s.id % 3);
    for (let t = 0; t < paidCount; t++) {
      const termIdx = (s.id + t) % 3;
      const totalFees = feeAmounts[className][termIdx] + [100, 120, 110][termIdx];
      // Partial or full payment
      const paid = t === paidCount - 1 ? Math.round(totalFees * (0.4 + (s.id % 5) * 0.15)) : totalFees;
      rcptNum++;
      const method = ['Cash', 'EcoCash', 'Bank Transfer'][s.id % 3];
      insPay.run(
        s.id, 'RCP' + String(rcptNum).padStart(4, '0'), paid,
        daysAgo(90 - s.id * 2 - t * 10), method, terms[termIdx],
        `Fee payment for ${terms[termIdx]}`
      );
    }
  }
})();
console.log(`  ✓ ${rcptNum} payment records`);

// ── Suppliers ──────────────────────────────────
const insSup = db.prepare("INSERT INTO suppliers (name, contact_person, phone, email, address, terms, status) VALUES (?, ?, ?, ?, ?, ?, 'active')");
const suppliers = [
  ['Zimbabwe Publishing House', 'Mr. Chatikobo', '+263 4 771 234', 'orders@zph.co.zw', '14 Selous Ave, Harare', 'Net 30'],
  ['Acme Stationers', 'Ms. Sithole', '+263 292 63455', 'info@acme.co.zw', '123 Main St, Bulawayo', 'Net 45'],
  ['TechZim Computers', 'Mr. Nhamo', '+263 772 123 456', 'sales@techzim.co.zw', 'Eastlea, Harare', 'Net 30'],
  ['SafeGuard Security', 'Mr. Makunike', '+263 773 456 789', 'ops@safeguard.co.zw', 'Avondale, Harare', 'Net 30'],
  ['Green Clean Services', 'Ms. Mutizwa', '+263 784 567 890', 'hello@greenclean.co.zw', 'Msasa, Harare', 'Net 15'],
];
suppliers.forEach(s => insSup.run(...s));
console.log('  ✓ 5 suppliers');

// ── Purchases ──────────────────────────────────
const insPur = db.prepare('INSERT INTO purchases (supplier_id, item_description, amount, date, invoice_number, payment_status) VALUES (?, ?, ?, ?, ?, ?)');
const purchaseItems = [
  [1, 'Mathematics Textbooks (100)', 1500, daysAgo(60), 'INV-001', 'paid'],
  [1, 'English Textbooks (100)', 1200, daysAgo(55), 'INV-002', 'paid'],
  [2, 'Exercise Books (500)', 400, daysAgo(45), 'INV-003', 'paid'],
  [2, 'Pens & Pencils (200)', 200, daysAgo(40), 'INV-004', 'unpaid'],
  [3, 'Desktop Computers (5)', 2500, daysAgo(35), 'INV-005', 'unpaid'],
  [3, 'Printer Paper (20 reams)', 150, daysAgo(30), 'INV-006', 'paid'],
  [4, 'Monthly Security Services', 900, daysAgo(25), 'INV-007', 'paid'],
  [5, 'Monthly Cleaning Services', 600, daysAgo(20), 'INV-008', 'unpaid'],
  [1, 'Science Lab Equipment', 800, daysAgo(15), 'INV-009', 'paid'],
  [2, 'Stationery Bulk Order', 350, daysAgo(10), 'INV-010', 'unpaid'],
];
purchaseItems.forEach(p => insPur.run(...p));
console.log('  ✓ 10 purchases');

// ── Expenses ──────────────────────────────────
const insExp = db.prepare("INSERT INTO expenses (category, amount, date, description, receipt_number) VALUES (?, ?, ?, ?, ?)");
const expenses = [
  ['utilities', 850, daysAgo(60), 'Electricity bill for August', 'UTL-001'],
  ['utilities', 920, daysAgo(30), 'Water and electricity for September', 'UTL-002'],
  ['stationery', 350, daysAgo(50), 'Office stationery restock', 'STN-001'],
  ['repairs', 1200, daysAgo(90), 'Classroom roof repairs', 'RPR-001'],
  ['transport', 700, daysAgo(75), 'School bus fuel', 'TRN-001'],
  ['transport', 650, daysAgo(45), 'Bus maintenance and fuel', 'TRN-002'],
  ['security', 900, daysAgo(40), 'Security guard services (monthly)', 'SEC-001'],
  ['security', 900, daysAgo(10), 'Security guard services (monthly)', 'SEC-002'],
  ['cleaning', 500, daysAgo(35), 'Cleaning supplies and services', 'CLN-001'],
  ['teaching_materials', 1500, daysAgo(55), 'Science lab consumables', 'TCH-001'],
  ['teaching_materials', 800, daysAgo(20), 'Sports equipment', 'TCH-002'],
  ['salaries', 2800, daysAgo(30), 'Part-time teacher stipend', 'SAL-001'],
];
expenses.forEach(e => insExp.run(...e));
console.log('  ✓ 12 expenses');

// ── Employees ──────────────────────────────────
const insEmp = db.prepare("INSERT INTO employees (employee_id, first_name, last_name, role, basic_salary, allowances, deductions, hire_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')");
const employees = [
  ['EMP001', 'James', 'Mwangi', 'Headmaster', 4500, 500, 200, '2015-01-15'],
  ['EMP002', 'Grace', 'Moyo', 'Bursar', 3200, 300, 150, '2018-03-01'],
  ['EMP003', 'Peter', 'Ndlovu', 'Teacher', 2800, 200, 100, '2019-08-20'],
  ['EMP004', 'Alice', 'Sibanda', 'Teacher', 2800, 200, 100, '2020-01-10'],
  ['EMP005', 'John', 'Mabhena', 'Teacher', 2800, 200, 100, '2020-06-15'],
  ['EMP006', 'Mary', 'Chikanda', 'Teacher', 2800, 200, 100, '2021-01-05'],
  ['EMP007', 'David', 'Ncube', 'Caretaker', 1800, 100, 50, '2019-09-01'],
  ['EMP008', 'Ruth', 'Dube', 'Secretary', 2200, 150, 80, '2018-07-01'],
];
employees.forEach(e => insEmp.run(...e));
console.log('  ✓ 8 employees');

// ── Payroll ────────────────────────────────────
const insPayroll = db.prepare('INSERT INTO payroll (employee_id, period_start, period_end, pay_date, basic_salary, allowances, deductions) VALUES (?, ?, ?, ?, ?, ?, ?)');
db.transaction(() => {
  for (const e of employees) {
    insPayroll.run(e[0], '2025-08-01', '2025-08-31', '2025-08-31', e[4], e[5], e[6]);
    insPayroll.run(e[0], '2025-09-01', '2025-09-30', '2025-09-30', e[4], e[5], e[6]);
  }
})();
console.log('  ✓ 16 payroll records (2 months × 8 employees)');

// ── Inventory Items ────────────────────────────
const insInv = db.prepare("INSERT INTO inventory_items (name, description, quantity_on_hand, reorder_level, unit_cost, supplier_id, last_stock_take, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
const items = [
  ['Mathematics Textbook', 'Form 1-4', 180, 50, 15, 1, 'good'],
  ['Exercise Books', 'A4 ruled', 800, 200, 2, 2, 'good'],
  ['Ballpoint Pens', 'Blue/Black', 300, 100, 1, 2, 'good'],
  ['A4 Paper', '80gsm ream', 25, 30, 8, 2, 'low'],
  ['Chalk', 'White box of 12', 40, 20, 3, 2, 'good'],
  ['Projector Bulb', 'Standard', 3, 5, 45, 3, 'low'],
  ['Science Lab Kit', 'Basic kit', 12, 8, 25, 3, 'good'],
];
items.forEach(i => insInv.run(i[0], i[1], i[2], i[3], i[4], i[5], today(), i[6]));
console.log('  ✓ 7 inventory items');

// ── Stock Movements ────────────────────────────
const insMov = db.prepare("INSERT INTO stock_movements (item_id, type, quantity, date, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)");
const movements = [
  [1, 'receive', 200, daysAgo(60), 'purchase', 1, 'Initial stock receipt'],
  [1, 'issue', 20, daysAgo(45), 'class', null, 'Form 1A distribution'],
  [2, 'receive', 500, daysAgo(45), 'purchase', 3, 'Bulk order receipt'],
  [3, 'receive', 200, daysAgo(40), 'purchase', 4, 'Stationery order'],
  [4, 'receive', 30, daysAgo(30), 'purchase', 6, 'Paper order'],
  [4, 'issue', 5, daysAgo(10), 'office', null, 'Office use'],
];
movements.forEach(m => insMov.run(...m));
console.log('  ✓ 6 stock movements');

// ── Assets ─────────────────────────────────────
const insAsset = db.prepare("INSERT INTO assets (name, category, value, acquisition_date, depreciation_rate, status) VALUES (?, ?, ?, ?, ?, 'active')");
const assets = [
  ['School Bus', 'Transport', 85000, '2020-01-15', 0.20],
  ['Computer Lab (30 PCs)', 'IT', 45000, '2021-06-01', 0.25],
  ['Library Collection', 'Education', 20000, '2019-03-01', 0.10],
  ['Playground Equipment', 'Sports', 8000, '2022-01-10', 0.15],
  ['Sound System', 'Equipment', 3500, '2023-05-01', 0.20],
  ['Kitchen Equipment', 'Catering', 5000, '2021-09-01', 0.15],
];
assets.forEach(a => insAsset.run(...a));
console.log('  ✓ 6 assets');

// ── Attendance ──────────────────────────────────
const insAtt = db.prepare('INSERT INTO attendance (class_id, student_id, date, status, remarks) VALUES (?, ?, ?, ?, ?)');
const attDays = [1, 2, 3, 4, 5];
db.transaction(() => {
  for (const s of students) {
    for (const n of attDays) {
      const status = s.id % 9 === 0 ? 'absent' : (s.id % 4 === 0 ? 'late' : 'present');
      const remarks = status === 'absent' ? 'No reason given' : status === 'late' ? 'Arrived after 08:00' : null;
      insAtt.run(s.classId, s.id, daysAgo(n), status, remarks);
    }
  }
})();
console.log('  ✓ 150 attendance records (5 days × 30 students)');

// ── Grades ──────────────────────────────────────
const insGrade = db.prepare("INSERT INTO grades (class_id, student_id, subject, term, score, grade, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)");
const subjects = ['Mathematics', 'English', 'Science', 'History'];
const gradeTerms = ['Term 1 2025', 'Term 2 2025'];
db.transaction(() => {
  for (const s of students) {
    for (const subjIdx of [0, 1, 2, 3]) {
      for (const termIdx of [0, 1]) {
        const score = ((s.id * 7) + (subjIdx * 13) + (termIdx * 5)) % 46 + 35;
        const grade = score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 50 ? 'C' : score >= 40 ? 'D' : 'F';
        insGrade.run(s.classId, s.id, subjects[subjIdx], gradeTerms[termIdx], score, grade, null);
      }
    }
  }
})();
console.log('  ✓ 240 grade records (4 subjects × 2 terms × 30 students)');

// ── Ledger Entries ─────────────────────────────
// Post fee income entries
const insLedger = db.prepare("INSERT INTO ledger_entries (account_code, description, debit, credit, date, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
let entryCount = 0;

db.transaction(() => {
  // Opening balances: capital introduced + government grant
  insLedger.run('1000', 'Opening bank balance / capital introduced', 250000, 0, daysAgo(180), 'opening', null);
  insLedger.run('5000', 'Capital introduced (opening balance)', 0, 250000, daysAgo(180), 'opening', null);
  entryCount += 2;
  insLedger.run('1000', 'Government grant received', 20000, 0, daysAgo(170), 'grant', null);
  insLedger.run('3100', 'Government grant income', 0, 20000, daysAgo(170), 'grant', null);
  entryCount += 2;

  // Post fees charged (Dr Receivable / Cr Income)
  const allFees = db.prepare('SELECT student_id, term, amount FROM fees').all();
  for (const f of allFees) {
    const date = '2025-01-15';
    insLedger.run('1100', `Fees charged: ${f.term} (student #${f.student_id})`, f.amount, 0, date, 'fees', null);
    insLedger.run('3000', `Fees income: ${f.term} (student #${f.student_id})`, 0, f.amount, date, 'fees', null);
    entryCount += 2;
  }

  // Post payments received (Dr Cash / Cr Receivable)
  const allPayments = db.prepare('SELECT id, student_id, amount, date, term FROM payments').all();
  for (const p of allPayments) {
    insLedger.run('1000', `Cash received: ${p.term} (student #${p.student_id})`, p.amount, 0, p.date, 'payments', p.id);
    insLedger.run('1100', `Receivable settled: ${p.term} (student #${p.student_id})`, 0, p.amount, p.date, 'payments', p.id);
    entryCount += 2;
  }

  // Post purchases
  const allPurchases = db.prepare('SELECT id, supplier_id, item_description, amount, date, payment_status FROM purchases').all();
  for (const p of allPurchases) {
    const payAcc = p.payment_status === 'paid' ? '1000' : '2000';
    insLedger.run('1200', `Inventory: ${p.item_description}`, p.amount, 0, p.date, 'purchases', p.id);
    insLedger.run(payAcc, `Purchase: ${p.item_description}`, 0, p.amount, p.date, 'purchases', p.id);
    entryCount += 2;
  }

  // Post expenses
  const allExpenses = db.prepare('SELECT id, category, amount, date, description FROM expenses').all();
  const catToAcc = { utilities: '4100', salaries: '4200', stationery: '4300', repairs: '4400', transport: '4500', security: '4600', cleaning: '4700', teaching_materials: '4800' };
  for (const e of allExpenses) {
    insLedger.run(catToAcc[e.category] || '4000', e.description || `${e.category} expense`, e.amount, 0, e.date, 'expenses', e.id);
    insLedger.run('1000', `Cash paid: ${e.description || e.category}`, 0, e.amount, e.date, 'expenses', e.id);
    entryCount += 2;
  }

  // Post payroll (all months)
  const allPayroll = db.prepare('SELECT id, employee_id, period_start, basic_salary, allowances, deductions FROM payroll').all();
  for (const p of allPayroll) {
    const net = p.basic_salary + p.allowances - p.deductions;
    insLedger.run('4200', `Salaries: ${p.employee_id} (${p.period_start})`, net, 0, p.period_start, 'payroll', p.id);
    insLedger.run('1000', `Net salary paid: ${p.employee_id} (${p.period_start})`, 0, net, p.period_start, 'payroll', p.id);
    entryCount += 2;
  }

  // Post asset purchases
  const allAssets = db.prepare('SELECT id, name, value, acquisition_date FROM assets').all();
  for (const a of allAssets) {
    insLedger.run('1300', `Asset: ${a.name}`, a.value, 0, a.acquisition_date, 'assets', a.id);
    insLedger.run('1000', `Cash paid for ${a.name}`, 0, a.value, a.acquisition_date, 'assets', a.id);
    entryCount += 2;
  }
})();
console.log(`  ✓ ${entryCount} ledger entries`);

console.log('\n✅ Seeding complete!');
console.log('   Admin login: admin@school.com / admin123');
console.log('   Bursar login: bursar@school.com / bursar123');
console.log('   Teacher login: teacher@school.com / teacher123');
console.log('   Headmaster login: headmaster@school.com / headmaster123');

db.close();