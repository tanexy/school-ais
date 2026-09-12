require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('./db');
const migrate = require('./migrate');
migrate();

// Seed a default admin if none exists
const admins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get();
if (admins.c === 0) {
  const password = bcrypt.hashSync('admin123', 10);
  db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)")
    .run('Administrator', 'admin@school.com', password, 'admin');
}

// ─────────────────────────────────────────────
// AUTH HELPERS
// ─────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'school-ais-secret-dev';

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
}

function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'Authorization header missing' });
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function rolesAllowed(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied for role: ' + (req.user && req.user.role) });
    }
    next();
  };
}

// ─────────────────────────────────────────────
// LEDGER / ACCOUNTING HELPERS
// ─────────────────────────────────────────────
function postEntry(accountCode, description, debit, credit, date, refType, refId) {
  db.prepare(`
    INSERT INTO ledger_entries (account_code, description, debit, credit, date, reference_type, reference_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(accountCode, description, debit || 0, credit || 0, date || new Date().toISOString().slice(0, 10), refType, refId);
}

// ─────────────────────────────────────────────
// EXPRESS APP
// ─────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── Auth ──────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  res.json({
    token: signToken(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/register', authRequired, rolesAllowed('admin'), (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password required' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ message: 'Email already registered' });
  const r = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
    .run(name, email, bcrypt.hashSync(password, 10), role || 'teacher');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// ── Users ─────────────────────────────────────
app.get('/api/users', authRequired, rolesAllowed('admin'), (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY name').all();
  res.json(users);
});

// ── Classes ───────────────────────────────────
app.get('/api/classes', authRequired, rolesAllowed('admin', 'bursar', 'teacher', 'headmaster'), (req, res) => {
  res.json(db.prepare('SELECT c.*, (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS student_count FROM classes c ORDER BY year_level, name').all());
});
app.post('/api/classes', authRequired, rolesAllowed('admin'), (req, res) => {
  const { name, stream, capacity, year_level } = req.body;
  const r = db.prepare('INSERT INTO classes (name, stream, capacity, year_level) VALUES (?, ?, ?, ?)')
    .run(name, stream, capacity, year_level);
  res.status(201).json({ id: r.lastInsertRowid, message: 'Class created' });
});

// ── Students ──────────────────────────────────
app.get('/api/students', authRequired, rolesAllowed('admin', 'bursar', 'teacher', 'headmaster'), (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    rows = db.prepare(`
      SELECT s.*, c.name AS class_name,
        (SELECT COALESCE(SUM(f.amount),0) FROM fees f WHERE f.student_id = s.id) AS fees_charged,
        (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.student_id = s.id) AS amount_paid,
        (SELECT COALESCE(SUM(f.amount),0) FROM fees f WHERE f.student_id = s.id)
          - (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.student_id = s.id) AS balance
      FROM students s LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_id LIKE ?
      ORDER BY s.last_name, s.first_name
    `).all(`%${q}%`, `%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare(`
      SELECT s.*, c.name AS class_name,
        (SELECT COALESCE(SUM(f.amount),0) FROM fees f WHERE f.student_id = s.id) AS fees_charged,
        (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.student_id = s.id) AS amount_paid,
        (SELECT COALESCE(SUM(f.amount),0) FROM fees f WHERE f.student_id = s.id)
          - (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.student_id = s.id) AS balance
      FROM students s LEFT JOIN classes c ON s.class_id = c.id
      ORDER BY s.last_name, s.first_name
    `).all();
  }
  res.json(rows);
});

