'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Eye,
  EyeOff,
  UserPlus,
  Mail,
  Phone,
  Lock,
  User,
  Check,
  AlertCircle,
  ShieldCheck,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Sparkles,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

function getPasswordStrength(password: string): {
  score: number
  label: string
  color: string
} {
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score: 20, label: 'দুর্বল (Weak)', color: 'bg-red-500' }
  if (score <= 2) return { score: 40, label: 'মোটামুটি (Fair)', color: 'bg-amber-500' }
  if (score <= 3) return { score: 60, label: 'ভালো (Good)', color: 'bg-yellow-500' }
  if (score <= 4) return { score: 80, label: 'শক্তিশালী (Strong)', color: 'bg-emerald-500' }
  return { score: 100, label: 'অত্যন্ত শক্তিশালী (Very Strong)', color: 'bg-emerald-600' }
}

export default function RegisterPage() {
  const { register, navigate, setUser } = useAppStore()

  // Form Fields
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)

  // Form States
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [registered, setRegistered] = useState(false)

  // Touched states for instant feedback
  const [nameTouched, setNameTouched] = useState(false)
  const [identifierTouched, setIdentifierTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)

  // OTP Verification state
  const [showOtpScreen, setShowOtpScreen] = useState(false)
  const [otpPhone, setOtpPhone] = useState('')
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [otpSending, setOtpSending] = useState(false)

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const resendTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current)
    }
  }, [])

  // Validation rules
  const nameValid = name.trim().length >= 2
  const nameError =
    nameTouched && !nameValid
      ? name.trim()
        ? 'নাম কমপক্ষে ২ অক্ষরের হতে হবে (Name must be at least 2 characters)'
        : 'আপনার নাম লিখুন (Name is required)'
      : ''

  const isEmail = identifier.includes('@')
  const identifierClean = identifier.trim()
  const phoneNormalized = identifierClean.replace(/[\s-]/g, '').replace(/^(\+?88)/, '')
  const identifierValid = isEmail
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifierClean)
    : /^01[3-9]\d{8}$/.test(
        phoneNormalized.startsWith('01') ? phoneNormalized : '0' + phoneNormalized
      )

  const identifierError =
    identifierTouched && identifierClean && !identifierValid
      ? isEmail
        ? 'সঠিক ইমেইল এড্রেস লিখুন (Enter a valid email address)'
        : 'সঠিক বাংলাদেশি মোবাইল নম্বর লিখুন যেমন ০১৭১XXXXXXX'
      : ''

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password])
  const passwordValid = password.length >= 6
  const passwordError =
    passwordTouched && password.length > 0 && !passwordValid
      ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে (At least 6 characters)'
      : ''

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const confirmError =
    confirmTouched && confirmPassword.length > 0 && !passwordsMatch
      ? 'পাসওয়ার্ড মিলছে না (Passwords do not match)'
      : ''

  const isFormValid =
    nameValid &&
    identifierValid &&
    passwordValid &&
    passwordsMatch &&
    agreeTerms

  // Resend OTP Countdown Timer
  const startResendTimer = (seconds: number) => {
    if (resendTimerRef.current) clearInterval(resendTimerRef.current)
    setResendCooldown(seconds)
    resendTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current) clearInterval(resendTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    setNameTouched(true)
    setIdentifierTouched(true)
    setPasswordTouched(true)
    setConfirmTouched(true)
    setFormError('')

    if (!nameValid) {
      setFormError('অনুগ্রহ করে আপনার সঠিক নাম লিখুন।')
      return
    }
    if (!identifierValid) {
      setFormError(
        isEmail
          ? 'অনুগ্রহ করে সঠিক ইমেইল এড্রেস লিখুন।'
          : 'অনুগ্রহ করে সঠিক বাংলাদেশি মোবাইল নম্বর দিন।'
      )
      return
    }
    if (!passwordValid) {
      setFormError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।')
      return
    }
    if (!passwordsMatch) {
      setFormError('উভয় পাসওয়ার্ড একই হতে হবে।')
      return
    }
    if (!agreeTerms) {
      setFormError('আমাদের শর্তাবলী ও গোপনীয়তা নীতি মেনে নেওয়া আবশ্যক।')
      return
    }

    setLoading(true)
    try {
      await register({
        name: name.trim(),
        identifier: identifier.trim(),
        password,
      })

      if (!isEmail) {
        setOtpPhone(identifier.trim())
        setShowOtpScreen(true)
        startResendTimer(60)
        toast.success('আপনার মোবাইলে ভেরিফিকেশন কোড পাঠানো হয়েছে')
      } else {
        setRegistered(true)
        toast.success('রেজিস্ট্রেশন সফল হয়েছে!')
        setTimeout(() => {
          navigate('home')
        }, 2000)
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'রেজিস্ট্রেশন সম্পন্ন করা সম্ভব হয়নি। আবার চেষ্টা করুন।'
      setFormError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  // OTP Handlers
  const handleOtpDigitChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[index] = digit
    setOtpDigits(next)
    setOtpError('')
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length > 0) {
      const next = pasted.split('').concat(Array(6).fill('')).slice(0, 6)
      setOtpDigits(next)
      const focusIdx = Math.min(pasted.length, 5)
      otpInputRefs.current[focusIdx]?.focus()
    }
  }

  const handleVerifyOtp = async () => {
    if (otpLoading) return
    const otpValue = otpDigits.join('')
    if (otpValue.length !== 6) {
      setOtpError('অনুগ্রহ করে ৬ ডিজিটের ওটিপি কোড সম্পূর্ণ লিখুন।')
      return
    }

    setOtpLoading(true)
    setOtpError('')

    try {
      const token = useAppStore.getState().accessToken
      const res = await fetch('/api/auth/verify-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phone: otpPhone, code: otpValue }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'ভেরিফিকেশন সম্পন্ন হয়নি')
      }

      const curUser = useAppStore.getState().user
      if (curUser) {
        setUser({ ...curUser, isVerified: true })
      }

      toast.success('মোবাইল নম্বর সফলভাবে যাচাই হয়েছে!')
      setRegistered(true)
      setTimeout(() => {
        navigate('home')
      }, 1500)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'ওটিপি কোড ভুল বা মেয়াদোত্তীর্ণ হয়েছে।'
      setOtpError(message)
    } finally {
      setOtpLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || otpSending) return
    setOtpSending(true)
    setOtpError('')

    try {
      const token = useAppStore.getState().accessToken
      const res = await fetch('/api/auth/verify-phone/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phone: otpPhone }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'ওটিপি পুনরায় পাঠানো সম্ভব হয়নি')
      }
      startResendTimer(60)
      toast.success('নতুন ওটিপি কোড পাঠানো হয়েছে')
    } catch {
      setOtpError('এসএমএস সার্ভিস সাময়িকভাবে ব্যস্ত। অনুগ্রহ করে একটু পর চেষ্টা করুন।')
    } finally {
      setOtpSending(false)
    }
  }

  // Registration Success View
  if (registered) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 bg-stone-50">
        <div
          role="status"
          aria-live="polite"
          className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-100 p-8 text-center"
        >
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 stroke-[3]" />
          </div>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">স্বাগতম! (Welcome)</h2>
          <p className="text-stone-600 text-sm mb-6">
            আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে। হোমপেজে রিডাইরেক্ট করা হচ্ছে...
          </p>
          <div className="flex justify-center items-center gap-2 text-emerald-700 text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>অপেক্ষা করুন...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[85vh] py-8 sm:py-12 px-4 flex items-center justify-center bg-stone-50/60">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-emerald-700 font-bold text-xl sm:text-2xl tracking-tight hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-6 h-6 text-amber-500" />
            <span>খাঁটি খাদ্য (Khati Khadyo)</span>
          </Link>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            ১০০% খাঁটি ও নির্ভেজাল গ্রোসারি পণ্যের বিশ্বস্ত ঠিকানা
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-stone-200/80 p-6 sm:p-8">
          <AnimatePresence mode="wait">
            {!showOtpScreen ? (
              /* Single-View Registration Form */
              <motion.div
                key="register-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6">
                  <h1 className="text-xl sm:text-2xl font-bold text-stone-900">
                    অ্যাকাউন্ট তৈরি করুন
                  </h1>
                  <p className="text-xs sm:text-sm text-stone-600 mt-1">
                    দ্রুত অর্ডার ও রিওয়ার্ড পয়েন্ট পেতে তথ্য দিয়ে যুক্ত হোন
                  </p>
                </div>

                {formError && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="register-name"
                      className="text-xs sm:text-sm font-medium text-stone-700"
                    >
                      আপনার পূর্ণ নাম <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="register-name"
                        type="text"
                        autoComplete="name"
                        placeholder="যেমন: মোঃ আব্দুল্লাহ"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value)
                          if (!nameTouched) setNameTouched(true)
                        }}
                        onBlur={() => setNameTouched(true)}
                        aria-invalid={Boolean(nameError)}
                        aria-describedby={nameError ? 'name-error' : undefined}
                        className={`pl-10 h-11 text-sm rounded-xl border transition-colors ${
                          nameError
                            ? 'border-red-400 focus-visible:ring-red-400'
                            : 'border-stone-300 focus-visible:ring-emerald-500'
                        }`}
                      />
                    </div>
                    {nameError && (
                      <p id="name-error" className="text-xs text-red-600 mt-1">
                        {nameError}
                      </p>
                    )}
                  </div>

                  {/* Phone or Email */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="register-identifier"
                      className="text-xs sm:text-sm font-medium text-stone-700"
                    >
                      মোবাইল নম্বর অথবা ইমেইল <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      {isEmail ? (
                        <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      ) : (
                        <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      )}
                      <Input
                        id="register-identifier"
                        type="text"
                        autoComplete="username"
                        placeholder="০১৭১XXXXXXX অথবা email@example.com"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value)
                          if (!identifierTouched) setIdentifierTouched(true)
                        }}
                        onBlur={() => setIdentifierTouched(true)}
                        aria-invalid={Boolean(identifierError)}
                        aria-describedby={identifierError ? 'identifier-error' : undefined}
                        className={`pl-10 h-11 text-sm rounded-xl border transition-colors ${
                          identifierError
                            ? 'border-red-400 focus-visible:ring-red-400'
                            : 'border-stone-300 focus-visible:ring-emerald-500'
                        }`}
                      />
                    </div>
                    {identifierError && (
                      <p id="identifier-error" className="text-xs text-red-600 mt-1">
                        {identifierError}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="register-password"
                      className="text-xs sm:text-sm font-medium text-stone-700"
                    >
                      পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="register-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          if (!passwordTouched) setPasswordTouched(true)
                        }}
                        onBlur={() => setPasswordTouched(true)}
                        aria-invalid={Boolean(passwordError)}
                        aria-describedby={passwordError ? 'password-error' : undefined}
                        className={`pl-10 pr-10 h-11 text-sm rounded-xl border transition-colors ${
                          passwordError
                            ? 'border-red-400 focus-visible:ring-red-400'
                            : 'border-stone-300 focus-visible:ring-emerald-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {password.length > 0 && (
                      <div className="mt-1.5">
                        <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${passwordStrength.color} transition-all duration-300`}
                            style={{ width: `${passwordStrength.score}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-stone-500 mt-1 block">
                          শক্তি: {passwordStrength.label}
                        </span>
                      </div>
                    )}
                    {passwordError && (
                      <p id="password-error" className="text-xs text-red-600 mt-1">
                        {passwordError}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="register-confirm-password"
                      className="text-xs sm:text-sm font-medium text-stone-700"
                    >
                      পাসওয়ার্ড নিশ্চিত করুন <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="register-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value)
                          if (!confirmTouched) setConfirmTouched(true)
                        }}
                        onBlur={() => setConfirmTouched(true)}
                        aria-invalid={Boolean(confirmError)}
                        aria-describedby={confirmError ? 'confirm-error' : undefined}
                        className={`pl-10 pr-10 h-11 text-sm rounded-xl border transition-colors ${
                          confirmError
                            ? 'border-red-400 focus-visible:ring-red-400'
                            : 'border-stone-300 focus-visible:ring-emerald-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={
                          showConfirmPassword ? 'কনফার্ম পাসওয়ার্ড লুকান' : 'কনফার্ম পাসওয়ার্ড দেখুন'
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {confirmError && (
                      <p id="confirm-error" className="text-xs text-red-600 mt-1">
                        {confirmError}
                      </p>
                    )}
                  </div>

                  {/* Terms & Privacy Checkbox */}
                  <div className="pt-1">
                    <div className="flex items-start gap-2.5">
                      <Checkbox
                        id="register-terms"
                        checked={agreeTerms}
                        onCheckedChange={(checked) => setAgreeTerms(Boolean(checked))}
                        className="mt-0.5 rounded border-stone-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                      />
                      <Label
                        htmlFor="register-terms"
                        className="text-xs text-stone-600 leading-snug cursor-pointer select-none"
                      >
                        আমি খাঁটি খাদ্যের{' '}
                        <Link href="/terms" className="text-emerald-700 underline font-medium">
                          শর্তাবলী
                        </Link>{' '}
                        ও{' '}
                        <Link href="/privacy" className="text-emerald-700 underline font-medium">
                          গোপনীয়তা নীতি
                        </Link>{' '}
                        মেনে নিচ্ছি।
                      </Label>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={loading || !isFormValid}
                    className="w-full h-11 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50 mt-2"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>প্রসেস করা হচ্ছে...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        <span>অ্যাকাউন্ট তৈরি করুন (Create Account)</span>
                      </div>
                    )}
                  </Button>
                </form>

                {/* Footer Link to Login */}
                <div className="mt-6 pt-5 border-t border-stone-200/70 text-center">
                  <p className="text-xs sm:text-sm text-stone-600">
                    ইতিমধ্যে অ্যাকাউন্ট আছে?{' '}
                    <Link
                      href="/login"
                      className="font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2 ml-1"
                    >
                      লগইন করুন (Sign In)
                    </Link>
                  </p>
                </div>
              </motion.div>
            ) : (
              /* In-Place OTP Verification Screen */
              <motion.div
                key="otp-form"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOtpScreen(false)
                      setOtpError('')
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors mb-3"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>নম্বর পরিবর্তন করুন</span>
                  </button>
                  <h2 className="text-xl font-bold text-stone-900">মোবাইল নম্বর যাচাই করুন</h2>
                  <p className="text-xs sm:text-sm text-stone-600 mt-1">
                    <span className="font-semibold text-stone-900">{otpPhone}</span> নম্বরে ৬
                    ডিজিটের ওটিপি পাঠানো হয়েছে।
                  </p>
                </div>

                {otpError && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>{otpError}</span>
                  </div>
                )}

                {/* 6 Digit Inputs */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-stone-700">
                    ৬ ডিজিটের ওটিপি লিখুন
                  </Label>
                  <div
                    className="flex justify-between gap-2 sm:gap-2.5"
                    onPaste={handleOtpPaste}
                  >
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpInputRefs.current[idx] = el
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        aria-label={`Digit ${idx + 1}`}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-11 sm:w-12 h-12 text-center text-lg font-bold rounded-xl border border-stone-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                      />
                    ))}
                  </div>
                </div>

                {/* Verify Button */}
                <Button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otpLoading || otpDigits.join('').length !== 6}
                  className="w-full h-11 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 transition-all"
                >
                  {otpLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>যাচাই হচ্ছে...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      <span>কোড নিশ্চিত করুন</span>
                    </div>
                  )}
                </Button>

                {/* Resend Timer */}
                <div className="text-center pt-2">
                  {resendCooldown > 0 ? (
                    <p className="text-xs text-stone-500">
                      পুনরায় কোড পাঠানোর সময় বাকি:{' '}
                      <span className="font-bold text-stone-800">
                        {String(Math.floor(resendCooldown / 60)).padStart(2, '0')}:
                        {String(resendCooldown % 60).padStart(2, '0')}
                      </span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={otpSending}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2 transition-colors disabled:opacity-50"
                    >
                      {otpSending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>পাঠানো হচ্ছে...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>পুনরায় কোড পাঠান (Resend Code)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Security Trust Footnote */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-stone-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>আপনার ব্যক্তিগত তথ্য ২৫৬-বিট এনক্রিপশনে সুরক্ষিত</span>
        </div>
      </div>
    </div>
  )
}
