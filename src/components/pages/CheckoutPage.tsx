'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CreditCard, Truck, MapPin, ChevronRight, Loader2, ShieldCheck,
  Gift, Clock, CheckCircle2, Wallet, Banknote, Lock,
  ArrowLeft, RefreshCw, Zap, Tag, ShoppingBag, ChevronDown,
  Phone, User, Mail, Home as HomeIcon, AlertCircle, Minus, Plus,
  X, Info, Sparkles, Package,
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { useAppStore } from '@/lib/store'
import { extractItems } from '@/lib/api'
import { formatPrice, safeNum } from '@/lib/utils'
import CheckoutStepIndicator from '@/components/shared/CheckoutStepIndicator'
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

// ─── Bangladesh Districts (grouped by division) ─────────────────────────────

const divisionDistricts: Record<string, string[]> = {
  'Dhaka Division': ['Dhaka', 'Faridpur', 'Gazipur', 'Gopalganj', 'Kishoreganj', 'Madaripur', 'Manikganj', 'Munshiganj', 'Narayanganj', 'Narsingdi', 'Rajbari', 'Shariatpur', 'Tangail'],
  'Rajshahi Division': ['Bogra', 'Joypurhat', 'Naogaon', 'Natore', 'Nawabganj', 'Pabna', 'Rajshahi', 'Sirajganj'],
  'Chittagong Division': ['Chittagong', 'Comilla', "Cox's Bazar", 'Feni', 'Khagrachhari', 'Lakshmipur', 'Noakhali', 'Rangamati', 'Brahmanbaria', 'Chandpur'],
  'Khulna Division': ['Khulna', 'Bagerhat', 'Chuadanga', 'Jessore', 'Jhenaidah', 'Kushtia', 'Magura', 'Meherpur', 'Narail', 'Satkhira'],
  'Barisal Division': ['Barisal', 'Barguna', 'Bhola', 'Jhalokati', 'Patuakhali', 'Pirojpur'],
  'Sylhet Division': ['Sylhet', 'Habiganj', 'Moulvibazar', 'Sunamganj'],
  'Rangpur Division': ['Rangpur', 'Dinajpur', 'Gaibandha', 'Kurigram', 'Lalmonirhat', 'Nilphamari', 'Panchagarh', 'Thakurgaon'],
  'Mymensingh Division': ['Mymensingh', 'Jamalpur', 'Netrokona', 'Sherpur'],
}

const bangladeshDistricts = Object.values(divisionDistricts).flat()

