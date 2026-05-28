import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordField } from '@/components/auth/PasswordField'
import { useAuthStore } from '@/stores/authStore'

const BUSINESS_TYPES = [
  'grocery', 'clothing', 'electronics', 'pharmacy', 'hardware', 'furniture',
  'bakery', 'restaurant', 'cosmetics', 'mobile_accessories', 'wholesale',
  'general_store', 'supermarket', 'stationery', 'other',
]

const schema = z.object({
  full_name: z.string().min(2),
  shop_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  business_type: z.string(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().min(2),
  currency: z.string().min(3),
  gst_number: z.string().optional(),
  default_tax_rate: z.number().min(0).max(100),
  logo_url: z.string().optional(),
  upi_id: z.string().regex(/^[\w.-]+@[\w.-]+$/, 'Enter a valid UPI ID').optional().or(z.literal('')),
})

type Form = z.infer<typeof schema>

export function SignUpPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { business_type: 'general_store', country: 'IN', currency: 'INR', default_tax_rate: 0 },
  })
  const logo = watch('logo_url')

  const handleLogo = (file?: File) => {
    if (!file) return
    if (file.size > 500_000) {
      toast.error('Logo should be under 500 KB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setValue('logo_url', String(reader.result), { shouldDirty: true })
    reader.readAsDataURL(file)
  }

  const onSubmit = async (data: Form) => {
    setLoading(true)
    try {
      const { data: tokens } = await api.post('/auth/signup', data)
      const { data: user } = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      setAuth(user, tokens.access_token, tokens.refresh_token)
      toast.success('Shop created. Check your email for the OTP.')
      navigate(user.is_verified ? '/onboarding' : '/verify-email')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-lg">
        <h1 className="text-3xl font-bold gradient-text">Start your shop on Sathi</h1>
        <p className="mt-2 text-slate-500">Free trial · No credit card required</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4 glass rounded-2xl p-6">
          <Input label="Your name" error={errors.full_name?.message} {...register('full_name')} />
          <Input label="Shop name" error={errors.shop_name?.message} {...register('shop_name')} />
          <div className="rounded-xl border border-slate-200 bg-white/60 p-4 dark:border-slate-700 dark:bg-slate-900/60">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Shop logo</label>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-lg font-bold text-slate-400 dark:bg-slate-800">
                {logo ? <img src={logo} alt="Shop logo preview" className="h-full w-full object-cover" /> : 'Logo'}
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => handleLogo(e.target.files?.[0])}
                className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-600"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-600">Business type</label>
              <select
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900/80"
                {...register('business_type')}
              >
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">Currency</label>
              <select
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900/80"
                {...register('currency')}
              >
                <option value="INR">INR - Indian Rupee</option>
                <option value="USD">USD - US Dollar</option>
                <option value="AED">AED - UAE Dirham</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>
          </div>
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Phone" {...register('phone')} />
          <Input label="Shop address" {...register('address')} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="City" {...register('city')} />
            <Input label="State" {...register('state')} />
            <Input label="Country" {...register('country')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="GST / VAT number" {...register('gst_number')} />
            <Input label="Default tax %" type="number" step="0.01" error={errors.default_tax_rate?.message} {...register('default_tax_rate', { valueAsNumber: true })} />
          </div>
          <Input label="UPI ID" placeholder="yourname@bank" error={errors.upi_id?.message} {...register('upi_id')} />
          <PasswordField
            label="Password"
            visible={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
            error={errors.password?.message}
            registration={register('password')}
          />
          <Button type="submit" className="w-full" loading={loading} tooltip="Create your owner account and register the shop workspace.">Create my shop</Button>
        </form>
        <p className="mt-4 text-center text-sm">
          Already have an account? <Link to="/login" className="text-indigo-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </motion.div>
  )
}
