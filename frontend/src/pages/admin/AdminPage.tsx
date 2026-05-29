import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, CreditCard, Edit3, Power, RefreshCw, Save, Send, Shield, Trash2, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { formatCurrency, formatISTDateTime, formatNumber } from '@/lib/utils'

type Tab = 'dashboard' | 'tenants' | 'plans' | 'payments'

interface Tenant {
  id: string
  name: string
  business_type?: string
  subscription_plan?: string
  subscription_status?: string
  subscription_expires_at?: string
  is_active?: boolean
  owner?: { id: string; full_name: string; email: string; last_login_at?: string; last_active_at?: string }
}

interface Plan {
  id: string
  code: string
  name: string
  price: number
  currency: string
  duration_days: number
  duration_minutes?: number
  plan_type: string
  features: string[]
  limits: Record<string, unknown>
  is_active: boolean
  is_single_subscribe?: boolean
}

const tabs: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'tenants', label: 'Shopkeepers', icon: Users },
  { id: 'plans', label: 'Plans', icon: Shield },
  { id: 'payments', label: 'Payments', icon: CreditCard },
]

const emptyPlan = {
  code: '',
  name: '',
  price: '0',
  duration_days: '30',
  duration_minutes: '0',
  plan_type: 'monthly',
  features: 'billing,inventory,customers,reports,expenses',
  products: '500',
  monthly_invoices: '1000',
  analytics: true,
  backup: false,
  is_single_subscribe: false,
}