app.get('/api/students/:id', authRequired, rolesAllowed('admin', 'bursar', 'teacher', 'headmaster'), (req, res) => {
  const s = db.prepare('SELECT s.*, c.name AS class_name FROM students s LEFT JOIN classes c ON s.class_id = c.id WHERE s.id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ message: 'Student not found' });
  s.fees = db.prepare(`
    SELECT f.term, COUNT(f.id) AS fee_items, SUM(f.amount) AS amount,
      COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.student_id = f.student_id AND p.term = f.term),0) AS paid
    FROM fees f WHERE f.student_id = ? GROUP BY f.term ORDER BY f.term`,
  ).all(s.id);
  s.fee_lines = db.prepare('SELECT id, term, fee_type, amount, due_date, status FROM fees WHERE student_id = ? ORDER BY term').all(s.id);
  s.payments = db.prepare('SELECT * FROM payments WHERE student_id = ? ORDER BY date DESC').all(s.id);
  s.fees = s.fees.map(r => ({ ...r, balance: r.amount - r.paid }));
  const totals = db.prepare(`
    SELECT
      (SELECT COALESCE(SUM(amount),0) FROM fees WHERE student_id = ?) AS fees_charged,
      (SELECT COALESCE(SUM(amount),0) FROM payments WHERE student_id = ?) AS amount_paid
  `).get(s.id, s.id);
  s.fees_charged = totals.fees_charged;
  s.amount_paid = totals.amount_paid;
  s.balance = totals.fees_charged - totals.amount_paid;
  res.json(s);
});

app.post('/api/students', authRequired, rolesAllowed('admin', 'bursar'), (req, res) => {
  const { first_name, last_name, gender, date_of_birth, class_id, guardian_name, guardian_contact, address } = req.body;
  if (!first_name || !last_name) return res.status(400).json({ message: 'First and last name required' });
  // Generate student ID: STU + zero-padded counter
  const count = db.prepare('SELECT COALESCE(MAX(CAST(SUBSTR(student_id,4) AS INTEGER)),0) AS m FROM students').get().m;
  const student_id = 'STU' + String(count + 1).padStart(3, '0');
  const r = db.prepare(`
    INSERT INTO students (student_id, first_name, last_name, gender, date_of_birth, class_id, guardian_name, guardian_contact, address, date_enrolled, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), 'active')
  `).run(student_id, first_name, last_name, gender, date_of_birth, class_id, guardian_name, guardian_contact, address);
  res.status(201).json({ id: r.lastInsertRowid, student_id, message: 'Student registered' });
});

app.put('/api/students/:id', authRequired, rolesAllowed('admin', 'bursar'), (req, res) => {
  const { first_name, last_name, gender, date_of_birth, class_id, guardian_name, guardian_contact, address, status } = req.body;
  db.prepare(`
    UPDATE students SET first_name=?, last_name=?, gender=?, date_of_birth=?, class_id=?, guardian_name=?, guardian_contact=?, address=?, status=?
    WHERE id=?
  `).run(first_name, last_name, gender, date_of_birth, class_id, guardian_name, guardian_contact, address, status, req.params.id);
  res.json({ message: 'Student updated' });
});

app.get('/api/students/:id/fees', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const s = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ message: 'Student not found' });
  const fees = db.prepare('SELECT * FROM fees WHERE student_id = ? ORDER BY term').all(s.id);
  const payments = db.prepare('SELECT * FROM payments WHERE student_id = ? ORDER BY date').all(s.id);
  res.json({ student: s, fees, payments });
});

// ── Fees ──────────────────────────────────────
app.get('/api/fees', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const term = req.query.term;
  const status = req.query.status;
  let where = '';
  const params = [];
  if (term) { where += ' AND f.term = ?'; params.push(term); }
  const rows = db.prepare(`
    SELECT f.student_id, s.student_id AS student_code, s.first_name || ' ' || s.last_name AS student_name,
           c.name AS class_name, f.term,
           COUNT(f.id) AS fee_items,
           SUM(f.amount) AS amount,
           COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.student_id = f.student_id AND p.term = f.term),0) AS paid,
           SUM(f.amount) - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.student_id = f.student_id AND p.term = f.term),0) AS balance
    FROM fees f
    JOIN students s ON f.student_id = s.id
    LEFT JOIN classes c ON s.class_id = c.id
    WHERE 1=1 ${where}
    GROUP BY f.student_id, f.term
    ORDER BY s.last_name, f.term
  `).all(...params);
  res.json(rows.map(r => ({ ...r, status: r.balance <= 0.001 ? 'paid' : (r.paid > 0 ? 'partial' : 'unpaid') })));
});

app.get('/api/fees/detail', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const rows = db.prepare(`
    SELECT f.id, f.student_id, s.student_id AS student_code, s.first_name || ' ' || s.last_name AS student_name,
           f.term, f.fee_type, f.amount, f.due_date, f.status,
           COALESCE((SELECT SUM(amount) FROM payments WHERE student_id = f.student_id AND term = f.term),0) AS paid_this_term
    FROM fees f JOIN students s ON f.student_id = s.id
    ORDER BY s.last_name, f.term, f.id
  `).all();
  res.json(rows);
});

