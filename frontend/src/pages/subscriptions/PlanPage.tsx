import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Check, CreditCard, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatISTDateTime, formatNumber, parseBackendDate } from '@/lib/utils'

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
  }
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
  limits: Record<string, number | boolean | string | null>
}

interface SubscriptionDetails {
  id?: string
  plan_name?: string
  plan_code?: string
  status?: string
  starts_at?: string
  expires_at?: string | null
  auto_renew?: boolean
  payment_status?: string
  plan?: Plan | null
  latest_payment?: {
    amount?: number
    currency?: string
    status?: string
    provider?: string
    created_at?: string
    verified_at?: string
  } | null
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

function formatDate(value?: string | null) {
  return value ? formatISTDateTime(value, true) : 'Lifetime'
}

function daysRemaining(value?: string | null) {
  if (!value) return 'No expiry'
  const diff = parseBackendDate(value).getTime() - Date.now()
  const days = Math.ceil(diff / 86_400_000)
  if (days < 0) return 'Expired'
  if (days === 0) return 'Expires today'
  return `${days} day${days === 1 ? '' : 's'} left`
}

function planDuration(plan?: Pick<Plan, 'duration_minutes' | 'duration_days' | 'plan_type'> | null) {
  if (plan?.duration_minutes) return `${plan.duration_minutes} minutes`
  if (plan?.plan_type === 'lifetime') return 'Lifetime'
  return plan?.duration_days ? `${plan.duration_days} days` : 'Lifetime'
}

function limitValue(value: number | boolean | string | null | undefined) {
  if (value === undefined || value === null || value === -1) return 'Unlimited'
  if (typeof value === 'boolean') return value ? 'Included' : 'Not included'
  if (typeof value === 'number') return formatNumber(value)
  return String(value)
}

export function PlanPage() {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const current = useQuery({
    queryKey: ['subscription-current'],
    queryFn: async () => (await api.get<SubscriptionDetails>('/subscriptions/me')).data,
    refetchInterval: 60000,
  })
  const plans = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => (await api.get<Plan[]>('/subscriptions/plans')).data,
  })

  const checkout = useMutation({
    mutationFn: async (plan: Plan) => {
      const { data } = await api.post('/subscriptions/checkout', { plan_id: plan.id, provider: 'razorpay' })
      if (data.subscription) return { activated: true }
      const loaded = await loadRazorpayScript()
      if (!loaded || !window.Razorpay) throw new Error('Could not load Razorpay checkout')
      return await new Promise<{ activated: boolean }>((resolve, reject) => {
        const Razorpay = window.Razorpay
        if (!Razorpay) {
          reject(new Error('Razorpay checkout is not available'))
          return
        }
        const rz = new Razorpay({
          key: data.key_id,
          amount: data.amount,
          currency: data.currency,
          name: data.name,
          description: data.description,
          order_id: data.order_id,
          prefill: { name: user?.full_name, email: user?.email },
          theme: { color: '#4f46e5' },
          handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            try {
              await api.post('/subscriptions/verify-payment', {
                checkout_id: data.id,
                provider_payment_id: response.razorpay_payment_id,
                provider_order_id: response.razorpay_order_id,
                provider_signature: response.razorpay_signature,
                status: 'paid',
              })
              resolve({ activated: true })
            } catch (error) {
              reject(error)
            }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
        })
        rz.open()
      })
    },
    onSuccess: () => {
      toast.success('Plan updated')
      qc.invalidateQueries({ queryKey: ['subscription-current'] })
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || (error instanceof Error ? error.message : 'Plan change failed'))
    },
  })

  const subscription = current.data
  const activePlan = subscription?.plan
  const limits = activePlan?.limits || {}
  const latestPayment = subscription?.latest_payment
  const subscriptionStatus = subscription?.status || 'pending'
  const paymentStatus = latestPayment?.status || subscription?.payment_status || 'unpaid'

  return (
    <div className="space-y-6">
      <div>
        <p className="text-slate-500">Subscription</p>
        <h2 className="text-2xl font-bold">Plan</h2>
      </div>

      <Card delay={0.05} hover={false}>
        {current.isLoading ? (
          <Skeleton className="h-44 w-full" />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-300">
                <ShieldCheck className="h-4 w-4" />
                <span>Current plan</span>
              </div>
              <h3 className="mt-2 text-2xl font-bold">{subscription?.plan_name || activePlan?.name || 'No active plan'}</h3>
              <p className="mt-1 text-sm capitalize text-slate-500">
                {activePlan?.plan_type || subscription?.plan_code || 'Plan'} · {subscriptionStatus.replace(/_/g, ' ')}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-lg bg-emerald-50 px-2 py-1 font-medium capitalize text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{subscriptionStatus}</span>
                <span className="rounded-lg bg-slate-100 px-2 py-1 font-medium capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">{paymentStatus}</span>
                <span className="rounded-lg bg-amber-50 px-2 py-1 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{daysRemaining(subscription?.expires_at)}</span>
              </div>
            </div>

            <div className="grid gap-3 text-sm">
              <PlanRow label="Started" value={formatDate(subscription?.starts_at)} />
              <PlanRow label="Expires" value={formatDate(subscription?.expires_at)} highlight />
              <PlanRow label="Access ends" value={formatDate(subscription?.expires_at)} />
              <PlanRow label="Auto renew" value={subscription?.auto_renew ? 'Enabled' : 'Disabled'} />
            </div>

            <div className="grid gap-3 text-sm">
              <PlanRow label="Plan price" value={formatCurrency(Number(activePlan?.price || latestPayment?.amount || 0), activePlan?.currency || latestPayment?.currency || 'INR')} />
              <PlanRow label="Duration" value={planDuration(activePlan)} />
              <PlanRow label="Products limit" value={limitValue(limits.products)} />
              <PlanRow label="Invoices/month" value={limitValue(limits.monthly_invoices)} />
            </div>
          </div>
        )}
      </Card>

      <div>
        <h3 className="font-semibold">Change plan</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.isLoading ? (
            <>
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-72 w-full" />
            </>
          ) : plans.data?.map((plan) => {
            const isCurrent = plan.code === subscription?.plan_code
            const activePrice = Number(activePlan?.price || 0)
            const isUpgrade = Number(plan.price || 0) > activePrice
            return (
              <Card key={plan.id} className="flex flex-col" delay={0.05}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-bold">{plan.name}</h4>
                    <p className="text-sm capitalize text-slate-500">{plan.plan_type} · {planDuration(plan)}</p>
                  </div>
                  {isUpgrade ? <Sparkles className="h-5 w-5 text-amber-500" /> : <ShieldCheck className="h-5 w-5 text-indigo-500" />}
                </div>
                <p className="mt-5 text-3xl font-bold">{formatCurrency(plan.price, plan.currency)}</p>
                <div className="mt-5 space-y-2 text-sm">
                  <Feature label={`${limitValue(plan.limits.products)} products`} />
                  <Feature label={`${limitValue(plan.limits.monthly_invoices)} invoices/month`} />
                  {plan.features.slice(0, 5).map((feature) => <Feature key={feature} label={feature.replace(/_/g, ' ')} />)}
                </div>
                <Button
                  className="mt-auto w-full"
                  loading={checkout.isPending}
                  disabled={isCurrent && subscriptionStatus === 'active'}
                  onClick={() => checkout.mutate(plan)}
                  tooltip={isCurrent ? 'This is your current active plan.' : 'Change to this plan.'}
                >
                  {isCurrent ? <Check className="h-4 w-4" /> : isUpgrade ? <CreditCard className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                  {isCurrent ? 'Current plan' : isUpgrade ? 'Upgrade plan' : 'Change plan'}
                </Button>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PlanRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
      <span className="flex items-center gap-2 text-slate-500">
        {highlight && <CalendarClock className="h-4 w-4 text-amber-500" />}
        {label}
      </span>
      <strong className="text-right">{value}</strong>
    </div>
  )
}

function Feature({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
      <Check className="h-4 w-4 text-emerald-500" />
      <span className="capitalize">{label}</span>
    </div>
  )
}
