import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user?.email) return
    if (!otp.trim()) {
      toast.error('OTP is required')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/verify-otp', { email: user.email, otp: otp.trim() })
      const { data } = await api.get('/auth/me')
      setUser(data)
      toast.success('Email verified')
      navigate('/onboarding', { replace: true })
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || 'Could not verify OTP')
    } finally {
      setLoading(false)
    }
  }

  const resendOtp = async () => {
    if (!user?.email) return
    setResending(true)
    try {
      await api.post('/auth/resend-verification-otp', { email: user.email })
      toast.success('A new OTP has been sent')
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || 'Could not send OTP')
    } finally {
      setResending(false)
    }
  }

  const leaveVerification = (path: '/login' | '/signup') => {
    logout()
    navigate(path, { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <h1 className="text-3xl font-bold">Verify email</h1>
        <p className="mt-2 text-slate-500">Enter the OTP sent to {user?.email}.</p>

        <form onSubmit={verifyOtp} className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/70">
          <Input label="OTP" value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" />
          <Button type="submit" className="w-full" loading={loading} tooltip="Verify your email and continue setup.">Verify OTP</Button>
          <Button type="button" variant="ghost" className="w-full" loading={resending} onClick={resendOtp} tooltip="Send a new verification OTP to your email.">
            Resend OTP
          </Button>
        </form>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-slate-500">
          <button type="button" onClick={() => leaveVerification('/login')} className="font-medium text-indigo-600 hover:underline">
            Back to login
          </button>
          <span aria-hidden="true">/</span>
          <button type="button" onClick={() => leaveVerification('/signup')} className="font-medium text-indigo-600 hover:underline">
            Create another account
          </button>
        </div>
      </motion.div>
    </div>
  )
}
