const db = require('./db');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'teacher',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      stream TEXT,
      capacity INTEGER,
      year_level INTEGER
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      gender TEXT,
      date_of_birth TEXT,
      class_id INTEGER,
      guardian_name TEXT,
      guardian_contact TEXT,
      address TEXT,
      date_enrolled TEXT DEFAULT (date('now')),
      status TEXT DEFAULT 'active',
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      term TEXT NOT NULL,
      fee_type TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT,
      status TEXT DEFAULT 'unpaid',
      date_assigned TEXT DEFAULT (date('now')),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      receipt_number TEXT UNIQUE,
      amount REAL NOT NULL,
      date TEXT DEFAULT (date('now')),
      method TEXT,
      term TEXT,
      description TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT DEFAULT (date('now')),
      description TEXT,
      receipt_number TEXT
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      terms TEXT,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      item_description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT DEFAULT (date('now')),
      invoice_number TEXT,
      payment_status TEXT DEFAULT 'unpaid',
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL,
      basic_salary REAL NOT NULL,
      allowances REAL DEFAULT 0,
      deductions REAL DEFAULT 0,
      hire_date TEXT,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      pay_date TEXT DEFAULT (date('now')),
      basic_salary REAL NOT NULL,
      allowances REAL DEFAULT 0,
      deductions REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      quantity_on_hand INTEGER DEFAULT 0,
      reorder_level INTEGER DEFAULT 5,
      unit_cost REAL DEFAULT 0,
      supplier_id INTEGER,
      last_stock_take TEXT DEFAULT (date('now')),
      status TEXT DEFAULT 'good',
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      date TEXT DEFAULT (date('now')),
      reference_type TEXT,
      reference_id INTEGER,
      notes TEXT,
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      value REAL NOT NULL,
      acquisition_date TEXT,
      depreciation_rate REAL DEFAULT 0,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS chart_of_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_code TEXT UNIQUE NOT NULL,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      parent_code TEXT,
      level INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_code TEXT NOT NULL,
      description TEXT NOT NULL,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      date TEXT DEFAULT (date('now')),
      reference_type TEXT,
      reference_id INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_fees_student ON fees(student_id);
    CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account_code);
  `);

  const cats = ['utilities', 'salaries', 'stationery', 'repairs', 'transport', 'security', 'cleaning', 'teaching_materials'];
  const insCat = db.prepare('INSERT OR IGNORE INTO expense_categories (category) VALUES (?)');
  cats.forEach(c => insCat.run(c));

  const accounts = [
    ['1000', 'Cash', 'asset', null, 1],
    ['1100', 'Fees Receivable', 'asset', null, 1],
    ['1200', 'Inventory', 'asset', null, 1],
    ['1300', 'Fixed Assets', 'asset', null, 1],
    ['2000', 'Accounts Payable', 'liability', null, 1],
    ['3000', 'Fees Income', 'income', null, 1],
    ['3100', 'Other Income', 'income', null, 1],
    ['4000', 'General Expenses', 'expense', null, 1],
    ['4100', 'Utilities', 'expense', null, 1],
    ['4200', 'Salaries', 'expense', null, 1],
    ['4300', 'Stationery', 'expense', null, 1],
    ['4400', 'Repairs & Maintenance', 'expense', null, 1],
    ['4500', 'Transport', 'expense', null, 1],
    ['4600', 'Security', 'expense', null, 1],
    ['4700', 'Cleaning', 'expense', null, 1],
    ['4800', 'Teaching Materials', 'expense', null, 1],
    ['5000', 'Capital / Equity', 'equity', null, 1],
  ];
  const insAcc = db.prepare('INSERT OR IGNORE INTO chart_of_accounts (account_code, account_name, account_type, parent_code, level, status) VALUES (?, ?, ?, ?, ?, ?)');
  accounts.forEach(a => insAcc.run(a[0], a[1], a[2], a[3], a[4], 'active'));

  return db;
}

module.exports = migrate;