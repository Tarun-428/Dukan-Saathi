import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Package, ShoppingCart, Users,
  BarChart3, Settings, Shield, Receipt, Wallet, BadgeIndianRupee,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pos', icon: ShoppingCart, label: 'POS / Billing' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/expenses', icon: Wallet, label: 'Expenses' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/plan', icon: BadgeIndianRupee, label: 'Plan' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

const adminNav = [
  { to: '/admin', icon: Shield, label: 'Admin' },
]

export function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin'
  const items = isAdmin ? adminNav : nav

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-slate-200/50 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80 lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200/50 px-6 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold">
            S
          </div>
          <span className="text-lg font-bold gradient-text">Sathi</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500/10 to-violet-500/10 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('h-5 w-5', isActive && 'text-indigo-500')} />
                  {item.label}
                  {isActive && (
                    <motion.div layoutId="nav-indicator" className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200/50 p-4 dark:border-slate-800">
          <p className="truncate text-xs text-slate-500">{user?.full_name}</p>
          <p className="truncate text-xs text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/70 bg-white/90 px-2 py-2 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 lg:hidden">
        <div className="flex gap-1 overflow-x-auto pb-[env(safe-area-inset-bottom)]">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex min-w-[68px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium transition',
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : 'text-slate-500 dark:text-slate-400'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="max-w-[64px] truncate">{item.label.replace(' / Billing', '')}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
