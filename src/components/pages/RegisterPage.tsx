'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, UserPlus, Mail, Phone, Lock, User, AlertCircle, Check, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

export default function RegisterPage() {
  const { register, setUser, navigate, siteConfig } = useAppStore()
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Post-registration phone OTP state
  const [showOtpScreen, setShowOtpScreen] = useState(false)
  const [otpPhone, setOtpPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)

  const isPhone = !identifier.includes('@') && /^(\+?88)?01[3-9]\d{8}$/.test(identifier.trim().replace(/[\s-]/g, ''))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedName = name.trim()
    const trimmedId = identifier.trim()

    if (!trimmedName || trimmedName.length < 2) {
      setError('অনুগ্রহ করে আপনার পূর্ণ নাম লিখুন')
      return
    }

    if (!trimmedId) {
      setError('অনুগ্রহ করে আপনার ইমেইল অথবা ১১ ডিজিটের মোবাইল নম্বর লিখুন')
      return
    }

    if (trimmedId.includes('@')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedId)) {
        setError('সঠিক ইমেইল এড্রেস লিখুন')
        return
      }
    } else {
      const cleaned = trimmedId.replace(/[\s-]/g, '')
      if (!/^(\+?88)?01[3-9]\d{8}$/.test(cleaned)) {
        setError('অনুগ্রহ করে সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর লিখুন')
        return
      }
    }

    if (!password || password.length < 6) {
      setError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে')
      return
    }

    if (password !== confirmPassword) {
      setError('উভয় পাসওয়ার্ড একই হতে হবে')
      return
    }

    if (!agreeTerms) {
      setError('অ্যাকাউন্ট তৈরি করতে শর্তাবলীতে সম্মতি প্রদান করুন')
      return
    }

    setLoading(true)
    try {
      await register({
        name: trimmedName,
        identifier: trimmedId,
        password,
      })

      toast.success('অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!')

      // If registered with phone, prompt for OTP verification immediately
      if (isPhone) {
        setOtpPhone(trimmedId)
        setShowOtpScreen(true)
      } else {
        setTimeout(() => navigate('home'), 1200)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'অ্যাকাউন্ট তৈরি ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      toast.error('সঠিক ৬ ডিজিটের ওটিপি লিখুন')
      return
    }
    setOtpLoading(true)
    try {
      const token = useAppStore.getState().accessToken
      const res = await fetch('/api/auth/verify-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phone: otpPhone, code: otpCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ভেরিফিকেশন ব্যর্থ হয়েছে')

      const curUser = useAppStore.getState().user
      if (curUser) {
        setUser({ ...curUser, isVerified: true })
      }
      toast.success('মোবাইল নম্বর ভেরিফাই হয়েছে!')
      setTimeout(() => navigate('home'), 1000)
    } catch (err: any) {
      toast.error(err.message || 'ভেরিফিকেশন কোডটি সঠিক নয়')
    } finally {
      setOtpLoading(false)
    }
  }

  const siteName = siteConfig?.siteName || 'Khati Khadyo'
  const logoUrl = siteConfig?.logo || '/all_logo.png'

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 sm:px-6 bg-stone-50/50 dark:bg-stone-950/40">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 border border-stone-200/80 dark:border-stone-800 shadow-md space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 group mb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-lg p-1"
              aria-label="Go to homepage"
            >
              <img
                src={logoUrl}
                alt={siteName}
                className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
                onError={(e) => {
                  const target = e.currentTarget
                  if (!target.src.includes('all_logo.png')) target.src = '/all_logo.png'
                }}
              />
              <span className="font-extrabold text-lg text-stone-900 dark:text-white">
                {siteName}
              </span>
            </Link>

            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white tracking-tight">
              {showOtpScreen ? 'মোবাইল নম্বর ভেরিফিকেশন' : 'নতুন অ্যাকাউন্ট তৈরি করুন'}
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {showOtpScreen
                ? `${otpPhone} নম্বরে পাঠানো ৬ ডিজিটের ওটিপি লিখুন`
                : 'খাঁটি খাদ্যের সাথে নিরাপদ কেনাকাটা উপভোগ করুন'}
            </p>
          </div>

          {/* OTP Verification Screen */}
          {showOtpScreen ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-center space-y-2">
                <ShieldCheck className="h-8 w-8 text-emerald-600 mx-auto" />
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                  আপনার মোবাইল নম্বরে ৬ ডিজিটের ভেরিফিকেশন কোড পাঠানো হয়েছে।
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp-input" className="text-xs font-semibold">
                  ৬ ডিজিটের ওটিপি কোড
                </Label>
                <Input
                  id="otp-input"
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="text-center text-lg tracking-widest font-mono h-12 rounded-xl"
                  autoFocus
                />
              </div>

              <Button
                type="button"
                onClick={handleVerifyOtp}
                disabled={otpLoading || otpCode.length !== 6}
                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md"
              >
                {otpLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> ভেরিফাই হচ্ছে...
                  </>
                ) : (
                  'ভেরিফিকেশন সম্পন্ন করুন'
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate('home')}
                  className="text-xs text-stone-500 hover:text-stone-700 underline"
                >
                  পরে ভেরিফাই করব
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Error Notice */}
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                  <div className="leading-relaxed">{error}</div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name" className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    আপনার পূর্ণ নাম <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input
                      id="reg-name"
                      type="text"
                      placeholder="মোঃ রাহিম"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-9 rounded-xl h-11 text-sm bg-stone-50/50 dark:bg-stone-800/50 focus-visible:ring-emerald-600"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Email or Phone */}
                <div className="space-y-1.5">
                  <Label htmlFor="reg-id" className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    মোবাইল নম্বর অথবা ইমেইল <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    {identifier.includes('@') ? (
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    ) : (
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    )}
                    <Input
                      id="reg-id"
                      type="text"
                      placeholder="01XXXXXXXXX বা email@example.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="pl-9 rounded-xl h-11 text-sm bg-stone-50/50 dark:bg-stone-800/50 focus-visible:ring-emerald-600"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password" className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    পাসওয়ার্ড <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="কমপক্ষে ৬ অক্ষর"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 pr-10 rounded-xl h-11 text-sm bg-stone-50/50 dark:bg-stone-800/50 focus-visible:ring-emerald-600"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="reg-confirm" className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    পাসওয়ার্ড নিশ্চিত করুন <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input
                      id="reg-confirm"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="পাসওয়ার্ড পুনরায় লিখুন"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9 rounded-xl h-11 text-sm bg-stone-50/50 dark:bg-stone-800/50 focus-visible:ring-emerald-600"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Terms Agreement */}
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="terms-check"
                    checked={agreeTerms}
                    onCheckedChange={(checked) => setAgreeTerms(Boolean(checked))}
                  />
                  <Label htmlFor="terms-check" className="text-xs text-stone-600 dark:text-stone-400 cursor-pointer">
                    আমি <Link href="/terms" className="text-emerald-700 underline">শর্তাবলী</Link> ও <Link href="/privacy-policy" className="text-emerald-700 underline">গোপনীয়তা নীতি</Link> মেনে নিচ্ছি।
                  </Label>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> অ্যাকাউন্ট তৈরি হচ্ছে...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-1.5" /> রেজিস্টার করুন
                    </>
                  )}
                </Button>
              </form>

              {/* Footer Prompt */}
              <div className="pt-2 text-center text-xs text-stone-500 dark:text-stone-400 border-t border-stone-100 dark:border-stone-800">
                ইতিমধ্যে অ্যাকাউন্ট আছে?{' '}
                <button
                  type="button"
                  onClick={() => navigate('login')}
                  className="font-bold text-emerald-700 hover:text-emerald-800 transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  সাইন ইন করুন
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
