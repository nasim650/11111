'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, LogIn, Mail, Phone, Lock, AlertCircle, Check, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

export default function LoginPage() {
  const { login, navigate, siteConfig } = useAppStore()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({})

  const [identifierTouched, setIdentifierTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)

  const identifierValid = !identifier.trim() || identifier.includes('@')
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())
    : /^(\+?88)?01[3-9]\d{8}$/.test(identifier.trim().replace(/[\s-]/g, ''))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    const errs: Record<string, boolean> = {}

    if (!identifier.trim()) {
      setError('অনুগ্রহ করে আপনার ইমেইল অথবা মোবাইল নম্বর লিখুন')
      errs.identifier = true
      setIdentifierTouched(true)
      setFieldErrors(errs)
      return
    }

    if (!password) {
      setError('অনুগ্রহ করে আপনার পাসওয়ার্ড লিখুন')
      errs.password = true
      setPasswordTouched(true)
      setFieldErrors(errs)
      return
    }
    if (password.length < 6) {
      setError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে')
      errs.password = true
      setPasswordTouched(true)
      setFieldErrors(errs)
      return
    }

    setLoading(true)
    try {
      await login({ identifier: identifier.trim(), password })
      toast.success('সফলভাবে লগইন হয়েছে!')
      setTimeout(() => {
        const state = useAppStore.getState()
        if (state.user?.role === 'admin') {
          navigate('admin-dashboard')
        } else {
          navigate('home')
        }
      }, 500)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'লগইন ব্যর্থ হয়েছে। তথ্য যাচাই করুন।'
      setError(message)
      setFieldErrors({ password: true })
    } finally {
      setLoading(false)
    }
  }

  const siteName = siteConfig?.siteName || 'Khati Khadyo'
  const logoUrl = siteConfig?.logo || '/all_logo.png'

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 sm:px-6 bg-stone-50/50 dark:bg-stone-950/40">
      <div className="w-full max-w-md">
        {/* Card */}
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
              অ্যাকাউন্টে সাইন ইন করুন
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              খাঁটি খাদ্যের গ্রাহক প্যানেলে স্বাগতম
            </p>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identifier Input */}
            <div className="space-y-1.5">
              <Label htmlFor="login-identifier" className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                ইমেইল অথবা মোবাইল নম্বর <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                {identifier.includes('@') ? (
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                ) : (
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                )}
                <Input
                  id="login-identifier"
                  type="text"
                  placeholder="01XXXXXXXXX বা email@example.com"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value)
                    setIdentifierTouched(true)
                  }}
                  className={`pl-9 rounded-xl h-11 text-sm bg-stone-50/50 dark:bg-stone-800/50 ${
                    fieldErrors.identifier ? 'border-red-500 focus-visible:ring-red-500' : 'focus-visible:ring-emerald-600'
                  }`}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password" className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  পাসওয়ার্ড <span className="text-red-500">*</span>
                </Label>
                <button
                  type="button"
                  onClick={() => navigate('forgot-password')}
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  পাসওয়ার্ড ভুলে গেছেন?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setPasswordTouched(true)
                  }}
                  className={`pl-9 pr-10 rounded-xl h-11 text-sm bg-stone-50/50 dark:bg-stone-800/50 ${
                    fieldErrors.password ? 'border-red-500 focus-visible:ring-red-500' : 'focus-visible:ring-emerald-600'
                  }`}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 focus-visible:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> সাইন ইন হচ্ছে...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-1.5" /> সাইন ইন করুন
                </>
              )}
            </Button>
          </form>

          {/* Footer Prompt */}
          <div className="pt-2 text-center text-xs text-stone-500 dark:text-stone-400 border-t border-stone-100 dark:border-stone-800">
            নতুন গ্রাহক?{' '}
            <button
              type="button"
              onClick={() => navigate('register')}
              className="font-bold text-emerald-700 hover:text-emerald-800 transition-colors focus-visible:outline-none focus-visible:underline"
            >
              নতুন অ্যাকাউন্ট তৈরি করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
