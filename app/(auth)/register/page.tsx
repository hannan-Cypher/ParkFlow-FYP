'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Phone, User, Lock, Mail, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

// ── Password strength helper ───────────────────────────────────────────────

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-red-500' }
  if (score <= 4) return { score: 2, label: 'Fair', color: 'bg-amber-500' }
  return { score: 3, label: 'Strong', color: 'bg-emerald-500' }
}

// ── Inner component (uses useSearchParams) ────────────────────────────────

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const phoneFromUrl = searchParams.get('phone') || ''
  const sessionId = searchParams.get('session') || ''

  const [phone, setPhone] = useState(phoneFromUrl)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const strength = getPasswordStrength(password)

  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    if (!phoneFromUrl) {
      const cleaned = phone.replace(/[\s\-\+\(\)]/g, '')
      if (!/^(923[0-5]\d{8}|03[0-5]\d{8}|3[0-5]\d{8})$/.test(cleaned)) {
        errors.phone = 'Enter a valid Pakistani mobile number (e.g. 03001234567)'
      }
    }

    if (fullName.trim().length < 2) {
      errors.fullName = 'Name must be at least 2 characters'
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      errors.password = 'Min 8 characters, 1 uppercase, 1 lowercase, 1 number'
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords don't match"
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validate()) return

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneFromUrl || phone,
          full_name: fullName.trim(),
          password,
          email: email.trim() || undefined,
          session_id: sessionId || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Registration failed')
        setLoading(false)
        return
      }

      // Cookie is set by API — redirect to customer dashboard, prefer UUID URL when available
      const userId = data.user?.id
      if (userId) {
        router.push(`/customer/${userId}`)
      } else {
        router.push('/customer')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  if (!mounted) return null

  const inputClass = (field: string) =>
    `block w-full pl-10 pr-3 py-3 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
      fieldErrors[field]
        ? 'border-red-400 dark:border-red-500'
        : 'border-gray-300 dark:border-slate-600'
    }`

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-4">
            <span className="text-white font-bold text-lg">P</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {sessionId ? 'Link this parking session to your new account' : 'Join ParkFlow — track your parking sessions'}
          </p>
        </div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-transparent dark:border-slate-700"
        >
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Phone */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  readOnly={!!phoneFromUrl}
                  placeholder="03001234567"
                  className={`${inputClass('phone')} ${phoneFromUrl ? 'bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed text-slate-500 dark:text-slate-400' : ''}`}
                />
                {phoneFromUrl && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                )}
              </div>
              {phoneFromUrl && (
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Phone pre-filled from your parking ticket
                </p>
              )}
              {fieldErrors.phone && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>
              )}
            </motion.div>

            {/* Full Name */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Ahmed Khan"
                  className={inputClass('fullName')}
                />
              </div>
              {fieldErrors.fullName && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.fullName}</p>
              )}
            </motion.div>

            {/* Password */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 8 chars, 1 upper, 1 lower, 1 number"
                  className={`${inputClass('password')} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                    : <Eye className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                  }
                </button>
              </div>
              {/* Strength bar */}
              {password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                      style={{ width: `${(strength.score / 3) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-10">{strength.label}</span>
                </div>
              )}
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>
              )}
            </motion.div>

            {/* Confirm Password */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className={`${inputClass('confirmPassword')} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirm
                    ? <EyeOff className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                    : <Eye className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                  }
                </button>
              </div>
              {confirmPassword && password === confirmPassword && (
                <div className="mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">Passwords match</span>
                </div>
              )}
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.confirmPassword}</p>
              )}
            </motion.div>

            {/* Email (optional) */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Email <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass('email')}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                You can also use email to log in later
              </p>
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>
              )}
            </motion.div>

            {/* Submit */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating account…
                  </span>
                ) : (
                  'Create Account'
                )}
              </button>
            </motion.div>

            {/* Login link */}
            <div className="text-center pt-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-primary-500 hover:text-primary-600">
                  Log in
                </Link>
              </p>
            </div>
          </form>
        </motion.div>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          <Link href="/" className="text-primary-500 hover:text-primary-600 font-medium">
            ← Back to home
          </Link>
        </p>
      </motion.div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