app.post('/api/fees', authRequired, rolesAllowed('admin', 'bursar'), (req, res) => {
  const { student_id, term, fee_type, amount, due_date } = req.body;
  if (!student_id || !term || !amount) return res.status(400).json({ message: 'Student, term and amount required' });
  const r = db.prepare('INSERT INTO fees (student_id, term, fee_type, amount, due_date, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(student_id, term, fee_type || 'School Fees', amount, due_date || new Date().toISOString().slice(0, 10), 'unpaid');
  postEntry('3000', `Fees charged - ${term}`, 0, amount, new Date().toISOString().slice(0, 10), 'fees', r.lastInsertRowid);
  postEntry('1000', `Fees receivable - student #${student_id} (${term})`, amount, 0, new Date().toISOString().slice(0, 10), 'fees', r.lastInsertRowid);
  res.status(201).json({ id: r.lastInsertRowid, message: 'Fee charged' });
});

// ── Payments ──────────────────────────────────
app.get('/api/payments', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const q = (req.query.q || '').toString().trim();
  let where = '';
  const params = [];
  if (q) {
    where = ` AND (p.receipt_number LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const rows = db.prepare(`
    SELECT p.id, p.student_id, s.student_id AS student_code, s.first_name || ' ' || s.last_name AS student_name,
           p.receipt_number, p.amount, p.date, p.method, p.term, p.description
    FROM payments p JOIN students s ON p.student_id = s.id
    WHERE 1=1 ${where}
    ORDER BY p.date DESC
  `).all(...params);
  res.json(rows);
});

app.post('/api/payments', authRequired, rolesAllowed('admin', 'bursar'), (req, res) => {
  const { student_id, amount, date, method, term, description } = req.body;
  if (!student_id || !amount) return res.status(400).json({ message: 'Student and amount required' });

  const count = db.prepare("SELECT COALESCE(MAX(CAST(SUBSTR(receipt_number,4) AS INTEGER)),0) AS m FROM payments").get().m;
  const receipt_number = 'RCP' + String(count + 1).padStart(4, '0');
  const payDate = date || new Date().toISOString().slice(0, 10);

  const txn = db.transaction(() => {
    const r = db.prepare(`
      INSERT INTO payments (student_id, receipt_number, amount, date, method, term, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(student_id, receipt_number, amount, payDate, method || 'Cash', term || '', description || '');

    // Reset fee status for that student + term
    if (term) {
      const feeTotals = db.prepare(`
        SELECT COALESCE((SELECT SUM(amount) FROM fees WHERE student_id = ? AND term = ?),0) AS fees,
               COALESCE((SELECT SUM(amount) FROM payments WHERE student_id = ? AND term = ?),0) AS paid
      `).get(student_id, term, student_id, term);
      const newStatus = feeTotals.paid >= feeTotals.fees && feeTotals.fees > 0 ? 'paid' : 
        (feeTotals.paid > 0 ? 'partial' : 'unpaid');
      db.prepare('UPDATE fees SET status = ? WHERE student_id = ? AND term = ?')
        .run(newStatus, student_id, term);
    }

    // Post to ledger: Dr Cash / Cr Fees Receivable (collection of receivable)
    postEntry('1000', `Cash received - ${description || 'fee payment'}`, amount, 0, payDate, 'payments', r.lastInsertRowid);
    postEntry('1100', `Fees receivable settled - student #${student_id}`, 0, amount, payDate, 'payments', r.lastInsertRowid);

    return { id: r.lastInsertRowid, receipt_number };
  });

  const result = txn();
  res.status(201).json({ ...result, message: 'Payment recorded' });
});

// ── Expenses ──────────────────────────────────
app.get('/api/expense-categories', authRequired, rolesAllowed('admin', 'bursar', 'teacher', 'headmaster'), (req, res) => {
  res.json(db.prepare('SELECT * FROM expense_categories ORDER BY category').all());
});

app.get('/api/expenses', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const from = req.query.from; const to = req.query.to; const cat = req.query.category;
  let sql = 'SELECT e.*, (SELECT name FROM suppliers WHERE id = e.receipt_number) AS supplier_name FROM expenses e';
  const conds = []; const params = [];
  if (from) { conds.push('e.date >= ?'); params.push(from); }
  if (to) { conds.push('e.date <= ?'); params.push(to); }
  if (cat) { conds.push('e.category = ?'); params.push(cat); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY e.date DESC';
  const rows = db.prepare(sql).all(...params);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  res.json({ rows, total });
});

app.post('/api/expenses', authRequired, rolesAllowed('admin', 'bursar'), (req, res) => {
  const { category, amount, date, description, receipt_number } = req.body;
  if (!category || !amount) return res.status(400).json({ message: 'Category and amount required' });
  const catMap = {
    utilities: '4100', salaries: '4200', stationery: '4300',
    repairs: '4400', transport: '4500', security: '4600',
    cleaning: '4700', teaching_materials: '4800'
  };
  const expDate = date || new Date().toISOString().slice(0, 10);
  const r = db.prepare('INSERT INTO expenses (category, amount, date, description, receipt_number) VALUES (?, ?, ?, ?, ?)')
    .run(category, amount, expDate, description || '', receipt_number || '');
  postEntry(catMap[category] || '4000', description || `${category} expense`, amount, 0, expDate, 'expenses', r.lastInsertRowid);
  postEntry('1000', `Cash paid - ${description || category}`, 0, amount, expDate, 'expenses', r.lastInsertRowid);
  res.status(201).json({ id: r.lastInsertRowid, message: 'Expense recorded' });
});

