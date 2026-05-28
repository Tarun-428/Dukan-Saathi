import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordField } from '@/components/auth/PasswordField'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const requestOtp = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email.trim()) {
      toast.error('Email is required')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email: email.trim() })
      toast.success('OTP sent. Check your email.')
      setStep('reset')
    } catch {
      toast.error('Could not send OTP')
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', {
        email: email.trim(),
        otp: otp.trim(),
        password,
      })
      toast.success('Password reset successful')
      navigate('/login', { replace: true })
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || 'Could not reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <h1 className="text-3xl font-bold">Reset password</h1>
        <p className="mt-2 text-slate-500">
          {step === 'email' ? 'Enter your account email to receive a verification OTP.' : 'Enter the email OTP and choose a new password.'}
        </p>

        {step === 'email' ? (
          <form onSubmit={requestOtp} className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/70">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" className="w-full" loading={loading} tooltip="Send a password reset OTP to your email.">Send OTP</Button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/70">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
            <PasswordField
              label="New password"
              value={password}
              visible={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
              onChange={setPassword}
            />
            <PasswordField
              label="Confirm password"
              value={confirmPassword}
              visible={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((value) => !value)}
              onChange={setConfirmPassword}
            />
            <Button type="submit" className="w-full" loading={loading} tooltip="Verify OTP and update your password.">Reset password</Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('email')} tooltip="Request a new OTP.">Use another email</Button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-slate-500">
          Remembered it? <Link to="/login" className="font-medium text-indigo-600 hover:underline">Back to login</Link>
        </p>
      </motion.div>
    </div>
  )
}