export function AdminPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [search, setSearch] = useState('')
  const [planForm, setPlanForm] = useState(emptyPlan)
  const [editingPlanId, setEditingPlanId] = useState('')
  const [notice, setNotice] = useState({ title: '', message: '', target: 'all', plan_code: '' })
  const [payment, setPayment] = useState({ tenant_id: '', plan_id: '', amount: '' })

  const analytics = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => (await api.get('/admin/analytics')).data,
  })
  const tenants = useQuery({
    queryKey: ['admin-tenants', search],
    queryFn: async () => (await api.get('/admin/tenants', { params: { search, page_size: 50 } })).data,
  })
  const plans = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => (await api.get('/admin/plans')).data as Promise<Plan[]>,
  })
  const payments = useQuery({
    queryKey: ['admin-payments'],
    queryFn: async () => (await api.get('/admin/payments')).data,
  })
  const createPlan = useMutation({
    mutationFn: () => {
      const payload = {
      code: planForm.code.trim(),
      name: planForm.name.trim(),
      price: Number(planForm.price || 0),
      currency: 'INR',
      duration_days: Number(planForm.duration_days || 0),
      duration_minutes: Number(planForm.duration_minutes || 0),
      plan_type: planForm.plan_type,
      features: planForm.features.split(',').map((item) => item.trim()).filter(Boolean),
      limits: {
        products: Number(planForm.products || 0),
        monthly_invoices: Number(planForm.monthly_invoices || 0),
        analytics: planForm.analytics,
        backup: planForm.backup,
      },
      is_active: true,
      is_single_subscribe: planForm.is_single_subscribe,
      }
      return editingPlanId ? api.patch(`/admin/plans/${editingPlanId}`, payload) : api.post('/admin/plans', payload)
    },
    onSuccess: () => {
      toast.success(editingPlanId ? 'Plan updated' : 'Plan created')
      setPlanForm(emptyPlan)
      setEditingPlanId('')
      qc.invalidateQueries({ queryKey: ['admin-plans'] })
    },
    onError: () => toast.error('Could not save plan'),
  })

  const deletePlan = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/plans/${id}`),
    onSuccess: () => {
      toast.success('Plan deleted')
      setEditingPlanId('')
      setPlanForm(emptyPlan)
      qc.invalidateQueries({ queryKey: ['admin-plans'] })
    },
    onError: () => toast.error('Could not delete plan'),
  })

  const updateTenantStatus = useMutation({
    mutationFn: ({ id, is_active, reason }: { id: string; is_active: boolean; reason?: string }) => api.patch(`/admin/tenants/${id}/status`, { is_active, reason }),
    onSuccess: () => {
      toast.success('Shopkeeper status updated')
      qc.invalidateQueries({ queryKey: ['admin-tenants'] })
    },
  })

  const deleteTenant = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/tenants/${id}`),
    onSuccess: () => {
      toast.success('Shopkeeper and all related data deleted')
      qc.invalidateQueries({ queryKey: ['admin-tenants'] })
      qc.invalidateQueries({ queryKey: ['admin-analytics'] })
    },
  })

  const recordPayment = useMutation({
    mutationFn: () => api.post('/admin/payments', {
      tenant_id: payment.tenant_id,
      plan_id: payment.plan_id,
      amount: Number(payment.amount || 0),
      provider: 'manual',
      status: 'paid',
    }),
    onSuccess: () => {
      toast.success('Payment recorded and subscription activated')
      setPayment({ tenant_id: '', plan_id: '', amount: '' })
      qc.invalidateQueries({ queryKey: ['admin-payments'] })
      qc.invalidateQueries({ queryKey: ['admin-tenants'] })
      qc.invalidateQueries({ queryKey: ['admin-analytics'] })
    },
    onError: () => toast.error('Could not record payment'),
  })

  const sendNotification = useMutation({
    mutationFn: () => api.post('/admin/notifications/broadcast', {
      title: notice.title,
      message: notice.message,
      target: notice.target,
      plan_code: notice.plan_code || undefined,
      type: 'admin',
      severity: 'normal',
    }),
    onSuccess: (res) => {
      toast.success(`Notification sent to ${res.data.recipients} shopkeepers`)
      setNotice({ title: '', message: '', target: 'all', plan_code: '' })
    },
    onError: () => toast.error('Could not send notification'),
  })

  const runAutomation = useMutation({
    mutationFn: () => api.post('/admin/automations/subscription-reminders/run'),
    onSuccess: (res) => toast.success(`Created ${res.data.reminders_created} reminders`),
    onError: () => toast.error('Automation failed'),
  })

  const tenantRows: Tenant[] = tenants.data?.items || []
  const planRows: Plan[] = plans.data || []
  const visibleLimits = (limits: Record<string, unknown> = {}) => {
    const { staff_accounts: _staffAccounts, ...rest } = limits
    return rest
  }

  const editPlan = (plan: Plan) => {
    setEditingPlanId(plan.id)
    setPlanForm({
      code: plan.code,
      name: plan.name,
      price: String(plan.price),
      duration_days: String(plan.duration_days),
      duration_minutes: String(plan.duration_minutes || ''),
      plan_type: plan.plan_type,
      features: (plan.features || []).join(','),
      products: String(plan.limits?.products || ''),
      monthly_invoices: String(plan.limits?.monthly_invoices || ''),
      analytics: Boolean(plan.limits?.analytics),
      backup: Boolean(plan.limits?.backup),
      is_single_subscribe: Boolean(plan.is_single_subscribe),
    })
    setTab('plans')
  }

  const changeTenantStatus = (tenant: Tenant) => {
    const nextActive = !tenant.is_active
    let reason = ''
    if (!nextActive) {
      reason = window.prompt(`Reason for disabling ${tenant.name}?`, 'Account disabled by admin') || ''
      if (!reason.trim()) return
    }
    updateTenantStatus.mutate({ id: tenant.id, is_active: nextActive, reason: reason.trim() || undefined })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">SaaS Admin Panel</h2>
          <p className="text-slate-500">Professional SaaS operations for subscriptions, shopkeepers, and revenue</p>
        </div>
        <Button variant="secondary" loading={runAutomation.isPending} onClick={() => runAutomation.mutate()} tooltip="Run expiry reminders and mark overdue subscriptions as expired.">
          <RefreshCw className="h-4 w-4" /> Run Automations
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white/70 p-2 dark:border-slate-800 dark:bg-slate-900/60">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            title={`Open ${item.label} section`}
            className={`flex min-w-fit items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${tab === item.id ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <item.icon className="h-4 w-4" /> {item.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Shopkeepers" value={formatNumber(analytics.data?.total_tenants || 0)} />
          <Metric label="Active subscriptions" value={formatNumber(analytics.data?.active_subscriptions || 0)} tone="success" />
          <Metric label="Pending payment" value={formatNumber(analytics.data?.pending_subscriptions || 0)} />
          <Metric label="Subscription revenue" value={formatCurrency(analytics.data?.subscription_revenue || 0)} tone="success" />
          <Card className="sm:col-span-2">
            <h3 className="mb-4 font-semibold">Subscription Mix</h3>
            <div className="space-y-2">
              {analytics.data?.plan_stats?.map((item: { _id: string; count: number }) => (
                <div key={item._id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                  <span className="capitalize">{item._id || 'unknown'}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </Card>
          <Card className="sm:col-span-2">
            <h3 className="mb-4 font-semibold">Broadcast Notification</h3>
            <div className="grid gap-3">
              <Input label="Title" value={notice.title} onChange={(e) => setNotice({ ...notice, title: e.target.value })} />
              <textarea value={notice.message} onChange={(e) => setNotice({ ...notice, message: e.target.value })} placeholder="Message for shopkeepers" className="min-h-24 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
              <Button loading={sendNotification.isPending} onClick={() => sendNotification.mutate()} tooltip="Send this notification to all shopkeepers.">
                <Send className="h-4 w-4" /> Send to all
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'tenants' && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shop, owner, phone..." className="max-w-sm" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-slate-500 dark:border-slate-700"><th className="pb-3">Shopkeeper</th><th className="pb-3">Plan</th><th className="pb-3">Expiry</th><th className="pb-3">Last login</th><th className="pb-3 text-right">Actions</th></tr></thead>
              <tbody>
                {tenantRows.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3"><p className="font-medium">{tenant.name}</p><p className="text-xs text-slate-500">{tenant.owner?.email || tenant.business_type}</p></td>
                    <td className="py-3 capitalize">{tenant.subscription_plan || 'trial'} <span className="text-xs text-slate-400">({tenant.subscription_status || 'trialing'})</span></td>
                    <td className="py-3 text-slate-500">{tenant.subscription_expires_at ? formatISTDateTime(tenant.subscription_expires_at, true) : 'Lifetime'}</td>
                    <td className="py-3 text-slate-500">{tenant.owner?.last_login_at ? formatISTDateTime(tenant.owner.last_login_at) : 'Never'}</td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => changeTenantStatus(tenant)} tooltip="Suspend or activate this shopkeeper account.">
                          <Power className={`h-4 w-4 ${tenant.is_active === false ? 'text-red-500' : 'text-emerald-600'}`} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => window.confirm(`Permanently delete ${tenant.name} and all related shop data?`) && deleteTenant.mutate(tenant.id)} tooltip="Permanently delete this shopkeeper and all related data.">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'plans' && (
        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <Card>
            <h3 className="mb-4 font-semibold">{editingPlanId ? 'Edit Plan' : 'Create Plan'}</h3>
            <div className="grid gap-3">
              <Input label="Code" value={planForm.code} onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })} placeholder="starter" />
              <Input label="Plan name" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
              <div className="grid grid-cols-3 gap-3">
                <Input label="Price" type="number" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} />
                <Input label="Duration days" type="number" value={planForm.duration_days} onChange={(e) => setPlanForm({ ...planForm, duration_days: e.target.value })} />
                <Input label="Minutes" type="number" value={planForm.duration_minutes} onChange={(e) => setPlanForm({ ...planForm, duration_minutes: e.target.value })} />
              </div>
              <Input label="Features" value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} />
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={planForm.is_single_subscribe}
                  onChange={(e) => setPlanForm({ ...planForm, is_single_subscribe: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Single subscribe (one subscription per shop)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Products" type="number" value={planForm.products} onChange={(e) => setPlanForm({ ...planForm, products: e.target.value })} />
                <Input label="Invoices/mo" type="number" value={planForm.monthly_invoices} onChange={(e) => setPlanForm({ ...planForm, monthly_invoices: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" loading={createPlan.isPending} onClick={() => createPlan.mutate()} tooltip="Save this subscription plan for shopkeeper checkout.">
                  <Save className="h-4 w-4" /> {editingPlanId ? 'Update plan' : 'Create plan'}
                </Button>
                {editingPlanId && <Button variant="secondary" onClick={() => { setEditingPlanId(''); setPlanForm(emptyPlan) }} tooltip="Cancel plan editing.">Cancel</Button>}
              </div>
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {planRows.map((plan) => (
              <Card key={plan.id}>
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="font-bold">{plan.name}</h3><p className="text-sm text-slate-500">{plan.code} · {plan.plan_type} · {plan.is_single_subscribe ? 'single subscribe' : 'multi subscribe'}</p></div>
                  <span className={`rounded-full px-2 py-1 text-xs ${plan.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{plan.is_active ? 'active' : 'disabled'}</span>
                </div>
                <p className="mt-4 text-2xl font-bold">{formatCurrency(plan.price)}</p>
                <p className="text-sm text-slate-500">{plan.duration_minutes ? `${plan.duration_minutes} minutes` : `${plan.duration_days || 'Lifetime'} days`} · {plan.features?.join(', ')}</p>
                <pre className="mt-3 max-h-28 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(visibleLimits(plan.limits), null, 2)}</pre>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => editPlan(plan)} tooltip="Edit this plan's price, features, duration, and limits.">
                    <Edit3 className="h-4 w-4" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" loading={deletePlan.isPending} onClick={() => window.confirm(`Delete ${plan.name}?`) && deletePlan.mutate(plan.id)} tooltip="Delete this subscription plan.">
                    <Trash2 className="h-4 w-4 text-red-500" /> Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <Card>
            <h3 className="mb-4 font-semibold">Record Manual Payment</h3>
            <div className="grid gap-3">
              <select value={payment.tenant_id} onChange={(e) => setPayment({ ...payment, tenant_id: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                <option value="">Select shopkeeper</option>
                {tenantRows.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
              </select>
              <select value={payment.plan_id} onChange={(e) => {
                const plan = planRows.find((p) => p.id === e.target.value)
                setPayment({ ...payment, plan_id: e.target.value, amount: plan ? String(plan.price) : payment.amount })
              }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                <option value="">Select plan</option>
                {planRows.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
              </select>
              <Input label="Amount" type="number" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
              <Button loading={recordPayment.isPending} onClick={() => recordPayment.mutate()} tooltip="Record payment and activate the selected subscription immediately.">Record and activate</Button>
            </div>
          </Card>
          <Card>
            <h3 className="mb-4 font-semibold">Billing History</h3>
            <div className="space-y-2">
              {payments.data?.map((row: { id: string; tenant_id: string; plan_name: string; amount: number; status: string; created_at: string }) => (
                <div key={row.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
                  <div><p className="font-medium">{row.plan_name}</p><p className="text-xs text-slate-500">{row.tenant_id}</p></div>
                  <div className="text-right"><p className="font-bold">{formatCurrency(row.amount)}</p><p className="text-xs capitalize text-slate-500">{row.status}</p></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone === 'success' ? 'text-emerald-600' : tone === 'danger' ? 'text-red-600' : ''}`}>{value}</p>
    </Card>
  )
}
