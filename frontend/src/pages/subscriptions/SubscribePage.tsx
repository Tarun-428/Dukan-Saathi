import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, CreditCard, LogOut, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'

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
  limits: Record<string, number | boolean>
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

function planDuration(plan: Plan) {
  if (plan.duration_minutes) return `${plan.duration_minutes} minutes`
  if (plan.plan_type === 'lifetime') return 'Lifetime'
  return `${plan.duration_days} days`
}

export function SubscribePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const plans = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => (await api.get('/subscriptions/plans')).data as Plan[],
  })
  const current = useQuery({
    queryKey: ['subscription-current'],
    queryFn: async () => (await api.get('/subscriptions/me')).data,
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
      toast.success('Subscription activated')
      navigate('/plan', { replace: true })
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || (error instanceof Error ? error.message : 'Payment failed'))
    },
  })

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 font-bold text-white">S</div>
          <div>
            <h1 className="text-xl font-bold">Choose your Sathi plan</h1>
            <p className="text-sm text-slate-500">Your shop workspace unlocks after successful payment.</p>
          </div>
        </div>
        <Button variant="ghost" onClick={handleLogout} tooltip="Logout and return to landing page.">
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>

      <div className="mx-auto mt-8 max-w-7xl">
        {current.data?.status && current.data.status !== 'active' && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            Current status: <strong className="capitalize">{current.data.status}</strong>. Select a plan and complete payment to enter the app.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {plans.data?.map((plan) => (
            <Card key={plan.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{plan.name}</h2>
                  <p className="text-sm capitalize text-slate-500">{plan.plan_type} · {planDuration(plan)}</p>
                </div>
                <Shield className="h-5 w-5 text-indigo-500" />
              </div>
              <p className="mt-5 text-3xl font-bold">{formatCurrency(plan.price)}</p>
              <div className="mt-5 space-y-2 text-sm">
                <Feature label={`${plan.limits.products ?? 'Unlimited'} products`} />
                <Feature label={`${plan.limits.monthly_invoices ?? 'Unlimited'} invoices/month`} />
                {plan.features.slice(0, 6).map((feature) => <Feature key={feature} label={feature.replace(/_/g, ' ')} />)}
              </div>
              <Button className="mt-6 w-full" loading={checkout.isPending} onClick={() => checkout.mutate(plan)} tooltip="Pay securely using Razorpay and activate this plan.">
                <CreditCard className="h-4 w-4" /> Subscribe
              </Button>
            </Card>
          ))}
        </div>
      </div>
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
