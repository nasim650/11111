'use client'

import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import {
  Eye, EyeOff, UserPlus, Mail, Phone, Lock, User, Check, X,
  AlertCircle, ChevronRight, Shield, ShieldCheck, BadgeCheck,
  AlertTriangle, Camera, Plus, Loader2, RefreshCw,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

function getPasswordStrength(password: string): { score: number; label: string; color: string; bgColor: string; icon: string } {
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score: 20, label: 'Weak', color: 'bg-red-500', bgColor: 'bg-red-500/10', icon: '🔴' }
  if (score <= 2) return { score: 40, label: 'Fair', color: 'bg-orange-500', bgColor: 'bg-orange-500/10', icon: '🟠' }
  if (score <= 3) return { score: 60, label: 'Good', color: 'bg-yellow-500', bgColor: 'bg-yellow-500/10', icon: '🟡' }
  if (score <= 4) return { score: 80, label: 'Strong', color: 'bg-emerald-500', bgColor: 'bg-emerald-500/10', icon: '🟢' }
  return { score: 100, label: 'Very Strong', color: 'bg-emerald-600', bgColor: 'bg-emerald-600/10', icon: '💪' }
}

type Step = 1 | 2 | 3

export default function RegisterPage() {
  const { register, navigate, setUser, siteConfig } = useAppStore()
  const [currentStep, setCurrentStep] = useState<Step>(1)

  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)

  // OTP Verification state
  const [showOtpScreen, setShowOtpScreen] = useState(false)
  const [otpPhone, setOtpPhone] = useState('')
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpSuccess, setOtpSuccess] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [otpSending, setOtpSending] = useState(false)
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Touched states for real-time validation
  const [nameTouched, setNameTouched] = useState(false)
  const [identifierTouched, setIdentifierTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)

  // Validation
  const nameValid = name.trim().length >= 2
  const nameError = nameTouched && !nameValid ? (name.trim() ? 'Name must be at least 2 characters' : 'Name is required') : ''

  const isEmail = identifier.includes('@')
  const identifierClean = identifier.trim()
  const phoneNormalized = identifierClean.replace(/[\s-]/g, '').replace(/^(\+?88)/, '')
  const identifierValid = isEmail
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifierClean)
    : /^01[3-9]\d{8}$/.test(phoneNormalized.startsWith('01') ? phoneNormalized : '0' + phoneNormalized)

  const identifierError = identifierTouched && identifierClean
    ? (!identifierValid
        ? (isEmail ? 'Please enter a valid email address.' : 'Please enter a valid Bangladeshi phone number.')
        : '')
    : ''

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password])
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const passwordValid = password.length >= 6
  const passwordError = passwordTouched && password.length > 0 && !passwordValid ? 'Password must be at least 6 characters' : ''

  const confirmError = confirmTouched && passwordsMismatch ? 'Passwords do not match' : ''

  // Step completion checks
  const step1Complete = nameValid
  const step2Complete = identifierValid
  const step3Complete = passwordValid && passwordsMatch && agreeTerms

  const canProceedStep1 = step1Complete
  const canProceedStep2 = step2Complete

  // OTP helpers
  const otpValue = otpDigits.join('')

  const startResendTimer = (seconds: number) => {
    if (resendTimerRef.current) clearTimeout(resendTimerRef.current)
    setResendCooldown(seconds)
    const tick = () => {
      setResendCooldown((prev) => {
        if (prev <= 1) return 0
        resendTimerRef.current = setTimeout(tick, 1000)
        return prev - 1
      })
    }
    resendTimerRef.current = setTimeout(tick, 1000)
  }

  const handleOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
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

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || otpSending) return
    setOtpSending(true)
    setOtpError('')
    try {
      const token = useAppStore.getState().accessToken
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phone: otpPhone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to resend')
      startResendTimer(data.retryAfter ?? 60)
      toast.success('A new code has been sent to your phone.')
    } catch {
      // Never surface raw provider errors
      setOtpError('SMS service temporarily unavailable. Please try email or contact support.')
    } finally {
      setOtpSending(false)
    }
  }

  const handleNextStep = () => {
    if (currentStep === 1) {
      setNameTouched(true)
      if (!nameValid) return
      setCurrentStep(2)
    } else if (currentStep === 2) {
      setIdentifierTouched(true)
      if (!identifierValid) {
        setError(isEmail ? 'Please enter a valid email address.' : 'Please enter a valid Bangladeshi phone number.')
        return
      }
      setError('')
      setCurrentStep(3)
    }
  }

  const handlePrevStep = () => {
    setError('')
    if (currentStep === 2) setCurrentStep(1)
    else if (currentStep === 3) setCurrentStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return // prevent duplicate submissions
    setError('')

    if (!nameValid) {
      setCurrentStep(1)
      setNameTouched(true)
      return
    }
    if (!identifierValid) {
      setCurrentStep(2)
      setIdentifierTouched(true)
      setError(isEmail ? 'Please enter a valid email address.' : 'Please enter a valid Bangladeshi phone number.')
      return
    }
    if (!passwordValid) {
      setCurrentStep(3)
      setPasswordTouched(true)
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (!agreeTerms) {
      setError('Please agree to the Terms & Conditions')
      return
    }

    setLoading(true)
    try {
      await register({
        name: name.trim(),
        identifier: identifier.trim(),
        password,
      })
      toast.success('Registration successful!')
      if (!isEmail) {
        setOtpPhone(identifier.trim())
        setShowOtpScreen(true)
        startResendTimer(60)
      } else {
        setRegistered(true)
        setTimeout(() => {
          navigate('home')
        }, 2500)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (otpLoading) return // prevent duplicate submissions
    if (otpValue.length !== 6) {
      setOtpError('Please enter all 6 digits of the verification code.')
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
      if (!res.ok) throw new Error(data.error || 'Verification failed')

      const curUser = useAppStore.getState().user
      if (curUser) {
        setUser({ ...curUser, isVerified: true })
      }
      setOtpSuccess(true)
      setTimeout(() => {
        setRegistered(true)
        setTimeout(() => navigate('home'), 1500)
      }, 1000)
    } catch (err: any) {
      // Show friendly error — never expose raw OTP or token details
      const msg = err?.message || 'Invalid verification code'
      const isFriendly = msg.includes('invalid') || msg.includes('expired') || msg.includes('incorrect')
      setOtpError(isFriendly ? 'Incorrect or expired code. Please try again.' : 'Verification failed. Please try again or request a new code.')
    } finally {
      setOtpLoading(false)
    }
  }

  // Success Animation
  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-emerald-50 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute top-[20%] left-[10%] w-48 h-48 rounded-full bg-primary/5"
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-[15%] right-[15%] w-32 h-32 rounded-full bg-secondary/5"
            animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 4, repeat: Infinity, delay: 1 }}
          />
        </div>
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-center p-8 relative z-10"
          role="status"
          aria-live="polite"
          aria-label="Registration successful, redirecting"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
            >
              <Check className="h-12 w-12 text-white" />
            </motion.div>
          </div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-2xl font-bold text-foreground"
          >
            যোগ দিন! — Welcome!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="text-muted-foreground mb-6"
          >
            Your account has been created successfully.
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-sm text-muted-foreground"
          >
            Redirecting you to the homepage...
          </motion.p>
          <div className="mt-4 flex justify-center gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-primary"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    )
  }

  const steps = [
    { num: 1, label: 'Personal Info', done: step1Complete, icon: User },
    { num: 2, label: 'Contact', done: step2Complete, icon: Mail },
    { num: 3, label: 'Security', done: step3Complete, icon: Lock },
  ]

  return (
    <div className="min-h-screen flex relative">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="reg-food-pattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="8" fill="none" stroke="#2D6A4F" strokeWidth="1.5" />
              <path d="M30 22 L30 38 M22 30 L38 30" stroke="#2D6A4F" strokeWidth="0.5" opacity="0.5" />
            </pattern>
            <pattern id="reg-dot-pattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="15" cy="15" r="1" fill="#B8860B" opacity="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#reg-food-pattern)" />
          <rect width="100%" height="100%" fill="url(#reg-dot-pattern)" />
        </svg>
        <motion.div
          className="absolute top-[10%] left-[10%] w-64 h-64 rounded-full border border-primary/10"
          animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[20%] right-[10%] w-40 h-40 rounded-full border border-secondary/10"
          animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
      </div>

      {/* Decorative Left Panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-emerald-800 via-primary to-primary relative overflow-hidden z-10">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10" aria-hidden="true">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="leaf-reg-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M40 10 C50 25, 55 40, 40 70 C25 40, 30 25, 40 10Z" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#leaf-reg-pattern)" />
            <motion.div
              className="absolute top-16 right-16 w-40 h-40 rounded-full border-4 border-white"
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute bottom-32 left-16 w-32 h-32 rounded-full border-4 border-white"
              animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            />
            <motion.div
              className="absolute top-1/2 right-1/3 w-24 h-24 rounded-full bg-white/20"
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </svg>
        </div>

        {/* Floating food icons */}
        <motion.div className="absolute top-24 left-12 text-5xl opacity-20" animate={{ y: [0, -8, 0], rotate: [0, 5, 0] }} transition={{ duration: 3.2, repeat: Infinity }} aria-hidden="true">🥘</motion.div>
        <motion.div className="absolute top-1/2 right-16 text-4xl opacity-20" animate={{ y: [0, -6, 0], rotate: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity, delay: 0.8 }} aria-hidden="true">🌿</motion.div>
        <motion.div className="absolute bottom-1/3 left-1/4 text-4xl opacity-20" animate={{ y: [0, -10, 0] }} transition={{ duration: 3.8, repeat: Infinity, delay: 1.2 }} aria-hidden="true">🍯</motion.div>
        <motion.div className="absolute bottom-20 right-20 text-5xl opacity-20" animate={{ y: [0, -7, 0] }} transition={{ duration: 4.2, repeat: Infinity, delay: 0.3 }} aria-hidden="true">🫒</motion.div>

        <div className="relative z-10 flex flex-col justify-center items-center px-12 text-white">
          {/* Bengali Welcome */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center mb-8"
          >
            <motion.p
              className="text-white/60 text-sm uppercase tracking-widest mb-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Join Us
            </motion.p>
            <h1 className="text-5xl font-bold mb-2 gradient-text-white">যোগ দিন!</h1>
            <p className="text-white/70 text-lg text-center">
              Create an account and start exploring authentic Bangladeshi food products
            </p>
          </motion.div>

          {/* Logo */}
          <Link href="/" aria-label="Khati Khadyo - Go to homepage">
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
              className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-8 shadow-2xl ring-1 ring-white/20 overflow-hidden hover:opacity-90 transition-opacity"
            >
              <img
                src="/all_logo.png"
                alt="Khati Khadyo"
                className="h-20 w-auto object-contain"
              />
            </motion.div>
          </Link>

          {/* Registration Steps Progress with Checkmarks */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="w-full max-w-sm space-y-6"
            aria-label="Registration progress"
          >
            {steps.map((step, i) => {
              const StepIcon = step.icon
              const isCurrent = currentStep === step.num
              return (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className="flex items-center gap-4"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-500 cursor-pointer ${
                    step.done
                      ? 'bg-secondary text-white shadow-lg shadow-secondary/30 scale-105'
                      : isCurrent
                      ? 'bg-white/20 backdrop-blur-sm text-white ring-2 ring-white/40'
                      : 'bg-white/10 text-white/40'
                  }`} onClick={() => { if (step.done || (step.num === 1) || (step.num === 2 && step1Complete)) setCurrentStep(step.num as Step) }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Step ${step.num}: ${step.label}${step.done ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (step.done || step.num === 1 || (step.num === 2 && step1Complete)) setCurrentStep(step.num as Step) } }}
                  >
                    {step.done ? <Check className="h-6 w-6" /> : <StepIcon className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium transition-colors ${step.done ? 'text-white' : isCurrent ? 'text-white' : 'text-white/40'}`}>
                      {step.label}
                    </p>
                    <div className="h-2 rounded-full bg-white/10 mt-2 overflow-hidden" aria-hidden="true">
                      <motion.div
                        className={`h-full rounded-full ${step.done ? 'bg-secondary' : isCurrent ? 'bg-white/40' : ''}`}
                        initial={{ width: '0%' }}
                        animate={{ width: step.done ? '100%' : isCurrent ? '50%' : '0%' }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <ChevronRight className={`h-5 w-5 transition-colors ${step.done ? 'text-secondary' : 'text-white/20'}`} aria-hidden="true" />
                  )}
                </motion.div>
              )
            })}
          </motion.div>

          {/* Trust Badges with Lucide Icons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-12 flex items-center gap-6 text-white/60 text-xs"
          >
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Shield className="h-4 w-4 text-white/70" />
              </div>
              <span>Secure</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-white/70" />
              </div>
              <span>Private</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <BadgeCheck className="h-4 w-4 text-white/70" />
              </div>
              <span>Verified</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Registration Form */}
      <div className="w-full lg:w-[55%] flex flex-col relative z-10">
        {/* Mobile Top Banner */}
        <div className="lg:hidden bg-gradient-to-r from-primary to-emerald-700 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" aria-hidden="true">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="mobile-reg-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="5" fill="none" stroke="white" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#mobile-reg-pattern)" />
            </svg>
          </div>
          <div className="relative">
            <Link href="/" aria-label="Khati Khadyo - Go to homepage">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 shadow-lg overflow-hidden hover:opacity-90 transition-opacity">
                <img
                  src="/all_logo.png"
                  alt="Khati Khadyo"
                  className="h-10 w-auto object-contain"
                />
              </div>
            </Link>
            <h1 className="text-xl font-bold">যোগ দিন!</h1>
            <p className="text-white/70 text-sm mt-1">Create your account today</p>
          </div>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            {/* Form Card */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl ring-1 ring-white/50 p-8">
              <div className="mb-6 text-center">
                {siteConfig?.logo && (
                  <div className="flex justify-center mb-4">
                    <img
                      src={siteConfig.logo}
                      alt="Khati Khadyo"
                      className="h-12 w-auto object-contain"
                    />
                  </div>
                )}
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-bold text-foreground"
                >
                  {showOtpScreen ? 'Verify Your Phone' : 'Create Account'}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-muted-foreground mt-1"
                >
                  {showOtpScreen
                    ? 'Enter the code sent to your phone'
                    : currentStep === 1
                    ? 'Tell us your name to get started'
                    : currentStep === 2
                    ? 'How can we reach you?'
                    : 'Secure your account with a password'}
                </motion.p>
              </div>

              {/* Step Indicator Dots (hidden during OTP screen) */}
              {!showOtpScreen && (
                <div
                  className="flex items-center justify-center gap-2 mb-6"
                  role="tablist"
                  aria-label="Registration steps"
                >
                  {steps.map((step) => (
                    <div key={step.num} className="flex items-center gap-2">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={currentStep === step.num}
                        aria-label={`Step ${step.num}: ${step.label}${step.done ? ' (completed)' : ''}`}
                        className={`w-8 h-8 rounded-full text-xs font-bold transition-all duration-300 flex items-center justify-center ${
                          step.done
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : currentStep === step.num
                            ? 'bg-primary/10 text-primary ring-2 ring-primary/30'
                            : 'bg-muted text-muted-foreground'
                        }`}
                        onClick={() => {
                          if (step.done || step.num === 1 || (step.num === 2 && step1Complete)) {
                            setCurrentStep(step.num as Step)
                          }
                        }}
                      >
                        {step.done ? <Check className="h-4 w-4" /> : step.num}
                      </button>
                      {step.num < 3 && (
                        <div className={`w-8 h-0.5 rounded-full transition-colors ${step.done ? 'bg-primary' : 'bg-muted'}`} aria-hidden="true" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Global Error Message */}
              <AnimatePresence>
                {error && !showOtpScreen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      id="form-error"
                      className="p-4 rounded-xl bg-red-50 border-2 border-red-200 flex items-start gap-3"
                      role="alert"
                      aria-live="assertive"
                    >
                      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-red-800">Registration Failed</p>
                        <p className="text-sm text-red-600 mt-0.5">{error}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* OTP Screen */}
              {showOtpScreen ? (
                <div className="space-y-5">
                  {/* Phone number display */}
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                    <ShieldCheck className="h-8 w-8 text-emerald-600 mx-auto" aria-hidden="true" />
                    <p className="text-sm text-emerald-800 font-medium">
                      A 6-digit verification code was sent to
                    </p>
                    <p className="text-base font-bold text-emerald-900 tracking-wide" aria-label={`Phone number: ${otpPhone}`}>
                      {otpPhone}
                    </p>
                    <p className="text-xs text-emerald-700">
                      নম্বরে ৬ ডিজিটের ভেরিফিকেশন কোড পাঠানো হয়েছে।
                    </p>
                  </div>

                  {/* OTP Success state */}
                  <AnimatePresence>
                    {otpSuccess && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center gap-3"
                        role="status"
                        aria-live="polite"
                        aria-label="Phone verified successfully"
                      >
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                          <Check className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-emerald-800">Phone Verified!</p>
                          <p className="text-xs text-emerald-700">Redirecting you to the app…</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* OTP Error */}
                  <AnimatePresence>
                    {otpError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div
                          id="otp-error"
                          className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2"
                          role="alert"
                          aria-live="assertive"
                        >
                          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                          <p className="text-sm text-red-700">{otpError}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 6-digit OTP boxes */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold block text-center">
                      Verification Code
                    </Label>
                    <div
                      className="flex gap-2 justify-center"
                      role="group"
                      aria-label="6-digit verification code"
                      aria-describedby={otpError ? 'otp-error' : undefined}
                      onPaste={handleOtpPaste}
                    >
                      {otpDigits.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => { otpInputRefs.current[i] = el }}
                          id={i === 0 ? 'otp-input-0' : undefined}
                          type="text"
                          inputMode="numeric"
                          autoComplete={i === 0 ? 'one-time-code' : 'off'}
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          aria-label={`Digit ${i + 1} of 6`}
                          disabled={otpLoading || otpSuccess}
                          className={`w-12 h-14 rounded-xl border-2 text-center text-xl font-bold font-mono transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary ${
                            otpError
                              ? 'border-red-300 bg-red-50'
                              : digit
                              ? 'border-primary/60 bg-primary/5'
                              : 'border-border bg-white'
                          } disabled:opacity-50`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground text-center" aria-live="polite">
                      {otpValue.length}/6 digits entered
                    </p>
                  </div>

                  {/* Verify button */}
                  <Button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={otpLoading || otpValue.length !== 6 || otpSuccess}
                    className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all"
                    aria-busy={otpLoading}
                  >
                    {otpLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                        Verifying…
                      </>
                    ) : (
                      'Verify Phone Number'
                    )}
                  </Button>

                  {/* Resend + status */}
                  <div className="text-center space-y-2" role="status" aria-live="polite">
                    {resendCooldown > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Resend code in{' '}
                        <span className="font-semibold tabular-nums text-foreground">
                          {resendCooldown}s
                        </span>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={otpSending || otpSuccess}
                        className="text-sm text-primary hover:underline font-medium inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-busy={otpSending}
                      >
                        {otpSending ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            Sending…
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                            Resend Code
                          </>
                        )}
                      </button>
                    )}
                    <div>
                      <button
                        type="button"
                        onClick={() => navigate('home')}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        পরে ভেরিফাই করব (Verify later)
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {/* Step 1: Personal Info */}
                  {currentStep === 1 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      {/* Profile Image Placeholder */}
                      <div className="flex justify-center mb-4">
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-dashed border-primary/30 flex items-center justify-center cursor-pointer group"
                          aria-label="Profile photo (optional)"
                        >
                          <div className="text-center">
                            <Camera className="h-6 w-6 text-primary/40 mx-auto group-hover:text-primary/60 transition-colors" aria-hidden="true" />
                            <span className="text-[9px] text-muted-foreground mt-0.5 block">Add Photo</span>
                          </div>
                          <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md" aria-hidden="true">
                            <Plus className="h-3.5 w-3.5" />
                          </div>
                        </motion.div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-medium flex items-center gap-1.5">
                          Full Name <span className="text-red-500" aria-hidden="true">*</span>
                          {nameValid && nameTouched && <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />}
                        </Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <Input
                            id="name"
                            name="name"
                            autoComplete="name"
                            placeholder="Your full name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={() => setNameTouched(true)}
                            autoFocus
                            aria-required="true"
                            aria-invalid={!!nameError}
                            aria-describedby={nameError ? 'name-error' : undefined}
                            className={`pl-10 h-12 transition-colors ${
                              nameError ? 'border-red-400 ring-2 ring-red-100 focus-visible:ring-red-200' :
                              nameValid && nameTouched ? 'border-emerald-300 focus-visible:ring-emerald-200' : 'focus-visible:ring-primary/20'
                            }`}
                          />
                        </div>
                        {nameError && (
                          <motion.p
                            id="name-error"
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-500 flex items-center gap-1"
                            role="alert"
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {nameError}
                          </motion.p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Contact Info */}
                  {currentStep === 2 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="reg-identifier" className="text-sm font-medium flex items-center gap-1.5">
                          Email or Phone Number <span className="text-red-500" aria-hidden="true">*</span>
                          {identifierTouched && identifierValid && <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />}
                        </Label>
                        <div className="relative">
                          {isEmail ? (
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-all" aria-hidden="true" />
                          ) : (
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-all" aria-hidden="true" />
                          )}
                          <Input
                            id="reg-identifier"
                            name={isEmail ? 'email' : 'tel'}
                            type="text"
                            autoComplete={isEmail ? 'email' : 'tel'}
                            placeholder="Enter your email or phone number"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            onBlur={() => setIdentifierTouched(true)}
                            autoFocus
                            aria-required="true"
                            aria-invalid={!!identifierError}
                            aria-describedby={identifierError ? 'identifier-error' : undefined}
                            className={`pl-10 h-12 transition-colors ${
                              identifierError
                                ? 'border-red-400 ring-2 ring-red-100 focus-visible:ring-red-200'
                                : identifierTouched && identifierValid
                                ? 'border-emerald-300 focus-visible:ring-emerald-200'
                                : 'focus-visible:ring-primary/20'
                            }`}
                          />
                        </div>
                        {identifierError && (
                          <motion.p
                            id="identifier-error"
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-500 flex items-center gap-1"
                            role="alert"
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {identifierError}
                          </motion.p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Security */}
                  {currentStep === 3 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      {/* Password */}
                      <div className="space-y-2">
                        <Label htmlFor="reg-password" className="text-sm font-medium flex items-center gap-1.5">
                          Password <span className="text-red-500" aria-hidden="true">*</span>
                          {passwordValid && passwordTouched && <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />}
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <Input
                            id="reg-password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            placeholder="Min. 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onBlur={() => setPasswordTouched(true)}
                            autoFocus
                            aria-required="true"
                            aria-invalid={!!passwordError}
                            aria-describedby={passwordError ? 'password-error' : 'password-strength'}
                            className={`pl-10 pr-10 h-12 transition-colors ${
                              passwordError ? 'border-red-400 ring-2 ring-red-100 focus-visible:ring-red-200' :
                              'focus-visible:ring-primary/20'
                            }`}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            aria-pressed={showPassword}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {passwordError && (
                          <p id="password-error" className="text-xs text-red-500 flex items-center gap-1" role="alert">
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {passwordError}
                          </p>
                        )}
                        {/* Password Strength Indicator */}
                        {password.length > 0 && (
                          <div id="password-strength" className="space-y-2" aria-label={`Password strength: ${passwordStrength.label}`}>
                            <div className="flex gap-1" aria-hidden="true">
                              {[20, 40, 60, 80, 100].map((level) => (
                                <motion.div
                                  key={level}
                                  className={`h-1.5 flex-1 rounded-full ${
                                    passwordStrength.score >= level
                                      ? passwordStrength.color
                                      : 'bg-gray-200'
                                  }`}
                                  initial={{ scaleX: 0 }}
                                  animate={{ scaleX: 1 }}
                                  transition={{ duration: 0.3, delay: (level / 100) * 0.3 }}
                                />
                              ))}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${passwordStrength.bgColor} ${
                                passwordStrength.label === 'Weak' ? 'text-red-600' :
                                passwordStrength.label === 'Fair' ? 'text-orange-600' :
                                passwordStrength.label === 'Good' ? 'text-yellow-700' :
                                passwordStrength.label === 'Strong' ? 'text-emerald-600' :
                                'text-emerald-700'
                              }`}>
                                <span aria-hidden="true">{passwordStrength.icon}</span> {passwordStrength.label}
                              </span>
                              <span className="text-xs text-muted-foreground" aria-hidden="true">{password.length}/6+ chars</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password" className="text-sm font-medium flex items-center gap-1.5">
                          Confirm Password <span className="text-red-500" aria-hidden="true">*</span>
                          {passwordsMatch && <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />}
                          {passwordsMismatch && <X className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />}
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <Input
                            id="confirm-password"
                            name="confirm-password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            placeholder="Confirm your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onBlur={() => setConfirmTouched(true)}
                            aria-required="true"
                            aria-invalid={!!confirmError}
                            aria-describedby={confirmError ? 'confirm-error' : undefined}
                            className={`pl-10 pr-10 h-12 transition-colors ${
                              confirmError ? 'border-red-400 ring-2 ring-red-100 focus-visible:ring-red-200' :
                              passwordsMatch ? 'border-emerald-300 focus-visible:ring-emerald-200' :
                              'focus-visible:ring-primary/20'
                            }`}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                            aria-pressed={showConfirmPassword}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {confirmError && (
                          <motion.p
                            id="confirm-error"
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-500 flex items-center gap-1"
                            role="alert"
                          >
                            <X className="h-3 w-3" aria-hidden="true" /> {confirmError}
                          </motion.p>
                        )}
                      </div>

                      {/* Terms & Conditions */}
                      <div className="flex items-start gap-2.5 pt-1">
                        <Checkbox
                          id="terms"
                          checked={agreeTerms}
                          onCheckedChange={(checked) => setAgreeTerms(checked === true)}
                          className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary w-5 h-5"
                          aria-required="true"
                        />
                        <Label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                          I agree to the{' '}
                          <button
                            type="button"
                            className="text-primary hover:underline font-semibold"
                            onClick={() => navigate('terms')}
                          >
                            Terms &amp; Conditions
                          </button>
                          {' '}and{' '}
                          <button
                            type="button"
                            className="text-primary hover:underline font-semibold"
                            onClick={() => navigate('privacy')}
                          >
                            Privacy Policy
                          </button>
                        </Label>
                      </div>
                    </motion.div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex gap-3 pt-2">
                    {currentStep > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-12 rounded-xl font-medium"
                        onClick={handlePrevStep}
                        disabled={loading}
                      >
                        Back
                      </Button>
                    )}
                    {currentStep < 3 ? (
                      <Button
                        type="button"
                        className="flex-1 h-12 text-base font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                        onClick={handleNextStep}
                        disabled={
                          (currentStep === 1 && !canProceedStep1) ||
                          (currentStep === 2 && !canProceedStep2)
                        }
                      >
                        Continue
                        <ChevronRight className="h-5 w-5 ml-1" aria-hidden="true" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        className="flex-1 h-12 text-base font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                        disabled={loading || !step3Complete}
                        aria-busy={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" aria-hidden="true" />
                            Creating account…
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-5 w-5 mr-2" aria-hidden="true" />
                            Create Account
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </form>
              )}

              {/* Sign In Link */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6 pt-5 border-t"
              >
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="text-primary hover:underline font-semibold inline-flex items-center gap-1 group"
                    onClick={() => navigate('login')}
                  >
                    Sign In
                    <span className="inline-block group-hover:translate-x-0.5 transition-transform" aria-hidden="true">&rarr;</span>
                  </button>
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