// ── Suppliers ─────────────────────────────────
app.get('/api/suppliers', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const rows = db.prepare(`
    SELECT sup.*,
      (SELECT COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN amount ELSE 0 END),0) FROM purchases WHERE supplier_id = sup.id) AS owing
    FROM suppliers sup ORDER BY sup.name
  `).all();
  res.json(rows);
});
app.post('/api/suppliers', authRequired, rolesAllowed('admin', 'bursar'), (req, res) => {
  const { name, contact_person, phone, email, address, terms, status } = req.body;
  const r = db.prepare('INSERT INTO suppliers (name, contact_person, phone, email, address, terms, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(name, contact_person, phone, email, address, terms, status || 'active');
  res.status(201).json({ id: r.lastInsertRowid, message: 'Supplier created' });
});

// ── Purchases ─────────────────────────────────
app.get('/api/purchases', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const rows = db.prepare(`
    SELECT pu.*, s.name AS supplier_name
    FROM purchases pu LEFT JOIN suppliers s ON pu.supplier_id = s.id
    ORDER BY pu.date DESC
  `).all();
  res.json(rows);
});
app.post('/api/purchases', authRequired, rolesAllowed('admin', 'bursar'), (req, res) => {
  const { supplier_id, item_description, amount, date, invoice_number, payment_status } = req.body;
  const r = db.prepare('INSERT INTO purchases (supplier_id, item_description, amount, date, invoice_number, payment_status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(supplier_id, item_description, amount, date || new Date().toISOString().slice(0, 10), invoice_number, payment_status || 'unpaid');
  // Purchase increases both asset (inventory) and liability (accounts payable) if unpaid
  const acc = payment_status === 'paid' ? '1000' : '2000';
  postEntry('5000', `Purchase: ${item_description}`, 0, amount, date || new Date().toISOString().slice(0, 10), 'purchases', r.lastInsertRowid);
  postEntry(acc, `Purchase payable: ${item_description}`, amount, 0, date || new Date().toISOString().slice(0, 10), 'purchases', r.lastInsertRowid);
  res.status(201).json({ id: r.lastInsertRowid, message: 'Purchase recorded' });
});

// ── Employees ─────────────────────────────────
app.get('/api/employees', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const rows = db.prepare('SELECT * FROM employees ORDER BY last_name, first_name').all();
  res.json(rows);
});
app.post('/api/employees', authRequired, rolesAllowed('admin', 'bursar'), (req, res) => {
  const { first_name, last_name, role, basic_salary, allowances, deductions, hire_date, status } = req.body;
  const count = db.prepare("SELECT COALESCE(MAX(CAST(SUBSTR(employee_id,4) AS INTEGER)),0) AS m FROM employees").get().m;
  const employee_id = 'EMP' + String(count + 1).padStart(3, '0');
  const r = db.prepare('INSERT INTO employees (employee_id, first_name, last_name, role, basic_salary, allowances, deductions, hire_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(employee_id, first_name, last_name, role, basic_salary || 0, allowances || 0, deductions || 0, hire_date || new Date().toISOString().slice(0, 10), status || 'active');
  res.status(201).json({ id: r.lastInsertRowid, employee_id, message: 'Employee created' });
});

// ── Payroll ───────────────────────────────────
app.get('/api/payroll', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, e.first_name || ' ' || e.last_name AS employee_name,
           (p.basic_salary + p.allowances - p.deductions) AS net_salary
    FROM payroll p JOIN employees e ON p.employee_id = e.employee_id
    ORDER BY p.pay_date DESC
  `).all();
  const summary = db.prepare(`
    SELECT COALESCE(SUM(basic_salary),0) AS total_basic, COALESCE(SUM(allowances),0) AS total_allowances,
           COALESCE(SUM(deductions),0) AS total_deductions,
           COALESCE(SUM(basic_salary + allowances - deductions),0) AS total_net
    FROM payroll
  `).get();
  res.json({ rows, summary });
});
app.post('/api/payroll', authRequired, rolesAllowed('admin', 'bursar'), (req, res) => {
  const { employee_id, period_start, period_end, pay_date, basic_salary, allowances, deductions } = req.body;
  const emp = db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(employee_id);
  if (!emp && !basic_salary) return res.status(400).json({ message: 'Valid employee or salary required' });
  const bs = basic_salary ?? emp.basic_salary;
  const al = allowances ?? emp.allowances;
  const de = deductions ?? emp.deductions;
  const r = db.prepare('INSERT INTO payroll (employee_id, period_start, period_end, pay_date, basic_salary, allowances, deductions) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(employee_id, period_start, period_end, pay_date || new Date().toISOString().slice(0, 10), bs, al, de);
  const net = bs + al - de;
  postEntry('4200', `Salaries - ${emp ? emp.first_name + ' ' + emp.last_name : employee_id}`, net, 0, pay_date || new Date().toISOString().slice(0, 10), 'payroll', r.lastInsertRowid);
  postEntry('1000', `Net salary paid - ${emp ? emp.first_name + ' ' + emp.last_name : employee_id}`, 0, net, pay_date || new Date().toISOString().slice(0, 10), 'payroll', r.lastInsertRowid);
  res.status(201).json({ id: r.lastInsertRowid, net_salary: net, message: 'Payroll processed' });
});

// ── Inventory ─────────────────────────────────
app.get('/api/inventory', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, s.name AS supplier_name,
      (SELECT COALESCE(SUM(CASE WHEN type = 'receive' THEN quantity ELSE 0 END),0) FROM stock_movements WHERE item_id = i.id)
        - (SELECT COALESCE(SUM(CASE WHEN type = 'issue' THEN quantity ELSE 0 END),0) FROM stock_movements WHERE item_id = i.id) AS stock_from_movements
    FROM inventory_items i LEFT JOIN suppliers s ON i.supplier_id = s.id
    ORDER BY i.name
  `).all();
  const lowStock = rows.filter(r => r.quantity_on_hand <= r.reorder_level);
  res.json({ rows, lowStock });
});
app.post('/api/inventory', authRequired, rolesAllowed('admin', 'bursar'), (req, res) => {
  const { name, description, quantity_on_hand, reorder_level, unit_cost, supplier_id } = req.body;
  const r = db.prepare('INSERT INTO inventory_items (name, description, quantity_on_hand, reorder_level, unit_cost, supplier_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(name, description || '', quantity_on_hand || 0, reorder_level || 5, unit_cost || 0, supplier_id || null, 'good');
  res.status(201).json({ id: r.lastInsertRowid, message: 'Inventory item created' });
});

app.post('/api/inventory/:id/stock-movements', authRequired, rolesAllowed('admin', 'bursar'), (req, res) => {
  const { type, quantity, notes } = req.body;
  if (!['receive', 'issue'].includes(type) || !quantity) return res.status(400).json({ message: 'Valid type (receive/issue) and quantity required' });
  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  const txn = db.transaction(() => {
    const newQty = type === 'receive' ? item.quantity_on_hand + quantity : item.quantity_on_hand - quantity;
    if (newQty < 0) throw new Error('Cannot issue more than stock on hand');
    db.prepare('INSERT INTO stock_movements (item_id, type, quantity, date, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(item.id, type, quantity, new Date().toISOString().slice(0, 10), 'manual', null, notes || '');
    const status = newQty <= item.reorder_level ? 'low' : 'good';
    db.prepare('UPDATE inventory_items SET quantity_on_hand = ?, status = ? WHERE id = ?').run(newQty, status, item.id);
    return { newQty, status };
  });
  try {
    const result = txn();
    res.json({ ...result, message: 'Stock movement recorded' });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ── Assets ────────────────────────────────────
app.get('/api/assets', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const rows = db.prepare('SELECT * FROM assets ORDER BY name').all();
  const total = rows.reduce((s, r) => s + r.value, 0);
  res.json({ rows, total });
});
app.post('/api/assets', authRequired, rolesAllowed('admin', 'bursar'), (req, res) => {
  const { name, category, value, acquisition_date, depreciation_rate, status } = req.body;
  const r = db.prepare('INSERT INTO assets (name, category, value, acquisition_date, depreciation_rate, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, category || '', value, acquisition_date || new Date().toISOString().slice(0, 10), depreciation_rate || 0, status || 'active');
  postEntry('6000', `Asset acquired: ${name}`, value, 0, acquisition_date || new Date().toISOString().slice(0, 10), 'assets', r.lastInsertRowid);
  postEntry('1000', `Cash paid - asset ${name}`, 0, value, acquisition_date || new Date().toISOString().slice(0, 10), 'assets', r.lastInsertRowid);
  res.status(201).json({ id: r.lastInsertRowid, message: 'Asset registered' });
});

// ── Chart of Accounts / Ledger ────────────────
app.get('/api/chart-of-accounts', authRequired, rolesAllowed('admin', 'bursar', 'headmaster', 'teacher'), (req, res) => {
  const rows = db.prepare('SELECT * FROM chart_of_accounts ORDER BY account_code').all();
  // Compute balances
  const balances = db.prepare(`
    SELECT le.account_code, COALESCE(SUM(le.debit),0) AS total_debit, COALESCE(SUM(le.credit),0) AS total_credit
    FROM ledger_entries le GROUP BY le.account_code
  `).all();
  const balMap = {};
  balances.forEach(b => balMap[b.account_code] = b.total_debit - b.total_credit);
  res.json(rows.map(r => ({ ...r, balance: balMap[r.account_code] || 0 })));
});

app.get('/api/ledger', authRequired, rolesAllowed('admin', 'bursar'), (req, res) => {
  const rows = db.prepare(`
    SELECT le.*, ca.account_name, ca.account_type
    FROM ledger_entries le LEFT JOIN chart_of_accounts ca ON le.account_code = ca.account_code
    ORDER BY le.date, le.id
  `).all();
  res.json(rows);
});

app.get('/api/ledger/account/:code', authRequired, rolesAllowed('admin', 'bursar'), (req, res) => {
  const rows = db.prepare(`
    SELECT le.*, ca.account_name FROM ledger_entries le
    LEFT JOIN chart_of_accounts ca ON le.account_code = ca.account_code
    WHERE le.account_code = ? ORDER BY le.date, le.id
  `).all(req.params.code);
  res.json(rows);
});

// ── Reports ───────────────────────────────────
// Cashbook
app.get('/api/reports/cashbook', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const from = req.query.from || null;
  const to = req.query.to || null;
  let sql = `
    SELECT le.id, le.date, le.description, le.reference_type, ca.account_name,
           CASE WHEN le.account_code = '1000' THEN le.debit ELSE 0 END AS receipts,
           CASE WHEN le.account_code = '1000' THEN le.credit ELSE 0 END AS payments,
           le.account_code
    FROM ledger_entries le LEFT JOIN chart_of_accounts ca ON le.account_code = ca.account_code
    WHERE le.account_code = '1000'
  `;
  const params = [];
  if (from) { sql += ' AND le.date >= ?'; params.push(from); }
  if (to) { sql += ' AND le.date <= ?'; params.push(to); }
  sql += ' ORDER BY le.date, le.id';
  const rows = db.prepare(sql).all(...params);
  let balance = 0;
  const out = rows.map(r => {
    balance += (r.receipts || 0) - (r.payments || 0);
    return { ...r, balance };
  });
  res.json({ rows: out, closing_balance: balance });
});

// Trial balance
app.get('/api/reports/trial-balance', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const rows = db.prepare(`
    SELECT ca.account_code, ca.account_name, ca.account_type,
           COALESCE(SUM(le.debit),0) AS debit, COALESCE(SUM(le.credit),0) AS credit
    FROM chart_of_accounts ca
    LEFT JOIN ledger_entries le ON le.account_code = ca.account_code
    GROUP BY ca.account_code
    ORDER BY ca.account_code
  `).all();
  const totals = rows.reduce((t, r) => ({ debit: t.debit + r.debit, credit: t.credit + r.credit }), { debit: 0, credit: 0 });
  res.json({ rows, totals });
});

// Income & expenditure statement
app.get('/api/reports/income-expenditure', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const incomeAccounts = db.prepare(`
    SELECT ca.account_code, ca.account_name,
           COALESCE(SUM(le.credit) - SUM(le.debit),0) AS balance
    FROM chart_of_accounts ca LEFT JOIN ledger_entries le ON le.account_code = ca.account_code
    WHERE ca.account_type = 'income' GROUP BY ca.account_code ORDER BY ca.account_code
  `).all();
  const expenseAccounts = db.prepare(`
    SELECT ca.account_code, ca.account_name,
           COALESCE(SUM(le.debit) - SUM(le.credit),0) AS balance
    FROM chart_of_accounts ca LEFT JOIN ledger_entries le ON le.account_code = ca.account_code
    WHERE ca.account_type = 'expense' GROUP BY ca.account_code ORDER BY ca.account_code
  `).all();
  const totalIncome = incomeAccounts.reduce((s, r) => s + r.balance, 0);
  const totalExpenses = expenseAccounts.reduce((s, r) => s + r.balance, 0);
  res.json({
    income: incomeAccounts,
    expenses: expenseAccounts,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    surplus_deficit: totalIncome - totalExpenses
  });
});

// Statement of financial position
app.get('/api/reports/statement-of-position', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const assets = db.prepare(`
    SELECT ca.account_code, ca.account_name,
           COALESCE(SUM(le.debit) - SUM(le.credit),0) AS balance
    FROM chart_of_accounts ca LEFT JOIN ledger_entries le ON le.account_code = ca.account_code
    WHERE ca.account_type = 'asset' GROUP BY ca.account_code ORDER BY ca.account_code
  `).all();
  const liabilities = db.prepare(`
    SELECT ca.account_code, ca.account_name,
           COALESCE(SUM(le.credit) - SUM(le.debit),0) AS balance
    FROM chart_of_accounts ca LEFT JOIN ledger_entries le ON le.account_code = ca.account_code
    WHERE ca.account_type = 'liability' GROUP BY ca.account_code ORDER BY ca.account_code
  `).all();
  const equity = db.prepare(`
    SELECT ca.account_code, ca.account_name,
           COALESCE(SUM(le.credit) - SUM(le.debit),0) AS balance
    FROM chart_of_accounts ca LEFT JOIN ledger_entries le ON le.account_code = ca.account_code
    WHERE ca.account_type = 'equity' GROUP BY ca.account_code ORDER BY ca.account_code
  `).all();
  const totalAssets = assets.reduce((s, r) => s + r.balance, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + r.balance, 0);
  const totalEquity = equity.reduce((s, r) => s + r.balance, 0);
  res.json({ assets, liabilities, equity, total_assets: totalAssets, total_liabilities: totalLiabilities, total_equity: totalEquity });
});

// Dashboard
app.get('/api/reports/dashboard', authRequired, rolesAllowed('admin', 'bursar', 'headmaster', 'teacher'), (req, res) => {
  const totalStudents = db.prepare("SELECT COUNT(*) AS c FROM students WHERE status = 'active'").get().c;
  const feesCollected = db.prepare("SELECT COALESCE(SUM(amount),0) AS t FROM payments").get().t;
  const feesCharged = db.prepare("SELECT COALESCE(SUM(amount),0) AS t FROM fees").get().t;
  const outstanding = feesCharged - feesCollected;
  const expenses = db.prepare("SELECT COALESCE(SUM(amount),0) AS t FROM expenses").get().t;
  const cashbook = db.prepare("SELECT COALESCE(SUM(debit - credit),0) AS b FROM ledger_entries WHERE account_code = '1000'").get().b;
  const lowStock = db.prepare("SELECT COUNT(*) AS c FROM inventory_items WHERE quantity_on_hand <= reorder_level").get().c;
  res.json({
    total_students: totalStudents,
    fees_collected: feesCollected,
    outstanding_fees: outstanding,
    total_expenses: expenses,
    cash_bank_balance: cashbook,
    low_stock_items: lowStock
  });
});

// Students by class
app.get('/api/reports/students-by-class', authRequired, rolesAllowed('admin', 'bursar', 'teacher', 'headmaster'), (req, res) => {
  const rows = db.prepare(`
    SELECT c.id AS class_id, c.name AS class_name, c.stream,
           COUNT(s.id) AS count,
           COALESCE((SELECT SUM(amount) FROM fees f WHERE f.student_id IN (SELECT id FROM students WHERE class_id = c.id)),0) AS fees_charged,
           COALESCE((SELECT SUM(amount) FROM payments p WHERE p.student_id IN (SELECT id FROM students WHERE class_id = c.id)),0) AS fees_paid
    FROM classes c LEFT JOIN students s ON s.class_id = c.id
    GROUP BY c.id ORDER BY c.year_level
  `).all();
  res.json(rows);
});

// Outstanding fees / debtors
app.get('/api/reports/outstanding-fees', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const rows = db.prepare(`
    SELECT s.id AS student_id, s.student_id AS code, s.first_name || ' ' || s.last_name AS student_name,
           c.name AS class_name,
           (SELECT COALESCE(SUM(amount),0) FROM fees WHERE student_id = s.id) AS fees_charged,
           (SELECT COALESCE(SUM(amount),0) FROM payments WHERE student_id = s.id) AS amount_paid,
           (SELECT COALESCE(SUM(amount),0) FROM fees WHERE student_id = s.id)
             - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE student_id = s.id) AS balance
    FROM students s LEFT JOIN classes c ON s.class_id = c.id
    WHERE (SELECT COALESCE(SUM(amount),0) FROM fees WHERE student_id = s.id)
      - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE student_id = s.id) > 0
    ORDER BY balance DESC
  `).all();
  res.json(rows);
});

