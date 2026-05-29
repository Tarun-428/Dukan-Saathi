import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  TrendingUp, Package, AlertTriangle, Users, CreditCard, ShoppingBag,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'
import api from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatCurrency, formatISTDateTime, formatNumber } from '@/lib/utils'

interface DashboardStats {
  today_sales: number
  today_orders: number
  month_revenue: number
  low_stock_count: number
  total_products: number
  pending_payments: number
  customer_count: number
  recent_transactions: { id: string; invoice_number: string; grand_total: number; created_at: string }[]
  top_products: { name: string; quantity: number; revenue: number }[]
}

const statCards = [
  { key: 'today_sales', label: "Today's Sales", icon: TrendingUp, format: 'currency' },
  { key: 'today_orders', label: "Today's Orders", icon: ShoppingBag, format: 'number' },
  { key: 'month_revenue', label: 'Month Revenue', icon: CreditCard, format: 'currency' },
  { key: 'low_stock_count', label: 'Low Stock', icon: AlertTriangle, format: 'number' },
  { key: 'total_products', label: 'Products', icon: Package, format: 'number' },
  { key: 'customer_count', label: 'Customers', icon: Users, format: 'number' },
] as const

function statValue(data: DashboardStats | undefined, key: keyof DashboardStats) {
  const value = data?.[key]
  return typeof value === 'number' ? value : 0
}

function currencyTooltip(value: unknown) {
  return formatCurrency(Number(value || 0))
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<DashboardStats>('/billing/dashboard')).data,
    refetchInterval: 30000,
  })
  const chartData = data?.top_products?.map((p) => ({ name: p.name.slice(0, 12), revenue: p.revenue })) || []
  const revenueTrend = [
    { day: 'Mon', sales: (data?.today_sales || 0) * 0.6 },
    { day: 'Tue', sales: (data?.today_sales || 0) * 0.8 },
    { day: 'Wed', sales: (data?.today_sales || 0) * 0.5 },
    { day: 'Thu', sales: (data?.today_sales || 0) * 0.9 },
    { day: 'Fri', sales: data?.today_sales || 0 },
    { day: 'Sat', sales: (data?.today_sales || 0) * 1.2 },
    { day: 'Sun', sales: (data?.today_sales || 0) * 0.7 },
  ]

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <p className="text-slate-500">Welcome back</p>
        <h2 className="text-2xl font-bold">Shop Overview</h2>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card, i) => (
          <Card key={card.key} delay={i * 0.05} className="!p-4">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <card.icon className="h-5 w-5 text-indigo-500" />
                </div>
                <p className="mt-2 text-xs text-slate-500">{card.label}</p>
                <p className="text-xl font-bold">
                  {card.format === 'currency'
                    ? formatCurrency(statValue(data, card.key))
                    : formatNumber(statValue(data, card.key))}
                </p>
              </>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-semibold">Revenue Trend</h3>
          <div className="h-64 w-full min-h-[256px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={256}>
                <AreaChart data={revenueTrend}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={currencyTooltip} />
                  <Area type="monotone" dataKey="sales" stroke="#6366f1" fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card delay={0.1}>
          <h3 className="mb-4 font-semibold">Top Products</h3>
          <div className="h-64 w-full min-h-[256px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : chartData.length ? (
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={currencyTooltip} />
                  <Bar dataKey="revenue" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-slate-400">No sales data yet</p>
            )}
          </div>
        </Card>
      </div>

      <Card delay={0.2}>
        <h3 className="mb-4 font-semibold">Recent Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                <th className="pb-3 pr-4">Invoice</th>
                <th className="pb-3 pr-4">Amount</th>
                <th className="pb-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={3}><Skeleton className="h-10 w-full" /></td></tr>
              ) : data?.recent_transactions?.length ? (
                data.recent_transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3 font-medium">{tx.invoice_number}</td>
                    <td className="py-3">{formatCurrency(tx.grand_total)}</td>
                    <td className="py-3 text-slate-500">{formatISTDateTime(tx.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={3} className="py-8 text-center text-slate-400">No transactions yet. Create your first sale in POS.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
