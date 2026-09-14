export type Role = 'admin' | 'bursar' | 'teacher' | 'headmaster'

export interface Student {
  id: number
  student_id: string
  first_name: string
  last_name: string
  gender: string
  date_of_birth: string
  class_id: number
  guardian_name: string
  guardian_contact: string
  address: string
  date_enrolled: string
  status: string
  class_name?: string
  fees_charged?: number
  amount_paid?: number
  balance?: number
  fees?: FeeTerm[]
  fee_lines?: FeeLine[]
  payments?: Payment[]
}

export interface ClassInfo {
  id: number
  name: string
  stream?: string
  fees_per_term?: number
  school_fees?: number
  development_levy?: number
  capacity?: number
  year_level?: number
  students?: number
}

export interface FeeTerm {
  term: string
  fee_items: number
  amount: number
  paid: number
  balance: number
}

export interface FeeLine {
  id: number
  term: string
  fee_type: string
  amount: number
  due_date: string
  status: string
}

export interface Payment {
  id: number
  student_id: number
  student_code?: string
  student_name?: string
  receipt_number: string
  amount: number
  date: string
  method: string
  term: string
  description?: string
}

export interface Supplier {
  id: number
  name: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  category?: string
  terms?: string
  balance?: number
}

export interface ExpenseCategory {
  id: number
  category: string
}

export interface Expense {
  id: number
  category?: string
  supplier?: string
  description?: string
  date: string
  amount: number
  payment_method?: string
  receipt?: string
}

export interface Employee {
  id: number
  employee_id: string
  first_name: string
  last_name: string
  role: string
  basic_salary: number
  allowances: number
  deductions: number
  hire_date?: string
  status: string
}

export interface PayrollRecord {
  id: number
  employee_id?: string
  employee_name?: string
  period_start: string
  period_end: string
  pay_date: string
  basic_salary: number
  allowances: number
  deductions: number
  net_pay: number
  status?: string
}

export interface InventoryItem {
  id: number
  name: string
  description?: string
  category?: string
  quantity_on_hand: number
  reorder_level: number
  unit_cost: number
  supplier_id?: number
  supplier_name?: string
  status: string
  total_value?: number
}

export interface Asset {
  id: number
  name: string
  category?: string
  value: number
  acquisition_date: string
  depreciation_rate: number
  status: string
}

export interface LedgerEntry {
  id: number
  account_code: string
  account_name?: string
  description: string
  debit: number
  credit: number
  date: string
  reference_type?: string
  running_balance?: number
}

export interface Account {
  code: string
  name: string
  type: string
  normal_balance: 'debit' | 'credit'
  balance: number
}

export interface TrialBalanceRow {
  account_code: string
  account_name: string
  type: string
  debit: number
  credit: number
}

export interface DashboardData {
  total_students: number
  fees_collected: number
  outstanding_fees: number
  total_expenses: number
  cash_bank_balance: number
  low_stock_items: number
}