// Paid-up students
app.get('/api/reports/paid-up-students', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const rows = db.prepare(`
    SELECT s.id AS student_id, s.student_id AS code, s.first_name || ' ' || s.last_name AS student_name,
           c.name AS class_name,
           (SELECT COALESCE(SUM(amount),0) FROM fees WHERE student_id = s.id) AS fees_charged,
           (SELECT COALESCE(SUM(amount),0) FROM payments WHERE student_id = s.id) AS amount_paid
    FROM students s LEFT JOIN classes c ON s.class_id = c.id
    WHERE (SELECT COALESCE(SUM(amount),0) FROM payments WHERE student_id = s.id)
        >= (SELECT COALESCE(SUM(amount),0) FROM fees WHERE student_id = s.id)
      AND (SELECT COALESCE(SUM(amount),0) FROM fees WHERE student_id = s.id) > 0
    ORDER BY s.last_name
  `).all();
  res.json(rows);
});

// Student statement
app.get('/api/reports/student-statement/:id', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const s = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ message: 'Student not found' });
  const fees = db.prepare('SELECT * FROM fees WHERE student_id = ? ORDER BY term').all(s.id);
  const payments = db.prepare('SELECT * FROM payments WHERE student_id = ? ORDER BY date').all(s.id);
  const totalFees = fees.reduce((t, f) => t + f.amount, 0);
  const totalPaid = payments.reduce((t, p) => t + p.amount, 0);
  res.json({ student: s, fees, payments, total_fees: totalFees, total_paid: totalPaid, balance: totalFees - totalPaid });
});