// ─── Component ────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const { cartItems, subtotal, totalItems, navigate, isAuthenticated, user, siteConfig, clearCart, updateQuantity, removeFromCart } = useAppStore()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [shippingMethod, setShippingMethod] = useState('standard')
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [note, setNote] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [discount, setDiscount] = useState(0)
  const [placing, setPlacing] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [maxReachedStep, setMaxReachedStep] = useState(1)
  const [couponApplied, setCouponApplied] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [showCouponInput, setShowCouponInput] = useState(true)

  // Guest form
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestAddress, setGuestAddress] = useState('')
  const [guestCity, setGuestCity] = useState('')
  const [guestDistrict, setGuestDistrict] = useState('')

  // Add address form
  const [showAddAddress, setShowAddAddress] = useState(false)
  const [newAddr, setNewAddr] = useState({ name: '', phone: '', address: '', city: '', district: '', postalCode: '' })

  // Mobile summary sheet
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false)

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

  const sub = subtotal()
  const standardShipping = siteConfig?.shippingCharge || 60
  const expressShipping = 120
  const freeThreshold = siteConfig?.freeShippingThreshold || 1500

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

  const total = sub + shipping - discount
  const freeShippingProgress = Math.min((sub / freeThreshold) * 100, 100)
  const freeShippingRemaining = Math.max(freeThreshold - sub, 0)

  // ─── Validation ───────────────────────────────────────────────────────────

  const validatePhone = (p: string) => /^(?:01\d{9}|\+8801\d{9})$/.test(p)

  const validateShippingStep = (): boolean => {
    const errors: Record<string, string> = {}
    if (isAuthenticated) {
      if (!selectedAddressId) errors.address = 'Please select a delivery address'
    } else {
      if (!guestName.trim()) errors.guestName = 'Full name is required'
      if (!guestPhone.trim()) {
        errors.guestPhone = 'Phone number is required'
      } else if (!validatePhone(guestPhone)) {
        errors.guestPhone = 'Enter a valid BD number (01XXXXXXXXX)'
      }
      if (!guestAddress.trim()) errors.guestAddress = 'Address is required'
      if (!guestCity.trim()) errors.guestCity = 'City is required'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ─── Step Navigation ─────────────────────────────────────────────────────

  const goToStep = (step: number) => {
    if (step <= currentStep) {
      setCurrentStep(step)
      return
    }
    if (step === 3 && currentStep === 2) {
      if (!validateShippingStep()) {
        toast.error('Please fill in all required fields')
        return
      }
    }
    if (step === 2 && currentStep === 1) {
      // Moving from cart review to shipping — no validation needed
    }
    if (step > currentStep + 1) return
    setCurrentStep(step)
    setMaxReachedStep((prev) => Math.max(prev, step))
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
        toast.error(data.error || 'Invalid coupon')
        return
      }
      const discountAmount = data.type === 'percentage'
        ? Math.min(sub * (data.value / 100), data.maxDiscount || Infinity)
        : data.value
      setDiscount(discountAmount)
      setCouponApplied(true)
      toast.success('Coupon applied!')
    } catch {
      toast.error('Failed to validate coupon')
    }
  }

  // ─── Add Address ──────────────────────────────────────────────────────────

  const handleAddAddress = async () => {
    if (!user?.id) return
    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, ...newAddr, isDefault: addresses.length === 0 }),
      })
      if (!res.ok) throw new Error('Failed to add address')
      const saved = await res.json()
      setAddresses((prev) => [...prev, saved])
      setSelectedAddressId(saved.id)
      setShowAddAddress(false)
      setNewAddr({ name: '', phone: '', address: '', city: '', district: '', postalCode: '' })
      toast.success('Address added')
    } catch {
      toast.error('Failed to add address')
    }
  }

  // ─── Place Order ──────────────────────────────────────────────────────────

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      toast.error('Your cart is empty')
      return
    }

    if (!validateShippingStep()) {
      toast.error('Please fill in all required fields')
      setCurrentStep(2)
      return
    }

    if (!termsAccepted) {
      toast.error('Please accept the terms & conditions')
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
      } else {
        orderData.guestName = guestName
        orderData.guestPhone = guestPhone
        orderData.guestEmail = guestEmail || undefined
        orderData.guestAddress = `${guestAddress}, ${guestCity}${guestDistrict ? `, ${guestDistrict}` : ''}`
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(useAppStore.getState().accessToken ? { 'Authorization': `Bearer ${useAppStore.getState().accessToken}` } : {})
        },
        body: JSON.stringify(orderData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to place order')
      }

      const order = await res.json()
      const orderId = order.data?.id || order.id
      const orderNum = order.data?.orderNumber || order.orderNumber

      if (paymentMethod === 'online') {
        const initRes = await fetch('/api/payments/sslcommerz/initiate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(useAppStore.getState().accessToken ? { 'Authorization': `Bearer ${useAppStore.getState().accessToken}` } : {})
          },
          body: JSON.stringify({ orderId }),
        })
        const initData = await initRes.json()

        if (initData.success && initData.data?.gatewayPageURL) {
          window.location.href = initData.data.gatewayPageURL
          return
        } else {
          throw new Error(initData.error || 'Failed to initialize payment gateway')
        }
      } else {
        await clearCart()
        toast.success('Order placed successfully!')
        navigate('order-confirmation', { orderId, orderNumber: orderNum })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to place order')
      setPlacing(false)
    }
  }

  // ─── Empty Cart ───────────────────────────────────────────────────────────

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center py-16 px-4">
          <div className="text-center">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="h-12 w-12 text-primary/40" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">Add products to your cart before checkout</p>
            <Button onClick={() => navigate('products')} className="rounded-xl px-8 h-12">
              Browse Products
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Section Header (reusable, lightweight) ────────────────────────────────
  const SectionHeader = ({
    icon: Icon, title, subtitle, badge,
  }: { icon: typeof MapPin; title: string; subtitle?: string; badge?: string }) => (
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <span>{title}</span>
        {badge && <Badge variant="secondary" className="ml-auto text-xs">{badge}</Badge>}
      </CardTitle>
      {subtitle && <p className="text-xs text-muted-foreground mt-1 ml-10">{subtitle}</p>}
    </CardHeader>
  )

  // ─── Order Summary Content (shared between desktop sidebar & mobile sheet) ─
  const renderSummaryItems = (compact = false) => (
    <div className={`space-y-3 ${compact ? 'max-h-[40vh] overflow-y-auto pr-1' : 'max-h-72 overflow-y-auto pr-1'}`}>
      {cartItems.map((item) => {
        const itemPrice = item.discountPrice != null ? item.discountPrice : item.price
        return (
          <div key={item.id} className="flex items-center gap-3">
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
              <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                {item.quantity}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.productName}</p>
              <p className="text-xs text-muted-foreground">
                {formatPrice(itemPrice)} {item.unit && `· ${item.unit}`}
              </p>
            </div>
            <span className="text-sm font-semibold whitespace-nowrap">
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
        <span className="text-muted-foreground">Subtotal ({totalItems()} items)</span>
        <span className="font-medium">{formatPrice(sub)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Delivery Charge</span>
        <span className={`font-medium ${shipping === 0 ? 'text-emerald-600' : ''}`}>
          {shipping === 0 ? 'FREE' : formatPrice(shipping)}
        </span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Coupon Discount</span>
          <span className="text-emerald-600 font-medium">-{formatPrice(discount)}</span>
        </div>
      )}
      <Separator />
      <div className="flex justify-between items-center pt-1">
        <span className="font-semibold">Grand Total</span>
        <motion.span
          key={total}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          className="text-2xl font-bold text-primary"
        >
          {formatPrice(total)}
        </motion.span>
      </div>
      {discount > 0 && (
        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-emerald-700 font-semibold">
            Total savings: {formatPrice(discount)}!
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
          <Tag className="h-3.5 w-3.5 text-primary" />
          Coupon Code
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
                  <span className="text-xs text-emerald-700 font-semibold">-৳{discount.toLocaleString()}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setCouponCode(''); setDiscount(0); setCouponApplied(false) }}
                  className="text-red-500 h-7 text-xs hover:text-red-600 hover:bg-red-50"
                >
                  <X className="h-3 w-3 mr-0.5" /> Remove
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value)
                    if (couponApplied) { setDiscount(0); setCouponApplied(false) }
                  }}
                  className="h-10 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                />
                <Button
                  variant="outline"
                  onClick={handleApplyCoupon}
                  className="h-10 border-primary/30 text-primary hover:bg-primary/5 font-semibold px-5"
                >
                  Apply
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
        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-sm">
          <Truck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span className="font-medium text-emerald-700">You qualify for FREE delivery!</span>
        </div>
      )
    }
    return (
      <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-amber-800 font-medium flex items-center gap-1">
            <Truck className="h-3.5 w-3.5" />
            Add {formatPrice(freeShippingRemaining)} more for FREE delivery
          </span>
        </div>
        <Progress
          value={freeShippingProgress}
          className="h-1.5 bg-amber-200 [&>div]:bg-amber-500"
        />
      </div>
    )
  }

  // Sidebar summary card content
  const SummaryCard = (
    <Card className="shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Order Summary
          </span>
          <Badge variant="secondary" className="text-xs">{totalItems()} items</Badge>
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

  // Primary next-step CTA label
  const getPrimaryCtaLabel = () => {
    if (currentStep === 1) return 'Continue to Shipping'
    if (currentStep === 2) return 'Continue to Payment'
    if (currentStep === 3) return 'Review Order'
    return paymentMethod === 'online' ? 'Pay & Place Order' : 'Place Order'
  }

  const handlePrimaryCta = () => {
    if (currentStep < 4) goToStep(currentStep + 1)
    else handlePlaceOrder()
  }

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      {/* Compact Header */}
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('home')}>
            {siteConfig?.logo ? (
              <img src={siteConfig.logo} alt="Khati Khadyo" className="h-7 w-auto object-contain" />
            ) : (
              <img src="/all_logo.png" alt="Khati Khadyo" className="h-7 w-auto object-contain" />
            )}
            <span className="font-bold text-base hidden sm:block">Khati Khadyo</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg"
            onClick={() => navigate('cart')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Cart
          </Button>
        </div>
      </div>

      {/* Step Indicator */}
      <CheckoutStepIndicator
        currentStep={currentStep}
        onStepClick={goToStep}
        maxReachedStep={maxReachedStep}
      />

      {/* Main Content */}
      <div className="flex-1">
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: Forms */}
            <div className="lg:col-span-2 space-y-4 lg:space-y-6">

              {/* ─── Step 1: Cart Review ─────────────────────────────────────── */}
              <AnimatePresence mode="wait">
                {currentStep === 1 && (
                  <motion.div
                    key="cart-review"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="space-y-4"
                  >
                    <Card className="shadow-sm">
                      <SectionHeader
                        icon={ShoppingBag}
                        title="Review Your Cart"
                        subtitle={`${totalItems()} item(s) in your cart`}
                        badge="Step 1"
                      />
                      <CardContent className="space-y-3 pt-0">
                        {cartItems.map((item) => {
                          const itemPrice = item.discountPrice != null ? item.discountPrice : item.price
                          return (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                            >
                              <div className="relative h-14 w-14 rounded-lg bg-muted/40 flex-shrink-0 overflow-hidden border">
                                <Image
                                  src={item.image}
                                  alt={item.productName}
                                  fill
                                  className="object-cover"
                                  sizes="56px"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                  }}
                                />
                                <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                                  {item.quantity}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.productName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {formatPrice(itemPrice)} {item.unit && `· per ${item.unit}`}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <button
                                    onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                    className="h-6 w-6 rounded-md border flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-colors"
                                    aria-label="Decrease quantity"
                                  >
                                    <Minus className="h-2.5 w-2.5" />
                                  </button>
                                  <span className="text-xs font-semibold w-6 text-center">{item.quantity}</span>
                                  <button
                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                    className="h-6 w-6 rounded-md border flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-colors"
                                    aria-label="Increase quantity"
                                  >
                                    <Plus className="h-2.5 w-2.5" />
                                  </button>
                                  <button
                                    onClick={() => removeFromCart(item.id)}
                                    className="h-6 w-6 rounded-md flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 ml-1 transition-colors"
                                    aria-label="Remove item"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold whitespace-nowrap">
                                  {formatPrice(itemPrice * item.quantity)}
                                </p>
                              </div>
                            </div>
                          )
                        })}

                        <div className="flex justify-between items-center pt-3 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('cart')}
                          >
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Edit Cart
                          </Button>
                          <Button
                            onClick={() => goToStep(2)}
                            className="rounded-xl px-6 h-11"
                          >
                            Continue to Shipping
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ─── Step 2: Shipping & Delivery ─────────────────────────────── */}
              <AnimatePresence mode="wait">
                {currentStep === 2 && (
                  <motion.div
                    key="shipping"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="space-y-4"
                  >
                    {/* Delivery Information Card */}
                    <Card className="shadow-sm">
                      <SectionHeader
                        icon={MapPin}
                        title="Delivery Information"
                        subtitle="Where should we deliver your order?"
                        badge="Step 2"
                      />
                      <CardContent className="pt-0">
                        {isAuthenticated ? (
                          <div className="space-y-4">
                            {/* Saved Addresses */}
                            {addresses.length > 0 && (
                              <div>
                                <Label className="text-xs font-semibold text-muted-foreground mb-2 block">
                                  Saved Addresses
                                </Label>
                                <RadioGroup value={selectedAddressId} onValueChange={(v) => { setSelectedAddressId(v); setFormErrors((p) => ({ ...p, address: '' })) }}>
                                  <div className="space-y-2">
                                    {addresses.map((addr) => (
                                      <div
                                        key={addr.id}
                                        className={`relative flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                          selectedAddressId === addr.id
                                            ? 'border-primary bg-primary/5'
                                            : 'border-border hover:border-primary/30'
                                        }`}
                                        onClick={() => { setSelectedAddressId(addr.id); setFormErrors((p) => ({ ...p, address: '' })) }}
                                      >
                                        <RadioGroupItem value={addr.id} id={addr.id} className="mt-1" />
                                        <Label htmlFor={addr.id} className="flex-1 cursor-pointer">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-sm">{addr.name}</span>
                                            {addr.isDefault && (
                                              <Badge variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary">Default</Badge>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                            <Phone className="h-3 w-3 flex-shrink-0" />
                                            {addr.phone}
                                          </div>
                                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-1">
                                            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                            {addr.address}, {addr.city}{addr.district ? `, ${addr.district}` : ''} {addr.postalCode || ''}
                                          </div>
                                        </Label>
                                        {selectedAddressId === addr.id && (
                                          <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-1" />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </RadioGroup>
                                {formErrors.address && (
                                  <p className="text-xs text-red-500 flex items-center gap-1 mt-2">
                                    <AlertCircle className="h-3 w-3" /> {formErrors.address}
                                  </p>
                                )}
                              </div>
                            )}

                            {addresses.length === 0 && !showAddAddress && (
                              <div className="text-center py-8 bg-muted/30 rounded-xl border-2 border-dashed border-primary/30">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                                  <MapPin className="h-6 w-6 text-primary" />
                                </div>
                                <p className="text-sm mb-3 font-medium">No saved addresses yet</p>
                                <Button variant="outline" onClick={() => setShowAddAddress(true)} className="rounded-lg px-5">
                                  + Add New Address
                                </Button>
                              </div>
                            )}

                            {/* Add Address Form */}
                            <AnimatePresence>
                              {showAddAddress && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="border-2 border-primary/30 rounded-xl p-4 bg-primary/5 space-y-4 overflow-hidden"
                                >
                                  <h4 className="font-bold text-sm flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                                      <MapPin className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    Add New Address
                                  </h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <Label className="text-xs font-medium">Full Name *</Label>
                                      <div className="relative mt-1">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                          value={newAddr.name}
                                          onChange={(e) => setNewAddr({ ...newAddr, name: e.target.value })}
                                          className="pl-9 h-10"
                                          placeholder="Enter full name"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <Label className="text-xs font-medium">Phone Number *</Label>
                                      <div className="relative mt-1">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                          value={newAddr.phone}
                                          onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
                                          className="pl-9 h-10"
                                          placeholder="01XXXXXXXXX"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <Label className="text-xs font-medium">Address *</Label>
                                    <Textarea
                                      value={newAddr.address}
                                      onChange={(e) => setNewAddr({ ...newAddr, address: e.target.value })}
                                      placeholder="House, Road, Area"
                                      className="mt-1 resize-none"
                                      rows={2}
                                    />
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                      <Label className="text-xs font-medium">City *</Label>
                                      <Input
                                        value={newAddr.city}
                                        onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                                        className="mt-1 h-10"
                                        placeholder="e.g. Dhaka"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs font-medium">District</Label>
                                      <Select value={newAddr.district} onValueChange={(v) => setNewAddr({ ...newAddr, district: v })}>
                                        <SelectTrigger className="mt-1 w-full h-10">
                                          <SelectValue placeholder="Select district" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {Object.entries(divisionDistricts).map(([division, dists]) => (
                                            <div key={division}>
                                              <div className="px-2 py-1.5 text-xs font-bold text-primary bg-primary/5">{division}</div>
                                              {dists.map((d) => (
                                                <SelectItem key={d} value={d}>{d}</SelectItem>
                                              ))}
                                            </div>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label className="text-xs font-medium">Postal Code</Label>
                                      <Input
                                        value={newAddr.postalCode}
                                        onChange={(e) => setNewAddr({ ...newAddr, postalCode: e.target.value })}
                                        className="mt-1 h-10"
                                        placeholder="e.g. 1200"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <Button onClick={handleAddAddress} className="rounded-lg px-5 h-10">Save Address</Button>
                                    <Button variant="outline" onClick={() => setShowAddAddress(false)} className="rounded-lg px-5 h-10">Cancel</Button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {!showAddAddress && addresses.length > 0 && (
                              <Button variant="outline" onClick={() => setShowAddAddress(true)} className="border-dashed border-primary/40 text-primary hover:bg-primary/5 w-full rounded-lg h-11">
                                <Plus className="h-4 w-4 mr-2" />
                                Add New Address
                              </Button>
                            )}
                          </div>
                        ) : (
                          /* Guest Checkout Form */
                          <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
                              <div className="h-7 w-7 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <Info className="h-3.5 w-3.5 text-amber-600" />
                              </div>
                              <p className="text-xs text-amber-800 leading-relaxed">
                                Have an account?{' '}
                                <button className="font-bold underline hover:text-amber-900" onClick={() => navigate('login')}>
                                  Login
                                </button>{' '}
                                for a faster checkout with saved addresses.
                              </p>
                            </div>

                            {/* Contact Info */}
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-primary" />
                                Contact Information
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs font-medium">Full Name *</Label>
                                  <div className="relative mt-1">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      value={guestName}
                                      onChange={(e) => { setGuestName(e.target.value); setFormErrors((p) => ({ ...p, guestName: '' })) }}
                                      className={`pl-9 h-10 ${formErrors.guestName ? 'border-red-400 focus-visible:ring-red-200' : ''}`}
                                      placeholder="Your full name"
                                    />
                                  </div>
                                  {formErrors.guestName && (
                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" /> {formErrors.guestName}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <Label className="text-xs font-medium">Phone Number *</Label>
                                  <div className="relative mt-1">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      value={guestPhone}
                                      onChange={(e) => { setGuestPhone(e.target.value); setFormErrors((p) => ({ ...p, guestPhone: '' })) }}
                                      className={`pl-9 h-10 ${formErrors.guestPhone ? 'border-red-400 focus-visible:ring-red-200' : ''}`}
                                      placeholder="01XXXXXXXXX"
                                    />
                                  </div>
                                  {formErrors.guestPhone && (
                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" /> {formErrors.guestPhone}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="mt-3">
                                <Label className="text-xs font-medium">Email (optional)</Label>
                                <div className="relative mt-1">
                                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    type="email"
                                    value={guestEmail}
                                    onChange={(e) => setGuestEmail(e.target.value)}
                                    className="pl-9 h-10"
                                    placeholder="your@email.com"
                                  />
                                </div>
                              </div>
                            </div>

                            <Separator />

                            {/* Shipping Address */}
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                                <HomeIcon className="h-3.5 w-3.5 text-primary" />
                                Shipping Address
                              </h4>
                              <div>
                                <Label className="text-xs font-medium">Delivery Address *</Label>
                                <div className="relative mt-1">
                                  <HomeIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                  <Textarea
                                    value={guestAddress}
                                    onChange={(e) => { setGuestAddress(e.target.value); setFormErrors((p) => ({ ...p, guestAddress: '' })) }}
                                    className={`pl-9 ${formErrors.guestAddress ? 'border-red-400 focus-visible:ring-red-200' : ''}`}
                                    placeholder="House no, Road, Area"
                                    rows={2}
                                  />
                                </div>
                                {formErrors.guestAddress && (
                                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> {formErrors.guestAddress}
                                  </p>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                <div>
                                  <Label className="text-xs font-medium">City *</Label>
                                  <Input
                                    value={guestCity}
                                    onChange={(e) => { setGuestCity(e.target.value); setFormErrors((p) => ({ ...p, guestCity: '' })) }}
                                    className={`mt-1 h-10 ${formErrors.guestCity ? 'border-red-400 focus-visible:ring-red-200' : ''}`}
                                    placeholder="e.g. Dhaka"
                                  />
                                  {formErrors.guestCity && (
                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" /> {formErrors.guestCity}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <Label className="text-xs font-medium">District</Label>
                                  <Select value={guestDistrict} onValueChange={setGuestDistrict}>
                                    <SelectTrigger className="mt-1 w-full h-10">
                                      <SelectValue placeholder="Select district" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(divisionDistricts).map(([division, dists]) => (
                                        <div key={division}>
                                          <div className="px-2 py-1.5 text-xs font-bold text-primary bg-primary/5">{division}</div>
                                          {dists.map((d) => (
                                            <SelectItem key={d} value={d}>{d}</SelectItem>
                                          ))}
                                        </div>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Delivery Method Card */}
                    <Card className="shadow-sm">
                      <SectionHeader
                        icon={Truck}
                        title="Delivery Method"
                        subtitle="Choose your preferred delivery speed"
                      />
                      <CardContent className="pt-0">
                        <RadioGroup value={shippingMethod} onValueChange={setShippingMethod}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label
                              htmlFor="ship-standard"
                              className={`relative flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                shippingMethod === 'standard' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                              }`}
                            >
                              <RadioGroupItem value="standard" id="ship-standard" className="sr-only" />
                              <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                shippingMethod === 'standard' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                              }`}>
                                <Truck className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm">Regular Delivery</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Clock className="h-3 w-3" /> 3-5 business days
                                </div>
                              </div>
                              <div className="text-right">
                                <span className={`font-bold text-sm ${sub >= freeThreshold ? 'text-emerald-600' : ''}`}>
                                  {sub >= freeThreshold ? 'FREE' : `৳${standardShipping}`}
                                </span>
                              </div>
                              {shippingMethod === 'standard' && (
                                <CheckCircle2 className="h-4 w-4 text-primary absolute top-2 right-2" />
                              )}
                            </label>

                            <label
                              htmlFor="ship-express"
                              className={`relative flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                shippingMethod === 'express' ? 'border-amber-500 bg-amber-50/40' : 'border-border hover:border-amber-300'
                              }`}
                            >
                              <RadioGroupItem value="express" id="ship-express" className="sr-only" />
                              <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                shippingMethod === 'express' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
                              }`}>
                                <Zap className="h-5 w-5" fill="currentColor" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm flex items-center gap-1.5">
                                  Express Delivery
                                  <Badge className="bg-amber-100 text-amber-700 border-0 text-[9px] h-4 px-1 font-bold">FAST</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Clock className="h-3 w-3" /> Next day delivery
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-sm">
                                  ৳{sub >= freeThreshold ? expressShipping - standardShipping : expressShipping}
                                </span>
                              </div>
                              {shippingMethod === 'express' && (
                                <CheckCircle2 className="h-4 w-4 text-amber-500 absolute top-2 right-2" />
                              )}
                            </label>
                          </div>
                        </RadioGroup>

                        <div className="mt-4 flex justify-between">
                          <Button variant="ghost" size="sm" onClick={() => goToStep(1)}>
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Back to Cart
                          </Button>
                          <Button onClick={() => goToStep(3)} className="rounded-xl px-6 h-11">
                            Continue to Payment
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ─── Step 3: Payment Method ──────────────────────────────────── */}
              <AnimatePresence mode="wait">
                {currentStep === 3 && (
                  <motion.div
                    key="payment"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
                    className="space-y-4"
                  >
                    <Card className="shadow-sm">
                      <SectionHeader
                        icon={Wallet}
                        title="Payment Method"
                        subtitle="Choose how you want to pay"
                        badge="Step 3"
                      />
                      <CardContent className="pt-0">
                        <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                          {/* COD Option */}
                          <label
                            htmlFor="pay-cod"
                            className={`relative flex items-center gap-4 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              paymentMethod === 'cod' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                            }`}
                          >
                            <RadioGroupItem value="cod" id="pay-cod" className="sr-only" />
                            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
                              <Banknote className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm">Cash on Delivery</div>
                              <div className="text-xs text-muted-foreground mt-0.5">Pay when you receive your order</div>
                              <Badge variant="secondary" className="mt-1.5 bg-primary/10 text-primary text-[10px] font-semibold h-5">No extra charge</Badge>
                            </div>
                            {paymentMethod === 'cod' && (
                              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                            )}
                          </label>

                          {/* SSLCommerz Option */}
                          <label
                            htmlFor="pay-online"
                            className={`relative flex flex-col p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              paymentMethod === 'online' ? 'border-amber-500 bg-amber-50/40' : 'border-border hover:border-amber-300'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <RadioGroupItem value="online" id="pay-online" className="sr-only" />
                              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0">
                                <CreditCard className="h-6 w-6 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm">SSLCommerz Payment Gateway</div>
                                <div className="text-xs text-muted-foreground mt-0.5">bKash, Nagad, Rocket, Visa, Mastercard & more</div>
                              </div>
                              {paymentMethod === 'online' && (
                                <CheckCircle2 className="h-5 w-5 text-amber-500 flex-shrink-0" />
                              )}
                            </div>

                            {/* Supported Payment Methods */}
                            {paymentMethod === 'online' && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                transition={{ duration: 0.3 }}
                                className="mt-3 pt-3 border-t border-border overflow-hidden"
                              >
                                <div className="flex flex-wrap gap-1.5">
                                  {['bKash', 'Nagad', 'Rocket', 'Visa', 'Mastercard', 'DBBL', 'City Bank'].map((method) => (
                                    <Badge key={method} variant="outline" className="text-[10px] h-6 bg-card text-muted-foreground font-medium px-2">
                                      {method}
                                    </Badge>
                                  ))}
                                  <Badge variant="outline" className="text-[10px] h-6 bg-card text-muted-foreground font-medium px-2">
                                    +more
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-2.5 flex items-center gap-1.5">
                                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                                  You will be redirected to SSLCommerz secure payment page
                                </p>
                              </motion.div>
                            )}
                          </label>
                        </RadioGroup>

                        {/* Order Note */}
                        <div className="mt-4">
                          <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                            <Package className="h-3.5 w-3.5 text-primary" />
                            Order Note (optional)
                          </Label>
                          <Textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Any special instructions for your delivery..."
                            className="resize-none"
                            rows={2}
                          />
                        </div>

                        {/* Terms & Conditions */}
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/40">
                            <Checkbox
                              id="terms"
                              checked={termsAccepted}
                              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                              className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <Label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                              I agree to the{' '}
                              <button type="button" className="text-primary font-semibold underline hover:text-primary/80" onClick={() => navigate('terms')}>
                                Terms & Conditions
                              </button>{' '}
                              and{' '}
                              <button type="button" className="text-primary font-semibold underline hover:text-primary/80" onClick={() => navigate('privacy')}>
                                Privacy Policy
                              </button>
                            </Label>
                          </div>
                        </div>

                        {/* Step 3 navigation */}
                        <div className="flex justify-between mt-4">
                          <Button variant="ghost" size="sm" onClick={() => goToStep(2)}>
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Back to Shipping
                          </Button>
                          <Button onClick={() => goToStep(4)} className="rounded-xl px-6 h-11">
                            Review Order
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ─── Step 4: Order Confirmation ─────────────────────────────── */}
              <AnimatePresence mode="wait">
                {currentStep === 4 && (
                  <motion.div
                    key="confirmation"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="space-y-4"
                  >
                    <Card className="shadow-sm">
                      <SectionHeader
                        icon={CheckCircle2}
                        title="Confirm & Place Order"
                        subtitle="Review your order details and place it"
                        badge="Step 4"
                      />
                      <CardContent className="pt-0 space-y-4">
                        {/* Shipping summary */}
                        <div className="rounded-lg border p-3 bg-muted/30">
                          <div className="flex items-center justify-between mb-1.5">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-primary" />
                              Delivery To
                            </h3>
                            <button
                              onClick={() => goToStep(2)}
                              className="text-xs text-primary font-semibold hover:underline"
                            >
                              Edit
                            </button>
                          </div>
                          {isAuthenticated ? (
                            <p className="text-sm text-muted-foreground">
                              {addresses.find((a) => a.id === selectedAddressId)?.name || '—'} ·{' '}
                              {addresses.find((a) => a.id === selectedAddressId)?.phone || '—'}
                              <br />
                              {addresses.find((a) => a.id === selectedAddressId)?.address || '—'},{' '}
                              {addresses.find((a) => a.id === selectedAddressId)?.city || '—'}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              {guestName || '—'} · {guestPhone || '—'}
                              <br />
                              {guestAddress || '—'}, {guestCity || '—'}{guestDistrict ? `, ${guestDistrict}` : ''}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-border">
                            Method: {shippingMethod === 'express' ? '⚡ Express Delivery' : '🚚 Standard Delivery'}
                          </p>
                        </div>

                        {/* Payment summary */}
                        <div className="rounded-lg border p-3 bg-muted/30">
                          <div className="flex items-center justify-between mb-1.5">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                              <Wallet className="h-4 w-4 text-primary" />
                              Payment Method
                            </h3>
                            <button
                              onClick={() => goToStep(3)}
                              className="text-xs text-primary font-semibold hover:underline"
                            >
                              Edit
                            </button>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {paymentMethod === 'cod'
                              ? '💵 Cash on Delivery (COD)'
                              : '💳 Online Payment (SSLCommerz)'}
                          </p>
                        </div>

                        {/* Order note summary */}
                        {note && (
                          <div className="rounded-lg border p-3 bg-muted/30">
                            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                              <Package className="h-4 w-4 text-primary" />
                              Order Note
                            </h3>
                            <p className="text-sm text-muted-foreground">{note}</p>
                          </div>
                        )}

                        {/* Terms acceptance */}
                        <div className="rounded-lg border p-3">
                          <div className="flex items-start gap-2.5">
                            <Checkbox
                              id="terms-final"
                              checked={termsAccepted}
                              onCheckedChange={(v) => setTermsAccepted(v === true)}
                              className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <Label htmlFor="terms-final" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                              I agree to the{' '}
                              <button type="button" className="text-primary font-semibold underline hover:text-primary/80" onClick={() => navigate('terms')}>
                                Terms & Conditions
                              </button>{' '}
                              and{' '}
                              <button type="button" className="text-primary font-semibold underline hover:text-primary/80" onClick={() => navigate('privacy')}>
                                Privacy Policy
                              </button>
                            </Label>
                          </div>
                        </div>

                        {/* Step 4 navigation */}
                        <div className="flex justify-between items-center">
                          <Button variant="ghost" size="sm" onClick={() => goToStep(3)}>
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Back to Payment
                          </Button>
                          <motion.div whileTap={{ scale: 0.98 }}>
                            <Button
                              className="rounded-xl text-base font-bold shadow-md shadow-primary/20 h-12 px-6"
                              size="lg"
                              onClick={() => handlePlaceOrder()}
                              disabled={placing || !termsAccepted}
                            >
                              {placing ? (
                                <>
                                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                  {paymentMethod === 'online' ? 'Redirecting...' : 'Placing Order...'}
                                </>
                              ) : (
                                <>
                                  <Lock className="h-4 w-4 mr-2" />
                                  {paymentMethod === 'online' ? 'Pay & Place Order' : 'Place Order'}
                                  <ChevronRight className="h-4 w-4 ml-1" />
                                </>
                              )}
                            </Button>
                          </motion.div>
                        </div>
                        {!termsAccepted && (
                          <p className="text-xs text-amber-600 text-center">
                            Please accept the Terms & Conditions to place your order.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: Order Summary Sidebar (desktop) */}
            <div className="hidden lg:block">
              <div className="sticky top-4 space-y-4">
                {SummaryCard}
                {/* Trust Badges */}
                <Card className="bg-muted/30 border-dashed">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { icon: Lock, label: 'Secure SSL' },
                        { icon: RefreshCw, label: 'Money Back' },
                        { icon: ShieldCheck, label: '100% Safe' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1.5 text-center">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <item.icon className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-[10px] font-semibold text-muted-foreground leading-tight">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar with summary toggle + primary CTA */}
      <div className="lg:hidden sticky bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Sheet open={mobileSummaryOpen} onOpenChange={setMobileSummaryOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex-1 min-w-0 text-left"
                aria-label="View order summary"
              >
                <p className="text-[11px] text-muted-foreground leading-tight flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {totalItems()} items · Tap to view summary
                </p>
                <p className="text-lg font-bold text-primary leading-tight">
                  {formatPrice(total)}
                  {discount > 0 && (
                    <span className="ml-1.5 text-xs font-medium text-emerald-600">
                      saving {formatPrice(discount)}
                    </span>
                  )}
                </p>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
              <SheetHeader className="pb-2">
                <SheetTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Order Summary
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 p-4 pt-2">
                {renderFreeShippingProgress()}
                {renderSummaryItems(true)}
                <Separator />
                {renderCouponSection()}
                <Separator />
                {renderTotals()}
              </div>
            </SheetContent>
          </Sheet>

          <motion.div whileTap={{ scale: 0.98 }} className="flex-shrink-0">
            <Button
              className="h-11 px-5 rounded-xl font-semibold"
              onClick={handlePrimaryCta}
              disabled={currentStep === 4 && (placing || !termsAccepted)}
            >
              {currentStep === 4 && placing ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : currentStep === 4 ? (
                <Lock className="h-4 w-4 mr-1.5" />
              ) : null}
              {currentStep === 4 && placing
                ? (paymentMethod === 'online' ? 'Redirecting...' : 'Placing...')
                : getPrimaryCtaLabel()}
              {!placing && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
