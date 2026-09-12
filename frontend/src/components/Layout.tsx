import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

const NAV: { section: string; items: { to: string; label: string; ico: string; roles?: string[] }[] }[] = [
  {
    section: 'Overview',
    items: [{ to: '/', label: 'Dashboard', ico: '▣' }],
  },
  {
    section: 'Students',
    items: [
      { to: '/students', label: 'Students', ico: '♟', roles: ['admin', 'bursar', 'teacher', 'headmaster'] },
      { to: '/classes', label: 'Classes', ico: '◎', roles: ['admin', 'bursar'] },
    ],
  },
  {
    section: 'Finance',
    items: [
      { to: '/payments', label: 'Payments', ico: '₩', roles: ['admin', 'bursar', 'headmaster'] },
      { to: '/fees', label: 'Fees & Statements', ico: '≔', roles: ['admin', 'bursar', 'headmaster'] },
      { to: '/expenses', label: 'Expenses', ico: '₹', roles: ['admin', 'bursar', 'headmaster'] },
      { to: '/suppliers', label: 'Suppliers', ico: '⇄', roles: ['admin', 'bursar', 'headmaster'] },
      { to: '/assets', label: 'Assets', ico: '⬒', roles: ['admin', 'bursar', 'headmaster'] },
    ],
  },
  {
    section: 'Admin',
    items: [
      { to: '/payroll', label: 'Staff & Payroll', ico: '❖', roles: ['admin', 'bursar', 'headmaster'] },
      { to: '/inventory', label: 'Inventory', ico: '⌬', roles: ['admin', 'bursar', 'headmaster'] },
    ],
  },
  {
    section: 'Accounting',
    items: [
      { to: '/accounting', label: 'Ledger & COA', ico: '⇅', roles: ['admin', 'bursar'] },
    ],
  },
  {
    section: 'Reports',
    items: [
      { to: '/reports', label: 'Reports', ico: '▤', roles: ['admin', 'bursar', 'headmaster'] },
    ],
  },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">A</div>
          <div>
            <div className="title">Acacia College</div>
            <div className="sub">Management System</div>
          </div>
        </div>

        {NAV.map((section) => {
          const items = section.items.filter((i) => !i.roles || (user && i.roles.includes(user.role)))
          if (items.length === 0) return null
          return (
            <div key={section.section}>
              <div className="nav-section">{section.section}</div>
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                  <span className="ico">{i.ico}</span>{i.label}
                </NavLink>
              ))}
            </div>
          )
        })}

        <div className="sidebar-footer">
          <div className="user-row">
            <div className="avatar">{(user?.name || '?')[0]}</div>
            <div className="user-meta">
              <div className="n">{user?.name}</div>
              <div className="r">{user?.role}</div>
            </div>
            <button className="logout-btn" onClick={() => { logout(); navigate('/login') }}>Logout</button>
          </div>
        </div>
      </aside>

      <main className="main"><Outlet /></main>
    </div>
  )
}