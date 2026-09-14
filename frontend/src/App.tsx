import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth'
import { Layout } from './components/Layout'
import { RequireAuth, RequireRole } from './components/Protected'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Students } from './pages/Students'
import { StudentDetail } from './pages/StudentDetail'
import { Classes } from './pages/Classes'
import { Fees } from './pages/Fees'
import { Payments } from './pages/Payments'
import { Expenses } from './pages/Expenses'
import { Suppliers } from './pages/Suppliers'
import { Assets } from './pages/Assets'
import { Payroll } from './pages/Payroll'
import { Inventory } from './pages/Inventory'
import { Accounting } from './pages/Accounting'
import { Reports } from './pages/Reports'
import { Attendance } from './pages/Attendance'
import { Grades } from './pages/Grades'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="students/:id" element={<StudentDetail />} />

            <Route path="classes" element={<RequireRole roles={['admin', 'bursar']}><Classes /></RequireRole>} />

            <Route path="attendance" element={<RequireRole roles={['admin', 'bursar', 'teacher', 'headmaster']}><Attendance /></RequireRole>} />
            <Route path="grades" element={<RequireRole roles={['admin', 'bursar', 'teacher', 'headmaster']}><Grades /></RequireRole>} />

            <Route path="payments" element={<RequireRole roles={['admin', 'bursar', 'headmaster']}><Payments /></RequireRole>} />
            <Route path="fees" element={<RequireRole roles={['admin', 'bursar', 'headmaster']}><Fees /></RequireRole>} />
            <Route path="expenses" element={<RequireRole roles={['admin', 'bursar', 'headmaster']}><Expenses /></RequireRole>} />
            <Route path="suppliers" element={<RequireRole roles={['admin', 'bursar', 'headmaster']}><Suppliers /></RequireRole>} />
            <Route path="assets" element={<RequireRole roles={['admin', 'bursar', 'headmaster']}><Assets /></RequireRole>} />

            <Route path="payroll" element={<RequireRole roles={['admin', 'bursar', 'headmaster']}><Payroll /></RequireRole>} />
            <Route path="inventory" element={<RequireRole roles={['admin', 'bursar', 'headmaster']}><Inventory /></RequireRole>} />

            <Route path="accounting" element={<RequireRole roles={['admin', 'bursar']}><Accounting /></RequireRole>} />
            <Route path="reports" element={<RequireRole roles={['admin', 'bursar', 'headmaster']}><Reports /></RequireRole>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}