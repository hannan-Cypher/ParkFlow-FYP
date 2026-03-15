'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';

interface InviteInfo {
  email: string;
  name: string | null;
  venue_name: string | null;
}

interface FieldErrors {
  full_name?: string;
  phone?: string;
  password?: string;
  confirm_password?: string;
}

function VerifyStaffForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError('No invitation token found in the link.');
      setLoading(false);
      return;
    }

    fetch(`/api/auth/verify-staff?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setInviteInfo({ email: data.email, name: data.name, venue_name: data.venue_name });
          if (data.name) setFullName(data.name);
        } else {
          setTokenError(data.error || 'Invalid invitation link.');
        }
      })
      .catch(() => setTokenError('Failed to verify invitation. Please try again.'))
      .finally(() => setLoading(false));
  }, [token]);

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!fullName.trim()) errors.full_name = 'Full name is required';
    if (!phone.trim()) errors.phone = 'Phone number is required';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (!confirmPassword) errors.confirm_password = 'Please confirm your password';
    else if (password !== confirmPassword) errors.confirm_password = 'Passwords do not match';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/verify-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, full_name: fullName, phone, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      router.push('/staff');
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-sky-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Verifying your invitation...</p>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Invitation Invalid</h1>
          <p className="text-slate-500 mb-6">{tokenError}</p>
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl transition-all"
          >
            Go to Login
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 max-w-md w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            ParkFlow
          </h1>
          <p className="text-slate-400 text-sm mt-1">AI-Powered Valet Parking</p>
          <div className="mt-5">
            <h2 className="text-xl font-semibold text-slate-800">Complete Your Account</h2>
            <p className="text-slate-500 text-sm mt-1">You&apos;re almost ready. Fill in your details to get started.</p>
          </div>
        </div>

        {/* Read-only info */}
        <div className="mb-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
            <div className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-slate-50 text-slate-500 text-sm">
              {inviteInfo?.email}
            </div>
          </div>
          {inviteInfo?.venue_name && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Assigned Venue</label>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-sm font-medium">
                {inviteInfo.venue_name}
              </span>
            </div>
          )}
        </div>

        {/* Submit error banner */}
        <AnimatePresence>
          {submitError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{submitError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g., Ahmed Khan"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-slate-800"
            />
            <AnimatePresence>
              {fieldErrors.full_name && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-500 text-xs mt-1"
                >
                  {fieldErrors.full_name}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03XX-XXXXXXX"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-slate-800"
            />
            <AnimatePresence>
              {fieldErrors.phone && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-500 text-xs mt-1"
                >
                  {fieldErrors.phone}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <AnimatePresence>
              {fieldErrors.password && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-500 text-xs mt-1"
                >
                  {fieldErrors.password}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <AnimatePresence>
              {fieldErrors.confirm_password && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-500 text-xs mt-1"
                >
                  {fieldErrors.confirm_password}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Activating Account...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Activate Account
              </>
            )}
          </button>
        </form>

        <p className="text-center text-slate-400 text-xs mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-sky-500 hover:text-sky-600 font-medium">
            Log in
          </a>
        </p>
      </motion.div>
    </div>
  );
}

export default function VerifyStaffPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-sky-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Loading...</p>
          </div>
        </div>
      }
    >
      <VerifyStaffForm />
    </Suspense>
  );
}
