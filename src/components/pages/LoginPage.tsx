'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, LogIn, Mail, Phone, Lock, AlertCircle, Truck, ShieldCheck, Award, Heart, Zap, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
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
  const [loginSuccess, setLoginSuccess] = useState(false)

  // Real-time validation
  const [identifierTouched, setIdentifierTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)

  const identifierValid = !identifier.trim() || identifier.includes('@')
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())
    : /^(\+?88)?01[3-9]\d{8}$/.test(identifier.trim().replace(/[\s-]/g, ''))
  const passwordValid = password.length === 0 || password.length >= 6

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    const errs: Record<string, boolean> = {}

    if (!identifier.trim()) {
      setError('Please enter your email or phone number')
      errs.identifier = true
      setIdentifierTouched(true)
      setFieldErrors(errs)
      return
    }

    if (!password) {
      setError('Please enter your password')
      errs.password = true
      setPasswordTouched(true)
      setFieldErrors(errs)
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      errs.password = true
      setPasswordTouched(true)
      setFieldErrors(errs)
      return
    }

    setLoading(true)
    try {
      await login({ identifier: identifier.trim(), password })
      setLoginSuccess(true)
      toast.success('Login successful!')
      setTimeout(() => {
        const state = useAppStore.getState()
        if (state.user?.role === 'admin') {
          navigate('admin-dashboard')
        } else {
          navigate('home')
        }
      }, 1500)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      setFieldErrors({ password: true })
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = () => {
    toast.info('Password reset link will be sent to your email!', {
      description: 'This feature is coming soon.',
    })
  }

  // ── Login Success Animation ──
  if (loginSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-emerald-50 relative overflow-hidden">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-center"
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
            স্বাগতম!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="text-muted-foreground mt-2"
          >
            Welcome back to Khati Khadyo
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-4 flex justify-center gap-1"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-primary"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </motion.div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex relative">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="food-pattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="8" fill="none" stroke="#2D6A4F" strokeWidth="1.5" />
              <path d="M30 22 L30 38 M22 30 L38 30" stroke="#2D6A4F" strokeWidth="0.5" opacity="0.5" />
            </pattern>
            <pattern id="dot-pattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="15" cy="15" r="1" fill="#B8860B" opacity="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#food-pattern)" />
          <rect width="100%" height="100%" fill="url(#dot-pattern)" />
        </svg>
        <motion.div
          className="absolute top-[10%] right-[15%] w-64 h-64 rounded-full border border-primary/10"
          animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[20%] left-[5%] w-40 h-40 rounded-full border border-secondary/10"
          animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        <motion.div
          className="absolute top-[60%] right-[5%] w-24 h-24 rounded-full bg-primary/5"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Decorative Left Panel - Hidden on mobile */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-primary via-primary to-emerald-800 relative overflow-hidden z-10">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="leaf-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M40 10 C50 25, 55 40, 40 70 C25 40, 30 25, 40 10Z" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#leaf-pattern)" />
          </svg>
          <motion.div
            className="absolute top-20 left-10 w-32 h-32 rounded-full border-4 border-white"
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-40 right-20 w-48 h-48 rounded-full border-4 border-white"
            animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
          <motion.div
            className="absolute top-1/2 left-1/3 w-20 h-20 rounded-full bg-white/20"
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-20 left-20 w-16 h-16 rounded-full bg-white/10"
            animate={{ y: [0, 10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />
        </div>

        {/* Floating food icons */}
        <motion.div className="absolute top-16 right-16 text-5xl opacity-20" animate={{ y: [0, -8, 0], rotate: [0, 5, 0] }} transition={{ duration: 3, repeat: Infinity }}>🍯</motion.div>
        <motion.div className="absolute top-1/3 right-1/4 text-4xl opacity-20" animate={{ y: [0, -6, 0], rotate: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }}>🌶️</motion.div>
        <motion.div className="absolute bottom-1/3 left-1/4 text-4xl opacity-20" animate={{ y: [0, -10, 0] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}>🫒</motion.div>
        <motion.div className="absolute bottom-16 right-1/3 text-5xl opacity-20" animate={{ y: [0, -7, 0] }} transition={{ duration: 4.5, repeat: Infinity, delay: 1.5 }}>🍚</motion.div>

        <div className="relative z-10 flex flex-col justify-center items-center px-12 text-white">
          {/* Bengali Welcome Greeting */}
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
              Welcome Back
            </motion.p>
            <h1 className="text-5xl font-bold mb-2 gradient-text-white">স্বাগতম!</h1>
            <p className="text-white/70 text-lg">
              খাঁটি খাদ্য — Authentic Bangladeshi Food Products
            </p>
          </motion.div>

          {/* Brand Logo Area */}
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
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-4xl font-bold mb-2"
          >
            Khati Khadyo
          </motion.h1>

          {/* Benefits Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="w-full max-w-sm space-y-5"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50 mb-4">Why shop with us</h3>
            {[
              { icon: Truck, text: 'Free Delivery on orders over ৳1,500', color: 'bg-sky-400/20' },
              { icon: ShieldCheck, text: '100% Authentic Products Guaranteed', color: 'bg-emerald-400/20' },
              { icon: Award, text: 'Premium Quality You Can Trust', color: 'bg-secondary/30' },
              { icon: Heart, text: 'Save Favorites to Your Wishlist', color: 'bg-red-400/20' },
              { icon: Zap, text: 'Lightning-Fast Secure Checkout', color: 'bg-amber-400/20' },
            ].map((benefit, i) => {
              const Icon = benefit.icon
              return (
                <motion.div
                  key={benefit.text}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                  className="flex items-center gap-4 text-white/90 group"
                >
                  <div className={`w-10 h-10 rounded-xl ${benefit.color} backdrop-blur-sm flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-sm leading-snug">{benefit.text}</span>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-[55%] flex flex-col relative z-10">
        {/* Mobile Top Banner */}
        <div className="lg:hidden bg-gradient-to-r from-primary to-emerald-700 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="mobile-food-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="5" fill="none" stroke="white" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#mobile-food-pattern)" />
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
            <h1 className="text-xl font-bold">স্বাগতম!</h1>
            <p className="text-white/70 text-sm mt-1">খাঁটি খাদ্য — Authentic Bangladeshi Food</p>
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
            {/* Glassmorphism Form Card */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl ring-1 ring-white/50 p-8">
              <div className="mb-8 text-center">
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
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-bold text-foreground"
                >
                  Welcome Back
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-muted-foreground mt-1"
                >
                  Sign in to your Khati Khadyo account
                </motion.p>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-800">Login Failed</p>
                        <p className="text-sm text-red-600 mt-0.5">{error}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Single Unified Identifier Field */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-2"
                >
                  <Label htmlFor="identifier" className="text-sm font-medium flex items-center gap-1">
                    Email or Phone Number <span className="text-red-500">*</span>
                    {identifierTouched && identifier.trim() && identifierValid && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                  </Label>
                  <div className="relative">
                    {identifier.includes('@') ? (
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-all" />
                    ) : (
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-all" />
                    )}
                    <Input
                      id="identifier"
                      type="text"
                      placeholder="Enter your email or phone number"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value)
                        setFieldErrors((prev) => ({ ...prev, identifier: false }))
                      }}
                      onBlur={() => setIdentifierTouched(true)}
                      className={`pl-10 h-11 transition-colors ${
                        fieldErrors.identifier
                          ? 'border-red-400 ring-2 ring-red-100 focus-visible:ring-red-200'
                          : identifierTouched && identifier.trim() && !identifierValid
                          ? 'border-red-400 ring-2 ring-red-100 focus-visible:ring-red-200'
                          : identifierTouched && identifier.trim() && identifierValid
                          ? 'border-emerald-300 focus-visible:ring-emerald-200'
                          : 'focus-visible:ring-primary/20'
                      }`}
                    />
                  </div>
                  {identifierTouched && identifier.trim() && !identifierValid && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-red-500 flex items-center gap-1"
                    >
                      <AlertCircle className="h-3 w-3" />
                      {identifier.includes('@')
                        ? 'Please enter a valid email address.'
                        : 'Please enter a valid Bangladeshi phone number.'}
                    </motion.p>
                  )}
                </motion.div>

                {/* Password Field */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="space-y-2"
                >
                  <Label htmlFor="password" className="text-sm font-medium flex items-center gap-1">
                    Password <span className="text-red-500">*</span>
                    {passwordTouched && passwordValid && password.length > 0 && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: false })) }}
                      onBlur={() => setPasswordTouched(true)}
                      className={`pl-10 pr-10 h-11 transition-colors ${
                        fieldErrors.password ? 'border-red-400 ring-2 ring-red-100 focus-visible:ring-red-200' :
                        passwordTouched && !passwordValid ? 'border-red-400 ring-2 ring-red-100 focus-visible:ring-red-200' :
                        'focus-visible:ring-primary/20'
                      }`}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordTouched && password.length > 0 && password.length < 6 && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-amber-600 flex items-center gap-1"
                    >
                      <AlertCircle className="h-3 w-3" /> Password must be at least 6 characters
                    </motion.p>
                  )}
                </motion.div>

                {/* Remember Me & Forgot Password */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                      Remember me
                    </Label>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline font-medium"
                    onClick={handleForgotPassword}
                  >
                    Forgot Password?
                  </button>
                </motion.div>

                {/* Submit Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  <Button type="submit" className="w-full h-12 text-base font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all relative overflow-hidden" disabled={loading}>
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    ) : (
                      <>
                        <LogIn className="h-5 w-5 mr-2" />
                        Sign In
                      </>
                    )}
                  </Button>
                </motion.div>
              </form>

              {/* Register Link */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="mt-6 pt-5 border-t"
              >
                <p className="text-center text-sm text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    className="text-primary hover:underline font-semibold inline-flex items-center gap-1 group"
                    onClick={() => navigate('register')}
                  >
                    Create Account
                    <span className="inline-block group-hover:translate-x-0.5 transition-transform">&rarr;</span>
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