// Collections report
app.get('/api/reports/collections', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const daily = db.prepare(`
    SELECT date, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total
    FROM payments GROUP BY date ORDER BY date DESC
  `).all();
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', date) AS month, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total
    FROM payments GROUP BY month ORDER BY month DESC
  `).all();
  const byTerm = db.prepare(`
    SELECT term, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total
    FROM payments GROUP BY term ORDER BY term
  `).all();
  const byMethod = db.prepare(`
    SELECT method, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total
    FROM payments GROUP BY method ORDER BY method
  `).all();
  res.json({ daily, monthly, by_term: byTerm, by_method: byMethod });
});

// Expenses by category
app.get('/api/reports/expenses-by-category', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const rows = db.prepare(`
    SELECT e.category, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total
    FROM expenses e GROUP BY e.category ORDER BY total DESC
  `).all();
  res.json(rows);
});

// Budget vs actual (using expenses)
app.get('/api/reports/budget-vs-actual', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const categoryBudgets = {
    utilities: 2000, salaries: 12000, stationery: 800, repairs: 1000,
    transport: 1200, security: 900, cleaning: 600, teaching_materials: 1500
  };
  const actuals = db.prepare(`
    SELECT e.category, COALESCE(SUM(amount),0) AS actual
    FROM expenses e GROUP BY e.category
  `).all();
  const rows = actuals.map(a => ({
    category: a.category,
    budget: categoryBudgets[a.category] || 0,
    actual: a.actual,
    variance: (categoryBudgets[a.category] || 0) - a.actual
  }));
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  res.json({ rows, total_budget: totalBudget, total_actual: totalActual });
});

// Payroll report
app.get('/api/reports/payroll', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, e.first_name || ' ' || e.last_name AS employee_name, e.role AS employee_role,
           (p.basic_salary + p.allowances - p.deductions) AS net_salary
    FROM payroll p JOIN employees e ON p.employee_id = e.employee_id
    ORDER BY p.pay_date DESC
  `).all();
  const totals = rows.reduce((t, r) => ({
    basic: t.basic + r.basic_salary,
    allowances: t.allowances + (r.allowances || 0),
    deductions: t.deductions + (r.deductions || 0),
    net: t.net + r.net_salary
  }), { basic: 0, allowances: 0, deductions: 0, net: 0 });
  res.json({ rows, totals });
});

// Stock report
app.get('/api/reports/stock', authRequired, rolesAllowed('admin', 'bursar', 'headmaster'), (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, s.name AS supplier_name,
      (SELECT COALESCE(SUM(CASE WHEN type = 'receive' THEN quantity ELSE 0 END),0) FROM stock_movements WHERE item_id = i.id)
        - (SELECT COALESCE(SUM(CASE WHEN type = 'issue' THEN quantity ELSE 0 END),0) FROM stock_movements WHERE item_id = i.id) AS movements_balance
    FROM inventory_items i LEFT JOIN suppliers s ON i.supplier_id = s.id
    ORDER BY i.name
  `).all();
  res.json(rows);
});

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ School AIS backend running on http://localhost:${PORT}`);
  console.log(`   Login: admin@school.com / admin123`);
});

module.exports = app;