'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CreditCard,
  Truck,
  MapPin,
  ChevronRight,
  Loader2,
  ShieldCheck,
  Gift,
  CheckCircle2,
  Wallet,
  Banknote,
  ArrowLeft,
  Tag,
  Phone,
  User,
  Mail,
  AlertCircle,
  X,
  Sparkles,
  Package,
  Edit2,
  Trash2,
  Check,
  ChevronDown,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAppStore } from '@/lib/store'
import { extractItems } from '@/lib/api'
import { formatPrice } from '@/lib/utils'
import CheckoutStepIndicator from '@/components/shared/CheckoutStepIndicator'
import SmartAddressForm from '@/components/shared/SmartAddressForm'
import {
  packSmartAddress,
  unpackSmartAddress,
  type SmartAddressData,
} from '@/lib/bangladesh-address'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Address {
  id: string
  name: string
  phone: string
  address: string
  city: string
  district?: string
  postalCode?: string
  isDefault: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    cartItems,
    subtotal,
    totalItems,
    navigate,
    isAuthenticated,
    user,
    setUser,
    siteConfig,
    clearCart,
  } = useAppStore()

  // Safe redirect to /cart when cart is empty
  useEffect(() => {
    if (cartItems.length === 0) {
      router.replace('/cart')
    }
  }, [cartItems.length, router])

  // Addresses
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [showAddAddress, setShowAddAddress] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [savingAddress, setSavingAddress] = useState(false)

  // Step Controls (1 to 5)
  const [currentStep, setCurrentStep] = useState(1)
  const [maxReachedStep, setMaxReachedStep] = useState(1)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Guest Contact & Verification State
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestOtpCode, setGuestOtpCode] = useState('')
  const [guestOtpSent, setGuestOtpSent] = useState(false)
  const [guestOtpSending, setGuestOtpSending] = useState(false)
  const [guestOtpVerifying, setGuestOtpVerifying] = useState(false)
  const [guestOtpCooldown, setGuestOtpCooldown] = useState(0)
  const [guestPhoneVerified, setGuestPhoneVerified] = useState(false)
  const [checkoutProof, setCheckoutProof] = useState<string | null>(null)

  // Guest Smart Address Data
  const [guestSmartData, setGuestSmartData] = useState<SmartAddressData | null>(null)

  // Phone OTP Verification State for logged-in accounts
  const [otpPhone, setOtpPhone] = useState(user?.phone || '')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [otpCooldown, setOtpCooldown] = useState(0)

  // Delivery & Payment States
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard')
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod')
  const [note, setNote] = useState('')

  // Coupon States
  const [couponCode, setCouponCode] = useState('')
  const [discount, setDiscount] = useState(0)
  const [couponApplied, setCouponApplied] = useState(false)
  const [showCouponInput, setShowCouponInput] = useState(true)

  // Submission States
  const [termsAccepted, setTermsAccepted] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false)
  const [paymentCallbackBanner, setPaymentCallbackBanner] = useState<'cancel' | 'fail' | null>(null)

  // Sync Logged-in User Phone
  useEffect(() => {
    if (user?.phone) {
      setOtpPhone(user.phone)
    }
  }, [user?.phone])

  // Cooldown Timers
  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown((c) => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [otpCooldown])

  useEffect(() => {
    if (guestOtpCooldown > 0) {
      const timer = setTimeout(() => setGuestOtpCooldown((c) => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [guestOtpCooldown])

  // Gateway return parameter notice
  useEffect(() => {
    const paymentParam = searchParams.get('payment')
    if (paymentParam === 'cancel') {
      setPaymentCallbackBanner('cancel')
      toast.error('Payment Cancelled', {
        description: 'আপনার পেমেন্ট বাতিল করা হয়েছে। ক্যাশ অন ডেলিভারি বেছে নিতে পারেন।',
        duration: 8000,
      })
    } else if (paymentParam === 'fail') {
      setPaymentCallbackBanner('fail')
      toast.error('Payment Failed', {
        description: 'পেমেন্ট সম্পন্ন হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন বা ক্যাশ অন ডেলিভারি বেছে নিন।',
        duration: 8000,
      })
    }
  }, [searchParams])

  // Load user addresses on mount
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetch(`/api/addresses?userId=${user.id}`)
        .then((r) => r.json())
        .then((data) => {
          const addrs = extractItems<Address>(data)
          setAddresses(addrs)
          const defaultAddr = addrs.find((a: Address) => a.isDefault)
          if (defaultAddr) setSelectedAddressId(defaultAddr.id)
          else if (addrs.length > 0) setSelectedAddressId(addrs[0].id)
        })
        .catch(() => {})
    }
  }, [isAuthenticated, user?.id])

  // Calculations
  const sub = subtotal()
  const standardShipping = siteConfig?.shippingCharge || 60
  const expressShipping = 120
  const freeThreshold = siteConfig?.freeShippingThreshold || 1500
  const onlinePaymentEnabled = siteConfig?.enableOnlinePayment === true
  const codEnabled = siteConfig?.enableCod !== false

  useEffect(() => {
    if (!onlinePaymentEnabled && paymentMethod === 'online') {
      setPaymentMethod('cod')
    }
  }, [onlinePaymentEnabled, paymentMethod])

  let shipping = standardShipping
  if (sub >= freeThreshold) {
    shipping = 0
  }
  if (shippingMethod === 'express') {
    shipping = expressShipping
    if (sub >= freeThreshold) {
      shipping = expressShipping - standardShipping
    }
  }

  const total = Math.max(0, sub + shipping - discount)
  const freeShippingProgress = Math.min((sub / freeThreshold) * 100, 100)
  const freeShippingRemaining = Math.max(freeThreshold - sub, 0)

  // ─── Step Validation ──────────────────────────────────────────────────────
  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {}

    if (cartItems.length === 0) {
      toast.error('আপনার কার্ট খালি। অনুগ্রহ করে পণ্য যোগ করুন।')
      return false
    }

    if (step === 1) {
      if (isAuthenticated && user?.id) {
        if (!user.isVerified || !user.phone) {
          errors.phoneVerification = 'অর্ডার করতে আপনার মোবাইল নম্বর ও ওটিপি ভেরিফাই করুন'
          toast.error('ফোন নম্বর ভেরিফিকেশন আবশ্যক', {
            description: 'অর্ডার নিশ্চিত করতে অনুগ্রহ করে আপনার মোবাইল নম্বর ভেরিফাই করুন।',
          })
        }
      } else {
        if (!guestName.trim()) {
          errors.guestName = 'আপনার নাম লিখুন'
          toast.error('আপনার পূর্ণ নাম লিখুন')
        } else if (!guestPhone.trim()) {
          errors.guestPhone = 'মোবাইল নম্বর লিখুন'
          toast.error('মোবাইল নম্বর লিখুন')
        } else if (!guestPhoneVerified || !checkoutProof) {
          errors.guestPhone = 'মোবাইল নম্বর ওটিপি দিয়ে ভেরিফাই করুন'
          toast.error('মোবাইল নম্বর ওটিপি দিয়ে ভেরিফাই করুন', {
            description: 'নিরাপদ অর্ডারের জন্য আপনার নম্বরে ওটিপি কোড পাঠিয়ে ভেরিফাই সম্পন্ন করুন।',
          })
        }
      }
    } else if (step === 2) {
      if (isAuthenticated && user?.id) {
        if (!selectedAddressId) {
          errors.address = 'ডেলিভারি ঠিকানা নির্বাচন করুন'
          toast.error('ডেলিভারি ঠিকানা নির্বাচন করুন')
        }
      } else {
        if (!guestSmartData || !guestSmartData.addressDetail) {
          errors.guestAddress = 'অনুগ্রহ করে ডেলিভারি ঠিকানা সম্পন্ন করুন'
          toast.error('ডেলিভারি ঠিকানা সম্পূর্ণ করুন')
        }
      }
    } else if (step === 4) {
      if (paymentMethod === 'cod' && !codEnabled) {
        errors.payment = 'ক্যাশ অন ডেলিভারি সাময়িকভাবে বন্ধ রয়েছে'
        toast.error('ক্যাশ অন ডেলিভারি বন্ধ রয়েছে')
      } else if (paymentMethod === 'online' && !onlinePaymentEnabled) {
        errors.payment = 'অনলাইন পেমেন্ট সাময়িকভাবে বন্ধ রয়েছে'
        toast.error('অনলাইন পেমেন্ট বন্ধ রয়েছে')
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ─── Step Navigation ──────────────────────────────────────────────────────
  const goToStep = (step: number) => {
    if (step > currentStep) {
      for (let s = currentStep; s < step; s++) {
        if (!validateStep(s)) return
      }
    }
    setCurrentStep(step)
    setMaxReachedStep((prev) => Math.max(prev, step))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ─── OTP Phone Verification Handlers (Logged-in User) ──────────────────────
  const handleSendOtp = async () => {
    if (!otpPhone.trim()) {
      toast.error('অনুগ্রহ করে একটি সচল ১১ ডিজিটের মোবাইল নম্বর লিখুন')
      return
    }
    setOtpSending(true)
    try {
      const token = useAppStore.getState().accessToken
      const res = await fetch('/api/auth/verify-phone/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phone: otpPhone.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'ভেরিফিকেশন কোড পাঠানো সম্ভব হয়নি')
      }
      setOtpSent(true)
      setOtpCooldown(60)
      toast.success('ভেরিফিকেশন কোড পাঠানো হয়েছে', {
        description: `${otpPhone} নম্বরে ৬ ডিজিটের কোড পাঠানো হয়েছে।`,
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'ভেরিফিকেশন কোড পাঠানো ব্যর্থ হয়েছে')
    } finally {
      setOtpSending(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      toast.error('অনুগ্রহ করে সঠিক ৬ ডিজিটের ওটিপি কোড লিখুন')
      return
    }
    setOtpVerifying(true)
    try {
      const token = useAppStore.getState().accessToken
      const res = await fetch('/api/auth/verify-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phone: otpPhone.trim(), code: otpCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'ভেরিফিকেশন কোডটি সঠিক নয় বা মেয়াদোত্তীর্ণ হয়েছে')
      }
      if (user) {
        setUser({
          ...user,
          phone: otpPhone.trim(),
          isVerified: true,
        })
      }
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next.phoneVerification
        return next
      })
      toast.success('মোবাইল নম্বর সফলভাবে ভেরিফাই হয়েছে!', {
        description: 'এখন আপনি নিরাপদে আপনার অর্ডার সম্পন্ন করতে পারবেন।',
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'ভেরিফিকেশন ব্যর্থ হয়েছে')
    } finally {
      setOtpVerifying(false)
    }
  }

  // ─── Guest OTP Handlers ──────────────────────────────────────────────────
  const handleSendGuestOtp = async () => {
    const raw = guestPhone.trim()
    const cleaned = raw.replace(/[\s-]/g, '').replace(/^(\+?88)/, '')
    const valid = /^01[3-9]\d{8}$/.test(cleaned.startsWith('01') ? cleaned : '0' + cleaned)
    if (!valid) {
      toast.error('অনুগ্রহ করে সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)')
      return
    }
    setGuestOtpSending(true)
    try {
      const res = await fetch('/api/auth/guest-phone/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: raw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ওটিপি পাঠাতে সমস্যা হয়েছে')
      setGuestOtpSent(true)
      setGuestOtpCooldown(60)
      toast.success('ভেরিফিকেশন কোড পাঠানো হয়েছে!', {
        description: `${raw} নম্বরে ৬ ডিজিটের ওটিপি পাঠানো হয়েছে।`,
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'ওটিপি পাঠাতে সমস্যা হয়েছে')
    } finally {
      setGuestOtpSending(false)
    }
  }

  const handleVerifyGuestOtp = async () => {
    if (!guestOtpCode.trim() || guestOtpCode.trim().length !== 6) {
      toast.error('অনুগ্রহ করে ৬ ডিজিটের ওটিপি কোড লিখুন')
      return
    }
    setGuestOtpVerifying(true)
    try {
      const res = await fetch('/api/auth/guest-phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: guestPhone.trim(), code: guestOtpCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.data?.checkoutProof) {
        throw new Error(data.error || 'ওটিপি কোডটি সঠিক নয় বা মেয়াদোত্তীর্ণ হয়েছে')
      }
      setCheckoutProof(data.data.checkoutProof)
      setGuestPhoneVerified(true)
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next.guestPhone
        return next
      })
      toast.success('মোবাইল নম্বর সফলভাবে যাচাই হয়েছে!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'যাচাই ব্যর্থ হয়েছে')
    } finally {
      setGuestOtpVerifying(false)
    }
  }

  // ─── Coupon ───────────────────────────────────────────────────────────────
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, totalAmount: sub }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'অবৈধ কুপন কোড')
        return
      }
      const discountAmount =
        data.type === 'percentage'
          ? Math.min(sub * (data.value / 100), data.maxDiscount || Infinity)
          : data.value
      setDiscount(discountAmount)
      setCouponApplied(true)
      toast.success('কুপন সফলভাবে যুক্ত হয়েছে!', {
        description: `${formatPrice(discountAmount)} ছাড় পাওয়া গেছে।`,
      })
    } catch {
      toast.error('কুপন যাচাই করতে সমস্যা হয়েছে')
    }
  }

  // ─── Smart Address Save Handler (Instant Sync & Auto-Select) ──────────────
  const handleSaveSmartAddress = async (smart: SmartAddressData) => {
    if (!user?.id) return
    setSavingAddress(true)
    try {
      const token = useAppStore.getState().accessToken
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const packed = packSmartAddress(smart)
      const isFirst = addresses.length === 0
      const setAsDefault = isFirst || !!smart.isDefault

      const isEdit = Boolean(editingAddressId)
      const url = isEdit ? `/api/addresses/${editingAddressId}` : '/api/addresses'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          userId: user.id,
          ...packed,
          isDefault: setAsDefault,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ঠিকানা সংরক্ষণ করা যায়নি')
      }

      const savedAddress: Address = data.data || data
      if (!savedAddress?.id) throw new Error('সংরক্ষিত ঠিকানার তথ্য সঠিক নয়')

      setAddresses((prev) => {
        const updated = setAsDefault
          ? prev.map((a) => ({ ...a, isDefault: false }))
          : [...prev]
        if (isEdit) {
          return updated.map((a) => (a.id === editingAddressId ? savedAddress : a))
        }
        return [savedAddress, ...updated.filter((a) => a.id !== savedAddress.id)]
      })

      setSelectedAddressId(savedAddress.id)
      setShowAddAddress(false)
      setEditingAddressId(null)
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next.address
        return next
      })

      toast.success(isEdit ? 'ঠিকানা আপডেট হয়েছে' : 'নতুন ঠিকানা সফলভাবে যুক্ত হয়েছে')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'ঠিকানা সংরক্ষণ করা যায়নি')
    } finally {
      setSavingAddress(false)
    }
  }

  const handleDeleteAddress = async (addressId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const token = useAppStore.getState().accessToken
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`/api/addresses/${addressId}`, {
        method: 'DELETE',
        headers,
      })

      if (!res.ok) throw new Error('Failed to delete address')

      setAddresses((prev) => {
        const filtered = prev.filter((a) => a.id !== addressId)
        if (selectedAddressId === addressId) {
          setSelectedAddressId(filtered[0]?.id || '')
        }
        return filtered
      })
      toast.success('ঠিকানা মুছে ফেলা হয়েছে')
    } catch {
      toast.error('ঠিকানা মুছে ফেলা সম্ভব হয়নি')
    }
  }

  // ─── Place Order ──────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (placing) return // prevent duplicate submissions

    for (let s = 1; s <= 4; s++) {
      if (!validateStep(s)) {
        setCurrentStep(s)
        return
      }
    }

    if (!termsAccepted) {
      toast.error('শর্তাবলী সম্মতি আবশ্যক', {
        description: 'অর্ডার করতে অনুগ্রহ করে শর্তাবলী ও ডেলিভারি নীতি মেনে নিন।',
      })
      return
    }

    setPlacing(true)
    try {
      const orderData: Record<string, unknown> = {
        paymentMethod,
        shippingMethod,
        orderNote: note,
        couponCode: couponCode || undefined,
        discountAmount: discount,
        deliveryCharge: shipping,
        totalAmount: total,
        items: cartItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          price: item.discountPrice != null ? item.discountPrice : item.price,
          image: item.image,
        })),
      }

      if (isAuthenticated && user?.id) {
        orderData.userId = user.id
        orderData.addressId = selectedAddressId
      } else if (guestSmartData) {
        orderData.guestName = guestSmartData.name || guestName
        orderData.guestPhone = guestSmartData.phone || guestPhone
        orderData.guestEmail = guestSmartData.email || guestEmail || undefined
        const packedGuest = packSmartAddress(guestSmartData)
        orderData.guestAddress = packedGuest.address
        orderData.checkoutProof = checkoutProof
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(useAppStore.getState().accessToken
            ? { Authorization: `Bearer ${useAppStore.getState().accessToken}` }
            : {}),
        },
        body: JSON.stringify(orderData),
      })

      if (!res.ok) {
        const data = await res.json()
        if (data.code === 'PHONE_UNVERIFIED') {
          setCurrentStep(1)
          setFormErrors((prev) => ({
            ...prev,
            phoneVerification:
              data.error || 'অর্ডার করতে আপনার মোবাইল নম্বর ও ওটিপি ভেরিফাই করুন',
          }))
        }
        throw new Error(data.error || 'অর্ডার সম্পন্ন করতে সমস্যা হয়েছে')
      }

      const orderRes = await res.json()
      const order = orderRes.data || orderRes
      const orderId = order.id
      const orderNum = order.orderNumber
      const rawGuestToken = orderRes.guestAccessToken || order.guestAccessToken || null

      if (paymentMethod === 'online') {
        const initRes = await fetch('/api/payments/sslcommerz/initiate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(useAppStore.getState().accessToken
              ? { Authorization: `Bearer ${useAppStore.getState().accessToken}` }
              : {}),
          },
          body: JSON.stringify({
            orderId,
            ...(rawGuestToken ? { guestAccessToken: rawGuestToken } : {}),
          }),
        })
        const initData = await initRes.json()

        if (initData.success && initData.data?.gatewayPageURL) {
          window.location.href = initData.data.gatewayPageURL
          return
        } else {
          throw new Error(initData.error || 'পেমেন্ট গেটওয়ে চালু করতে সমস্যা হয়েছে')
        }
      } else {
        await clearCart()
        toast.success('অর্ডার সফলভাবে সম্পন্ন হয়েছে!', {
          description: `অর্ডার নম্বর: #${orderNum}`,
        })
        router.push(`/orders/${encodeURIComponent(orderNum)}`)
        navigate('order-confirmation', { orderId, orderNumber: orderNum })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'অর্ডার নিশ্চিত করা যায়নি')
      setPlacing(false)
    }
  }

  // ─── Empty Cart Screen ────────────────────────────────────────────────────
  if (cartItems.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="h-16 w-16 bg-muted/60 rounded-full flex items-center justify-center mb-4 text-muted-foreground">
          <Package className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">আপনার কার্ট খালি</h2>
        <p className="text-sm text-muted-foreground mb-6">
          অর্ডার সম্পন্ন করতে প্রথমে পণ্য নির্বাচন করে কার্টে যোগ করুন।
        </p>
        <Button onClick={() => navigate('products')} className="rounded-xl px-6">
          পণ্য ব্রাউজ করুন
        </Button>
      </div>
    )
  }

  // ─── Section Header ────────────────────────────────────────────────────────
  const SectionHeader = ({
    icon: Icon,
    title,
    subtitle,
    badge,
  }: {
    icon: typeof MapPin
    title: string
    subtitle?: string
    badge?: string
  }) => (
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </div>
        <span>{title}</span>
        {badge && (
          <Badge variant="secondary" className="ml-auto text-xs font-semibold">
            {badge}
          </Badge>
        )}
      </CardTitle>
      {subtitle && <p className="text-xs text-muted-foreground mt-1 ml-10">{subtitle}</p>}
    </CardHeader>
  )

  // ─── Order Items Summary ──────────────────────────────────────────────────
  const renderSummaryItems = (compact = false) => (
    <div
      className={`space-y-3 ${
        compact ? 'max-h-[40vh] overflow-y-auto pr-1' : 'max-h-72 overflow-y-auto pr-1'
      }`}
    >
      {cartItems.map((item) => {
        const itemPrice = item.discountPrice != null ? item.discountPrice : item.price
        return (
          <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card/60">
            <div className="relative h-12 w-12 rounded-lg bg-muted/40 flex-shrink-0 overflow-hidden border">
              <Image
                src={item.image}
                alt={item.productName}
                fill
                className="object-cover"
                sizes="48px"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
              <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                {item.quantity}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.productName}</p>
              <p className="text-xs text-muted-foreground">
                {formatPrice(itemPrice)} {item.unit && `· per ${item.unit}`}
              </p>
            </div>
            <span className="text-sm font-semibold whitespace-nowrap text-emerald-700">
              {formatPrice(itemPrice * item.quantity)}
            </span>
          </div>
        )
      })}
    </div>
  )

  const renderTotals = () => (
    <div className="space-y-2.5 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">সাবটোটাল ({totalItems()} টি পণ্য)</span>
        <span className="font-medium">{formatPrice(sub)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">
          ডেলিভারি চার্জ ({shippingMethod === 'express' ? 'এক্সপ্রেস' : 'স্ট্যান্ডার্ড'})
        </span>
        <span className={`font-medium ${shipping === 0 ? 'text-emerald-600' : ''}`}>
          {shipping === 0 ? 'ফ্রি (FREE)' : formatPrice(shipping)}
        </span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">কুপন ডিসকাউন্ট</span>
          <span className="text-emerald-600 font-medium">-{formatPrice(discount)}</span>
        </div>
      )}
      <Separator />
      <div className="flex justify-between items-center pt-1">
        <span className="font-semibold text-base">মোট প্রদেয় (Grand Total)</span>
        <motion.span
          key={total}
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
          className="text-2xl font-bold text-emerald-700"
        >
          {formatPrice(total)}
        </motion.span>
      </div>
      {discount > 0 && (
        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-emerald-700 font-semibold">
            আপনি এই অর্ডারে {formatPrice(discount)} সাশ্রয় করছেন!
          </span>
        </div>
      )}
    </div>
  )

  const renderCouponSection = () => (
    <div className="space-y-2">
      <button
        type="button"
        className="flex items-center justify-between w-full text-left"
        onClick={() => setShowCouponInput(!showCouponInput)}
      >
        <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 cursor-pointer">
          <Tag className="h-3.5 w-3.5 text-emerald-600" />
          কুপন কোড ব্যবহার করুন (Coupon)
        </Label>
        {showCouponInput ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {showCouponInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {couponApplied ? (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
                    <Gift className="h-3 w-3 mr-1" />
                    {couponCode}
                  </Badge>
                  <span className="text-xs text-emerald-700 font-semibold">
                    -{formatPrice(discount)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCouponCode('')
                    setDiscount(0)
                    setCouponApplied(false)
                  }}
                  className="text-red-500 h-7 text-xs hover:text-red-600 hover:bg-red-50"
                >
                  <X className="h-3 w-3 mr-0.5" /> মুছুন
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="কুপন কোড লিখুন"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value)
                    if (couponApplied) {
                      setDiscount(0)
                      setCouponApplied(false)
                    }
                  }}
                  className="h-10 text-sm rounded-xl"
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                />
                <Button
                  variant="outline"
                  onClick={handleApplyCoupon}
                  className="h-10 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 font-semibold px-4 rounded-xl"
                >
                  প্রয়োগ
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  const renderFreeShippingProgress = () => {
    if (freeShippingRemaining <= 0) {
      return (
        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs">
          <Truck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold text-emerald-700">
            অভিনন্দন! আপনি ফ্রি ডেলিভারি পাচ্ছেন!
          </span>
        </div>
      )
    }
    return (
      <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-amber-800 font-medium flex items-center gap-1">
            <Truck className="h-3.5 w-3.5" />
            আর {formatPrice(freeShippingRemaining)} টাকার কেনাকাটায় ফ্রি ডেলিভারি
          </span>
        </div>
        <Progress
          value={freeShippingProgress}
          className="h-1.5 bg-amber-200 [&>div]:bg-amber-500"
        />
      </div>
    )
  }

  // Sidebar Summary Card
  const SummaryCard = (
    <Card className="shadow-md rounded-2xl border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-600" />
            অর্ডার সামারি
          </span>
          <Badge variant="secondary" className="text-xs font-semibold">
            {totalItems()} টি পণ্য
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderFreeShippingProgress()}
        {renderSummaryItems()}
        <Separator />
        {renderCouponSection()}
        <Separator />
        {renderTotals()}
      </CardContent>
    </Card>
  )

  const selectedAddrObj = addresses.find((a) => a.id === selectedAddressId)
  const selectedSmartAddr = selectedAddrObj ? unpackSmartAddress(selectedAddrObj) : null

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-stone-50/50 pb-12">
      {/* Compact Header */}
      <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            aria-label="Khati Khadyo - Go to homepage"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-md"
          >
            {siteConfig?.logo ? (
              <img src={siteConfig.logo} alt="Khati Khadyo" className="h-7 w-auto object-contain" />
            ) : (
              <img src="/all_logo.png" alt="Khati Khadyo" className="h-7 w-auto object-contain" />
            )}
            <span className="font-bold text-base hidden sm:block text-stone-900">খাঁটি খাদ্য</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl text-xs font-medium text-stone-600 hover:text-stone-900"
            onClick={() => navigate('cart')}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            কার্টে ফিরে যান
          </Button>
        </div>
      </div>

      {/* 5-Step Checkout Progress Indicator */}
      <CheckoutStepIndicator
        currentStep={currentStep}
        onStepClick={goToStep}
        maxReachedStep={maxReachedStep}
      />

      {/* Main Container */}
      <div className="flex-1 container mx-auto px-4 py-6 sm:py-8">
        <h1 className="sr-only">Checkout - Complete Your Order</h1>

        {/* Gateway Callback Banner */}
        {paymentCallbackBanner && (
          <div
            role="alert"
            className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${
              paymentCallbackBanner === 'fail'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold mb-0.5">
                {paymentCallbackBanner === 'fail' ? 'পেমেন্ট ব্যর্থ হয়েছে' : 'পেমেন্ট বাতিল হয়েছে'}
              </p>
              <p className="text-xs opacity-90">
                {paymentCallbackBanner === 'fail'
                  ? 'আপনার পেমেন্ট সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন বা ক্যাশ অন ডেলিভারি বেছে নিন।'
                  : 'আপনি পেমেন্ট সম্পন্ন করেননি। কোনো টাকা কাটা হয়নি। আপনি পুনরায় চেষ্টা করতে পারেন অথবা ক্যাশ অন ডেলিভারি বেছে নিতে পারেন।'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPaymentCallbackBanner(null)}
              aria-label="Dismiss"
              className="text-current opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column: Checkout Step Forms */}
          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence mode="wait">
              {/* ─── STEP 1: Contact & Phone Verification ───────────────────── */}
              {currentStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <Card className="shadow-sm rounded-2xl border border-stone-200">
                    <SectionHeader
                      icon={Phone}
                      title="১. যোগাযোগ ও মোবাইল নম্বর যাচাই (Contact & Phone)"
                      subtitle="অর্ডার সুরক্ষার স্বার্থে মোবাইল নম্বর ওটিপি দিয়ে ভেরিফাই আবশ্যক"
                      badge="Step 1 of 5"
                    />
                    <CardContent className="space-y-5 pt-0">
                      {isAuthenticated && user?.id ? (
                        /* Authenticated User View */
                        <div className="space-y-4">
                          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <p className="text-xs text-stone-500">লগইন করা অ্যাকাউন্ট</p>
                              <p className="text-sm font-bold text-stone-900 mt-0.5">
                                {user.name || 'সম্মানিত গ্রাহক'}
                              </p>
                              <p className="text-xs text-stone-600 font-mono">
                                {user.email || user.phone}
                              </p>
                            </div>
                            <div>
                              {user.isVerified && user.phone ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs px-2.5 py-1 flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                  <span>ফোন নম্বর ভেরিফাইড</span>
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs px-2.5 py-1">
                                  ভেরিফিকেশন আবশ্যক
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* If Logged-in user's phone is unverified */}
                          {(!user.isVerified || !user.phone) && (
                            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-4">
                              <p className="text-xs font-semibold text-amber-900">
                                অর্ডার নিশ্চিত করতে আপনার ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর ওটিপি দিয়ে ভেরিফাই করুন:
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                                <div className="space-y-1.5">
                                  <Label htmlFor="auth-otp-phone" className="text-xs font-medium text-stone-700">
                                    মোবাইল নম্বর <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    id="auth-otp-phone"
                                    type="tel"
                                    value={otpPhone}
                                    onChange={(e) => setOtpPhone(e.target.value)}
                                    placeholder="01XXXXXXXXX"
                                    disabled={otpSending || (otpSent && otpCooldown > 0)}
                                    className="bg-white"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  onClick={handleSendOtp}
                                  disabled={otpSending || (otpSent && otpCooldown > 0)}
                                  className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                                >
                                  {otpSending ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> কোড পাঠানো হচ্ছে...
                                    </>
                                  ) : otpCooldown > 0 ? (
                                    `আবার কোড পাঠান (${otpCooldown}s)`
                                  ) : otpSent ? (
                                    'পুনরায় কোড পাঠান'
                                  ) : (
                                    'ওটিপি কোড পাঠান (Send OTP)'
                                  )}
                                </Button>
                              </div>

                              {otpSent && (
                                <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-3">
                                  <div className="flex items-center gap-2 text-xs text-stone-600">
                                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                    <span>{otpPhone} নম্বরে ৬ ডিজিটের ভেরিফিকেশন কোড পাঠানো হয়েছে।</span>
                                  </div>
                                  <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                                    <Input
                                      type="text"
                                      maxLength={6}
                                      value={otpCode}
                                      onChange={(e) =>
                                        setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                                      }
                                      placeholder="৬ ডিজিটের কোড"
                                      className="w-full sm:w-48 text-center text-lg tracking-widest font-mono"
                                    />
                                    <Button
                                      type="button"
                                      onClick={handleVerifyOtp}
                                      disabled={otpVerifying || otpCode.length !== 6}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-6 font-semibold text-xs"
                                    >
                                      {otpVerifying ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> যাচাই হচ্ছে...
                                        </>
                                      ) : (
                                        <>
                                          <Check className="h-4 w-4 mr-1.5" /> যাচাই সম্পন্ন করুন
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Guest Contact & Phone Verification View */
                        <div className="space-y-4">
                          <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs flex items-center justify-between">
                            <span className="text-amber-900 font-medium">
                              গেস্ট হিসেবে দ্রুত অর্ডার করছেন (Guest Checkout)
                            </span>
                            <button
                              type="button"
                              onClick={() => navigate('login')}
                              className="text-emerald-700 font-bold hover:underline"
                            >
                              লগইন করুন →
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Guest Name */}
                            <div className="space-y-1.5">
                              <Label htmlFor="guest-name" className="text-xs font-medium text-stone-700">
                                আপনার পূর্ণ নাম <span className="text-red-500">*</span>
                              </Label>
                              <div className="relative">
                                <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <Input
                                  id="guest-name"
                                  value={guestName}
                                  onChange={(e) => setGuestName(e.target.value)}
                                  placeholder="যেমন: মোঃ আব্দুল্লাহ"
                                  className="pl-9 h-11 text-sm bg-white"
                                />
                              </div>
                            </div>

                            {/* Guest Email (Optional) */}
                            <div className="space-y-1.5">
                              <Label htmlFor="guest-email" className="text-xs font-medium text-stone-700">
                                ইমেইল এড্রেস (ঐচ্ছিক)
                              </Label>
                              <div className="relative">
                                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <Input
                                  id="guest-email"
                                  type="email"
                                  value={guestEmail}
                                  onChange={(e) => setGuestEmail(e.target.value)}
                                  placeholder="email@example.com"
                                  className="pl-9 h-11 text-sm bg-white"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Guest Phone Verification Box */}
                          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-4">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="guest-phone" className="text-xs font-semibold text-stone-800">
                                মোবাইল নম্বর (ওটিপি যাচাই আবশ্যক) <span className="text-red-500">*</span>
                              </Label>
                              {guestPhoneVerified && (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs px-2.5 py-0.5 flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                  <span>যাচাইকৃত (Verified)</span>
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                              <div className="relative flex-1">
                                <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <Input
                                  id="guest-phone"
                                  type="tel"
                                  value={guestPhone}
                                  onChange={(e) => {
                                    setGuestPhone(e.target.value)
                                    if (guestPhoneVerified) {
                                      setGuestPhoneVerified(false)
                                      setCheckoutProof(null)
                                      setGuestOtpSent(false)
                                    }
                                  }}
                                  disabled={guestPhoneVerified}
                                  placeholder="01XXXXXXXXX"
                                  className="pl-9 h-11 text-sm bg-white"
                                />
                              </div>

                              {!guestPhoneVerified ? (
                                <Button
                                  type="button"
                                  onClick={handleSendGuestOtp}
                                  disabled={guestOtpSending || (guestOtpSent && guestOtpCooldown > 0)}
                                  className="h-11 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs whitespace-nowrap"
                                >
                                  {guestOtpSending ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> পাঠানো হচ্ছে...
                                    </>
                                  ) : guestOtpCooldown > 0 ? (
                                    `পুনরায় পাঠান (${guestOtpCooldown}s)`
                                  ) : guestOtpSent ? (
                                    'পুনরায় পাঠান'
                                  ) : (
                                    'ওটিপি পাঠান (Send OTP)'
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setGuestPhoneVerified(false)
                                    setCheckoutProof(null)
                                    setGuestOtpSent(false)
                                  }}
                                  className="h-11 px-4 text-xs font-semibold"
                                >
                                  নম্বর পরিবর্তন করুন
                                </Button>
                              )}
                            </div>

                            {/* OTP Entry Card for Guest */}
                            {!guestPhoneVerified && guestOtpSent && (
                              <div className="p-3.5 bg-white rounded-xl border border-stone-200/90 space-y-3">
                                <div className="flex items-center gap-2 text-xs text-stone-600">
                                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                  <span>{guestPhone} নম্বরে পাঠানো ৬ ডিজিটের কোডটি লিখুন:</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                                  <Input
                                    type="text"
                                    maxLength={6}
                                    value={guestOtpCode}
                                    onChange={(e) =>
                                      setGuestOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                                    }
                                    placeholder="৬ ডিজিটের কোড"
                                    className="w-full sm:w-48 text-center text-lg tracking-widest font-mono h-11"
                                  />
                                  <Button
                                    type="button"
                                    onClick={handleVerifyGuestOtp}
                                    disabled={guestOtpVerifying || guestOtpCode.trim().length !== 6}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-6 font-semibold text-xs"
                                  >
                                    {guestOtpVerifying ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> যাচাই হচ্ছে...
                                      </>
                                    ) : (
                                      <>
                                        <Check className="w-4 h-4 mr-1.5" /> ওটিপি নিশ্চিত করুন
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Step 1 Proceed Button */}
                      <div className="pt-2">
                        <Button
                          type="button"
                          onClick={() => goToStep(2)}
                          className="w-full h-12 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-2"
                        >
                          <span>ডেলিভারি ঠিকানায় এগিয়ে যান (Continue to Address)</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ─── STEP 2: Delivery Address ─────────────────────────────────── */}
              {currentStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <Card className="shadow-sm rounded-2xl border border-stone-200">
                    <SectionHeader
                      icon={MapPin}
                      title="২. ডেলিভারি ঠিকানা (Delivery Address)"
                      subtitle="আপনার পণ্য পৌঁছানোর পূর্ণাঙ্গ ঠিকানা নির্বাচন বা নিশ্চিত করুন"
                      badge="Step 2 of 5"
                    />
                    <CardContent className="space-y-4 pt-0">
                      {isAuthenticated && user?.id ? (
                        <>
                          {/* Saved Addresses Cards */}
                          {addresses.length > 0 && !showAddAddress && !editingAddressId && (
                            <div className="space-y-3">
                              <RadioGroup
                                value={selectedAddressId}
                                onValueChange={(val) => {
                                  setSelectedAddressId(val)
                                  setFormErrors((prev) => {
                                    const next = { ...prev }
                                    delete next.address
                                    return next
                                  })
                                }}
                                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                              >
                                {addresses.map((addr) => {
                                  const isSelected = selectedAddressId === addr.id
                                  const smart = unpackSmartAddress(addr)
                                  return (
                                    <div
                                      key={addr.id}
                                      onClick={() => setSelectedAddressId(addr.id)}
                                      className={`relative rounded-2xl p-4 border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                                        isSelected
                                          ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                                          : 'border-stone-200 bg-white hover:border-emerald-300'
                                      }`}
                                    >
                                      <div>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                          <div className="flex items-center gap-2">
                                            <RadioGroupItem value={addr.id} id={addr.id} className="mt-0.5" />
                                            <span className="font-bold text-sm text-stone-900 truncate max-w-[150px]">
                                              {smart.name}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                                              {smart.label || 'Home'}
                                            </Badge>
                                            {addr.isDefault && (
                                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                                                Default
                                              </Badge>
                                            )}
                                          </div>
                                        </div>

                                        <p className="text-xs text-emerald-800 font-semibold mb-1">
                                          📞 {smart.phone} {smart.altPhone ? `(Alt: ${smart.altPhone})` : ''}
                                        </p>

                                        <p className="text-xs text-stone-700 leading-relaxed font-mono">
                                          {smart.addressDetail}
                                        </p>

                                        <p className="text-[11px] text-stone-500 mt-0.5 font-medium">
                                          {smart.unionOrArea ? `${smart.unionOrArea}, ` : ''}
                                          {smart.upazila}, {smart.district}, {smart.division}
                                        </p>

                                        {smart.landmark && (
                                          <p className="text-[11px] text-amber-800 font-semibold mt-1">
                                            📍 Landmark: {smart.landmark}
                                          </p>
                                        )}
                                      </div>

                                      <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-stone-100">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingAddressId(addr.id)
                                          }}
                                          className="h-7 px-2 text-xs text-stone-600 hover:text-stone-900"
                                        >
                                          <Edit2 className="h-3 w-3 mr-1" /> এডিট
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => handleDeleteAddress(addr.id, e)}
                                          className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                          <Trash2 className="h-3 w-3 mr-1" /> মুছুন
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </RadioGroup>

                              {formErrors.address && (
                                <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-1">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  {formErrors.address}
                                </p>
                              )}

                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setEditingAddressId(null)
                                  setShowAddAddress(true)
                                }}
                                className="w-full h-11 border-dashed border-2 rounded-xl border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-600 font-semibold text-xs flex items-center gap-2 justify-center transition-all"
                              >
                                <MapPin className="h-4 w-4" />
                                + নতুন স্মার্ট ঠিকানা যোগ করুন
                              </Button>
                            </div>
                          )}

                          {/* Empty Address State */}
                          {addresses.length === 0 && !showAddAddress && !editingAddressId && (
                            <div className="text-center py-6 border-2 border-dashed rounded-xl bg-stone-50 p-4">
                              <MapPin className="h-8 w-8 text-stone-400 mx-auto mb-2 opacity-50" />
                              <p className="text-sm font-semibold mb-1">কোনো সংরক্ষিত ঠিকানা পাওয়া যায়নি</p>
                              <p className="text-xs text-stone-500 mb-4">
                                অর্ডার নিশ্চিত করতে একটি পূর্ণাঙ্গ ঠিকানা যোগ করুন
                              </p>
                              <Button
                                onClick={() => setShowAddAddress(true)}
                                className="rounded-xl px-6 h-10 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                + নতুন ঠিকানা তৈরি করুন
                              </Button>
                            </div>
                          )}

                          {/* Add Address Smart Form */}
                          {showAddAddress && (
                            <SmartAddressForm
                              initialValues={{ name: user.name || '', phone: user.phone || '' }}
                              onSubmit={handleSaveSmartAddress}
                              onCancel={() => setShowAddAddress(false)}
                              isSubmitting={savingAddress}
                              submitLabel="ঠিকানা সংরক্ষণ ও ব্যবহার করুন"
                            />
                          )}

                          {/* Edit Address Smart Form */}
                          {editingAddressId && (
                            <SmartAddressForm
                              initialValues={
                                addresses.find((a) => a.id === editingAddressId)
                                  ? unpackSmartAddress(addresses.find((a) => a.id === editingAddressId))
                                  : undefined
                              }
                              onSubmit={handleSaveSmartAddress}
                              onCancel={() => setEditingAddressId(null)}
                              isSubmitting={savingAddress}
                              submitLabel="পরিবর্তন সংরক্ষণ করুন"
                            />
                          )}
                        </>
                      ) : (
                        /* Guest Smart Address Form */
                        <div className="space-y-4">
                          <SmartAddressForm
                            initialValues={
                              guestSmartData || {
                                name: guestName,
                                phone: guestPhone,
                                email: guestEmail,
                              }
                            }
                            onSubmit={(data) => {
                              setGuestSmartData(data)
                              setFormErrors((prev) => {
                                const next = { ...prev }
                                delete next.guestAddress
                                return next
                              })
                              toast.success('ডেলিভারি ঠিকানা নিশ্চিত করা হয়েছে!')
                            }}
                            submitLabel="ঠিকানা নিশ্চিত করুন (Confirm Address)"
                            showDefaultCheckbox={false}
                          />
                        </div>
                      )}

                      {/* Navigation Buttons for Step 2 */}
                      <div className="flex gap-3 pt-4 border-t border-stone-200">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => goToStep(1)}
                          className="h-11 px-5 rounded-xl text-xs font-semibold"
                        >
                          <ArrowLeft className="h-4 w-4 mr-1.5" /> পূর্ববর্তী
                        </Button>
                        <Button
                          type="button"
                          onClick={() => goToStep(3)}
                          className="flex-1 h-11 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <span>ডেলিভারি পদ্ধতিতে এগিয়ে যান</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ─── STEP 3: Delivery Method ─────────────────────────────────── */}
              {currentStep === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <Card className="shadow-sm rounded-2xl border border-stone-200">
                    <SectionHeader
                      icon={Truck}
                      title="৩. ডেলিভারি পদ্ধতি (Delivery Method)"
                      subtitle="আপনার পছন্দ অনুযায়ী ডেলিভারি স্পিড নির্বাচন করুন"
                      badge="Step 3 of 5"
                    />
                    <CardContent className="space-y-4 pt-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Standard Delivery */}
                        <div
                          onClick={() => setShippingMethod('standard')}
                          className={`rounded-2xl p-4 border-2 cursor-pointer transition-all ${
                            shippingMethod === 'standard'
                              ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                              : 'border-stone-200 bg-white hover:border-emerald-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Truck className="h-5 w-5 text-emerald-600" />
                              <span className="font-bold text-sm text-stone-900">
                                রেগুলার ডেলিভারি
                              </span>
                            </div>
                            <Badge className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-0.5">
                              {sub >= freeThreshold ? 'ফ্রি' : formatPrice(standardShipping)}
                            </Badge>
                          </div>
                          <p className="text-xs text-stone-500 leading-relaxed">
                            সারা বাংলাদেশে সাধারণত ২-৩ কার্যদিবসের মধ্যে নির্ভরযোগ্য ডেলিভারি।
                          </p>
                        </div>

                        {/* Express Delivery */}
                        <div
                          onClick={() => setShippingMethod('express')}
                          className={`rounded-2xl p-4 border-2 cursor-pointer transition-all ${
                            shippingMethod === 'express'
                              ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                              : 'border-stone-200 bg-white hover:border-emerald-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-5 w-5 text-amber-500" />
                              <span className="font-bold text-sm text-stone-900">
                                এক্সপ্রেস ডেলিভারি
                              </span>
                            </div>
                            <Badge className="bg-amber-500 text-white font-bold text-xs px-2.5 py-0.5">
                              {sub >= freeThreshold
                                ? formatPrice(expressShipping - standardShipping)
                                : formatPrice(expressShipping)}
                            </Badge>
                          </div>
                          <p className="text-xs text-stone-500 leading-relaxed">
                            জরুরি প্রয়োজনে দ্রুততম সময়ে (২৪ ঘণ্টার মধ্যে) ডেলিভারি সুবিধা।
                          </p>
                        </div>
                      </div>

                      {/* Navigation Buttons for Step 3 */}
                      <div className="flex gap-3 pt-4 border-t border-stone-200">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => goToStep(2)}
                          className="h-11 px-5 rounded-xl text-xs font-semibold"
                        >
                          <ArrowLeft className="h-4 w-4 mr-1.5" /> পূর্ববর্তী
                        </Button>
                        <Button
                          type="button"
                          onClick={() => goToStep(4)}
                          className="flex-1 h-11 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <span>পেমেন্ট পদ্ধতিতে এগিয়ে যান</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ─── STEP 4: Payment Method ──────────────────────────────────── */}
              {currentStep === 4 && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <Card className="shadow-sm rounded-2xl border border-stone-200">
                    <SectionHeader
                      icon={CreditCard}
                      title="৪. পেমেন্ট পদ্ধতি (Payment Method)"
                      subtitle="নিরাপদ পেমেন্ট অপশন নির্বাচন করুন"
                      badge="Step 4 of 5"
                    />
                    <CardContent className="space-y-5 pt-0">
                      <RadioGroup
                        value={paymentMethod}
                        onValueChange={(val) => setPaymentMethod(val as 'cod' | 'online')}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                      >
                        {/* COD Option */}
                        {codEnabled ? (
                          <div
                            onClick={() => setPaymentMethod('cod')}
                            className={`rounded-2xl p-4 border-2 cursor-pointer transition-all ${
                              paymentMethod === 'cod'
                                ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                                : 'border-stone-200 bg-white hover:border-emerald-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <RadioGroupItem value="cod" id="cod" />
                              <Label htmlFor="cod" className="font-bold text-sm cursor-pointer flex items-center gap-2 text-stone-900">
                                <Banknote className="h-4 w-4 text-emerald-600" />
                                ক্যাশ অন ডেলিভারি (COD)
                              </Label>
                            </div>
                            <p className="text-xs text-stone-500 ml-6 leading-relaxed">
                              পণ্য হাতে পেয়ে নগদ টাকায় মূল্য পরিশোধ করুন। কোনো অগ্রিম পেমেন্ট নেই।
                            </p>
                          </div>
                        ) : (
                          <div
                            aria-disabled="true"
                            className="rounded-2xl p-4 border-2 border-dashed border-stone-200 bg-stone-50 opacity-60 cursor-not-allowed select-none"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Banknote className="h-4 w-4 text-stone-400" />
                              <span className="font-bold text-sm text-stone-400">ক্যাশ অন ডেলিভারি</span>
                              <Badge variant="outline" className="ml-auto text-[10px] border-stone-300 text-stone-400">
                                অনুপলব্ধ
                              </Badge>
                            </div>
                            <p className="text-xs text-stone-500 leading-snug ml-6">
                              ক্যাশ অন ডেলিভারি সাময়িকভাবে বন্ধ রয়েছে। অনুগ্রহ করে অনলাইন পেমেন্ট বেছে নিন।
                            </p>
                          </div>
                        )}

                        {/* Online Payment (SSLCOMMERZ) */}
                        {onlinePaymentEnabled ? (
                          <div
                            onClick={() => setPaymentMethod('online')}
                            className={`rounded-2xl p-4 border-2 cursor-pointer transition-all ${
                              paymentMethod === 'online'
                                ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                                : 'border-stone-200 bg-white hover:border-emerald-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <RadioGroupItem value="online" id="online" />
                              <Label htmlFor="online" className="font-bold text-sm cursor-pointer flex items-center gap-2 text-stone-900">
                                <Wallet className="h-4 w-4 text-emerald-600" />
                                অনলাইন পেমেন্ট (SSLCOMMERZ)
                              </Label>
                            </div>
                            <p className="text-xs text-stone-500 ml-6 leading-relaxed">
                              বিকাশ, নগদ, রকেট অথবা ডেবিট/ক্রেডিট কার্ড দিয়ে ১০০% সুরক্ষিত অনলাইন পেমেন্ট।
                            </p>
                          </div>
                        ) : (
                          <div
                            aria-disabled="true"
                            className="rounded-2xl p-4 border-2 border-dashed border-stone-200 bg-stone-50 opacity-60 cursor-not-allowed select-none"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Wallet className="h-4 w-4 text-stone-400" />
                              <span className="font-bold text-sm text-stone-400">অনলাইন পেমেন্ট</span>
                              <Badge variant="outline" className="ml-auto text-[10px] border-stone-300 text-stone-400">
                                অনুপলব্ধ
                              </Badge>
                            </div>
                            <p className="text-xs text-stone-500 leading-snug ml-6">
                              অনলাইন পেমেন্ট সাময়িকভাবে বন্ধ রয়েছে। অনুগ্রহ করে ক্যাশ অন ডেলিভারি বেছে নিন।
                            </p>
                          </div>
                        )}
                      </RadioGroup>

                      {/* Order Note */}
                      <div className="pt-2">
                        <Label htmlFor="order-note" className="text-xs font-semibold text-stone-700 mb-1.5 block">
                          ডেলিভারি সংক্রান্ত বিশেষ নির্দেশনা (ঐচ্ছিক)
                        </Label>
                        <Textarea
                          id="order-note"
                          placeholder="যেমন: কল দিয়ে ডেলিভারি করবেন, গেটে রেখে যাবেন ইত্যাদি..."
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          className="text-xs rounded-xl min-h-[70px] resize-none bg-white"
                        />
                      </div>

                      {/* Navigation Buttons for Step 4 */}
                      <div className="flex gap-3 pt-4 border-t border-stone-200">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => goToStep(3)}
                          className="h-11 px-5 rounded-xl text-xs font-semibold"
                        >
                          <ArrowLeft className="h-4 w-4 mr-1.5" /> পূর্ববর্তী
                        </Button>
                        <Button
                          type="button"
                          onClick={() => goToStep(5)}
                          className="flex-1 h-11 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <span>অর্ডার পর্যালোচনায় এগিয়ে যান</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ─── STEP 5: Review & Place Order ───────────────────────────── */}
              {currentStep === 5 && (
                <motion.div
                  key="step-5"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <Card className="shadow-sm rounded-2xl border border-stone-200">
                    <SectionHeader
                      icon={CheckCircle2}
                      title="৫. অর্ডার পর্যালোচনা ও নিশ্চিতকরণ (Review & Place Order)"
                      subtitle="সব তথ্য সঠিক আছে কিনা দেখে অর্ডার সম্পন্ন করুন"
                      badge="Final Step"
                    />
                    <CardContent className="space-y-5 pt-0">
                      {/* Contact & Address Summary */}
                      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-start justify-between gap-3">
                        <div className="flex gap-3">
                          <MapPin className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div className="text-xs space-y-1">
                            <p className="font-semibold text-sm text-stone-900 flex items-center gap-2">
                              ডেলিভারি ঠিকানা
                            </p>
                            {isAuthenticated && selectedSmartAddr ? (
                              <>
                                <p className="font-bold text-stone-900">
                                  {selectedSmartAddr.name} · 📞 {selectedSmartAddr.phone}
                                </p>
                                <p className="text-stone-600 font-mono">
                                  {selectedSmartAddr.addressDetail}
                                </p>
                                <p className="text-stone-500">
                                  {selectedSmartAddr.upazila}, {selectedSmartAddr.district},{' '}
                                  {selectedSmartAddr.division}
                                </p>
                              </>
                            ) : guestSmartData ? (
                              <>
                                <p className="font-bold text-stone-900">
                                  {guestSmartData.name || guestName} · 📞{' '}
                                  {guestSmartData.phone || guestPhone}
                                </p>
                                <p className="text-stone-600 font-mono">
                                  {guestSmartData.addressDetail}
                                </p>
                                <p className="text-stone-500">
                                  {guestSmartData.upazila}, {guestSmartData.district},{' '}
                                  {guestSmartData.division}
                                </p>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => goToStep(2)}
                          className="text-xs text-emerald-700 font-medium h-8"
                        >
                          <Edit2 className="h-3 w-3 mr-1" /> পরিবর্তন
                        </Button>
                      </div>

                      {/* Shipping & Payment Method Summary */}
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-emerald-600" />
                            <div>
                              <p className="font-semibold text-stone-900">ডেলিভারি স্পিড</p>
                              <p className="text-stone-500">
                                {shippingMethod === 'express'
                                  ? 'এক্সপ্রেস ডেলিভারি (২৪ ঘণ্টা)'
                                  : 'রেগুলার ডেলিভারি (২-৩ দিন)'}
                              </p>
                            </div>
                          </div>
                          <span className="font-semibold text-stone-800">
                            {shipping === 0 ? 'FREE' : formatPrice(shipping)}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {paymentMethod === 'cod' ? (
                              <Banknote className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Wallet className="h-4 w-4 text-emerald-600" />
                            )}
                            <div>
                              <p className="font-semibold text-stone-900">পেমেন্ট মেথড</p>
                              <p className="text-stone-500">
                                {paymentMethod === 'cod' ? 'ক্যাশ অন ডেলিভারি (COD)' : 'অনলাইন পেমেন্ট'}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {paymentMethod === 'cod' ? 'COD' : 'SSLCommerz'}
                          </Badge>
                        </div>
                      </div>

                      {/* Ordered Items Preview */}
                      <div className="pt-2">
                        <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                          অর্ডারের পণ্যসমূহ ({totalItems()} টি)
                        </h4>
                        {renderSummaryItems(true)}
                      </div>

                      {/* Terms Acceptance */}
                      <div className="flex items-start gap-2 pt-3 border-t border-stone-200">
                        <Checkbox
                          id="terms"
                          checked={termsAccepted}
                          onCheckedChange={(c) => setTermsAccepted(Boolean(c))}
                          className="mt-0.5 rounded border-stone-300 data-[state=checked]:bg-emerald-600"
                        />
                        <Label htmlFor="terms" className="text-xs text-stone-600 cursor-pointer leading-relaxed">
                          আমি খাঁটি খাদ্যের{' '}
                          <Link href="/terms" className="text-emerald-700 underline font-medium">
                            শর্তাবলী
                          </Link>{' '}
                          ও{' '}
                          <Link href="/delivery-policy" className="text-emerald-700 underline font-medium">
                            ডেলিভারি পলিসি
                          </Link>{' '}
                          মেনে নিয়ে অর্ডার সম্পন্ন করছি।
                        </Label>
                      </div>

                      {/* Place Order Button */}
                      <div className="space-y-3 pt-2">
                        <Button
                          onClick={handlePlaceOrder}
                          disabled={placing || !termsAccepted}
                          className="w-full h-14 rounded-2xl text-base font-bold shadow-md hover:shadow-lg transition-all bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                          size="lg"
                        >
                          {placing ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>অর্ডার প্রসেস হচ্ছে...</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <ShieldCheck className="h-5 w-5 text-emerald-200" />
                              <span>
                                {paymentMethod === 'online'
                                  ? 'পেমেন্ট করুন ও অর্ডার সম্পন্ন করুন'
                                  : 'অর্ডার নিশ্চিত করুন (Place Order)'}{' '}
                                • {formatPrice(total)}
                              </span>
                            </div>
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => goToStep(4)}
                          className="w-full h-10 rounded-xl text-xs text-stone-500 hover:text-stone-800"
                        >
                          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                          পেমেন্ট পদ্ধতিতে ফিরে যান
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Sticky Order Summary Sidebar */}
          <div className="lg:col-span-1 hidden lg:block">
            <div className="sticky top-20">{SummaryCard}</div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Summary Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-stone-200 p-3 shadow-lg flex items-center justify-between">
        <div>
          <p className="text-[10px] text-stone-500">মোট প্রদেয়</p>
          <p className="text-lg font-bold text-emerald-700">{formatPrice(total)}</p>
        </div>
        <div className="flex gap-2">
          <Sheet open={mobileSummaryOpen} onOpenChange={setMobileSummaryOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl text-xs h-10 px-3">
                পণ্য ({totalItems()})
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
              <SheetHeader className="pb-3">
                <SheetTitle className="text-base font-bold">অর্ডার সামারি</SheetTitle>
              </SheetHeader>
              <div className="space-y-4">
                {renderFreeShippingProgress()}
                {renderSummaryItems(true)}
                <Separator />
                {renderCouponSection()}
                <Separator />
                {renderTotals()}
              </div>
            </SheetContent>
          </Sheet>

          <Button
            onClick={currentStep < 5 ? () => goToStep(currentStep + 1) : handlePlaceOrder}
            disabled={placing}
            className="rounded-xl text-xs font-bold h-10 px-5 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {placing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : currentStep < 5 ? (
              'এগিয়ে যান →'
            ) : (
              'অর্ডার নিশ্চিত করুন'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
