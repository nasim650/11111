'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CreditCard, Truck, MapPin, ChevronRight, Loader2, ShieldCheck,
  Gift, Clock, CheckCircle2, Wallet, Banknote, Lock,
  ArrowLeft, RefreshCw, Zap, Tag, ShoppingBag, ChevronDown,
  Phone, User, Mail, Home as HomeIcon, AlertCircle, Minus, Plus,
  X, Info, Sparkles, Package, Edit2, Trash2, Check, Star, CheckCircle,
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
  const [termsAccepted, setTermsAccepted] = useState(true)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [showCouponInput, setShowCouponInput] = useState(true)

  // Guest form
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestAddress, setGuestAddress] = useState('')
  const [guestCity, setGuestCity] = useState('')
  const [guestDistrict, setGuestDistrict] = useState('')

  // Add & Edit address forms
  const [showAddAddress, setShowAddAddress] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [savingAddress, setSavingAddress] = useState(false)
  const [newAddrIsDefault, setNewAddrIsDefault] = useState(false)
  const [newAddr, setNewAddr] = useState({ name: '', phone: '', address: '', city: '', district: '', postalCode: '' })
  const [editingAddr, setEditingAddr] = useState({ name: '', phone: '', address: '', city: '', district: '', postalCode: '', isDefault: false })

  // Mobile summary sheet
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false)

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

  const total = Math.max(0, sub + shipping - discount)
  const freeShippingProgress = Math.min((sub / freeThreshold) * 100, 100)
  const freeShippingRemaining = Math.max(freeThreshold - sub, 0)

  const validatePhone = (p: string) => /^(?:01\d{9}|\+8801\d{9})$/.test(p)

  // ─── Step 1 Validation ────────────────────────────────────────────────────
  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {}

    if (cartItems.length === 0) {
      toast.error('Your cart is empty', { description: 'Please add items before checking out.' })
      return false
    }

    if (isAuthenticated && user?.id) {
      if (!selectedAddressId) {
        errors.address = 'Please select a delivery address'
        toast.error('Please select a delivery address', {
          description: 'Choose a saved address or add a new address to continue.',
        })
      } else {
        const addrExists = addresses.some((a) => a.id === selectedAddressId)
        if (!addrExists) {
          errors.address = 'Selected address is invalid'
          toast.error('Please select a valid delivery address')
        }
      }
    } else {
      if (!guestName.trim()) errors.guestName = 'Full name is required'
      if (!guestPhone.trim()) {
        errors.guestPhone = 'Mobile number is required'
      } else if (!validatePhone(guestPhone)) {
        errors.guestPhone = 'Enter a valid BD mobile number (01XXXXXXXXX)'
      }
      if (!guestAddress.trim()) errors.guestAddress = 'Delivery address is required'
      if (!guestCity.trim()) errors.guestCity = 'City is required'

      if (Object.keys(errors).length > 0) {
        toast.error('Please complete all required contact & shipping fields')
      }
    }

    if (!termsAccepted) {
      errors.terms = 'Please accept the Terms & Conditions'
      toast.error('Terms agreement required', {
        description: 'You must agree to the Terms & Conditions to proceed.',
      })
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ─── Step Navigation ──────────────────────────────────────────────────────
  const goToStep = (step: number) => {
    if (step === 2 && currentStep === 1) {
      if (!validateStep1()) return
    }
    setCurrentStep(step)
    setMaxReachedStep((prev) => Math.max(prev, step))
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
        toast.error(data.error || 'Invalid coupon code')
        return
      }
      const discountAmount = data.type === 'percentage'
        ? Math.min(sub * (data.value / 100), data.maxDiscount || Infinity)
        : data.value
      setDiscount(discountAmount)
      setCouponApplied(true)
      toast.success('Coupon applied successfully!', {
        description: `Saved ${formatPrice(discountAmount)} on your order.`,
      })
    } catch {
      toast.error('Failed to validate coupon code')
    }
  }

  // ─── Address CRUD (Instant State Sync & Auto-select) ─────────────────────

  const handleAddAddress = async () => {
    if (!user?.id) return
    if (!newAddr.name.trim() || !newAddr.phone.trim() || !newAddr.address.trim() || !newAddr.city.trim()) {
      toast.error('Please fill in required fields', { description: 'Name, phone, address, and city are required.' })
      return
    }

    setSavingAddress(true)
    try {
      const token = useAppStore.getState().accessToken
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const isFirst = addresses.length === 0
      const setAsDefault = isFirst || newAddrIsDefault

      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: user.id,
          name: newAddr.name.trim(),
          phone: newAddr.phone.trim(),
          address: newAddr.address.trim(),
          city: newAddr.city.trim(),
          district: newAddr.district?.trim() || null,
          postalCode: newAddr.postalCode?.trim() || null,
          isDefault: setAsDefault,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Unable to save address. Please try again.')
      }

      // CRITICAL FIX: Properly unwrap created address object from API response
      const savedAddress: Address = data.data || data

      if (!savedAddress?.id) {
        throw new Error('Saved address data invalid')
      }

      // Synchronously update address list and set as default if applicable
      setAddresses((prev) => {
        const updated = setAsDefault
          ? prev.map((a) => ({ ...a, isDefault: false }))
          : [...prev]
        return [savedAddress, ...updated.filter((a) => a.id !== savedAddress.id)]
      })

      // INSTANT AUTO-SELECT NEW ADDRESS
      setSelectedAddressId(savedAddress.id)
      setShowAddAddress(false)
      setNewAddr({ name: '', phone: '', address: '', city: '', district: '', postalCode: '' })
      setNewAddrIsDefault(false)
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next.address
        return next
      })

      toast.success('Address saved successfully', {
        description: 'Using your new delivery address.',
      })
    } catch (err: any) {
      toast.error(err.message || 'Unable to save address. Please try again.')
    } finally {
      setSavingAddress(false)
    }
  }

  const handleStartEditAddress = (addr: Address, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingAddressId(addr.id)
    setEditingAddr({
      name: addr.name,
      phone: addr.phone,
      address: addr.address,
      city: addr.city,
      district: addr.district || '',
      postalCode: addr.postalCode || '',
      isDefault: addr.isDefault,
    })
  }

  const handleUpdateAddress = async () => {
    if (!editingAddressId || !user?.id) return
    if (!editingAddr.name.trim() || !editingAddr.phone.trim() || !editingAddr.address.trim() || !editingAddr.city.trim()) {
      toast.error('Please fill in required fields', { description: 'Name, phone, address, and city are required.' })
      return
    }

    setSavingAddress(true)
    try {
      const token = useAppStore.getState().accessToken
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`/api/addresses/${editingAddressId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          userId: user.id,
          name: editingAddr.name.trim(),
          phone: editingAddr.phone.trim(),
          address: editingAddr.address.trim(),
          city: editingAddr.city.trim(),
          district: editingAddr.district?.trim() || null,
          postalCode: editingAddr.postalCode?.trim() || null,
          isDefault: editingAddr.isDefault,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Unable to update address.')
      }

      const updatedAddress: Address = data.data || data

      setAddresses((prev) =>
        prev.map((a) => {
          if (a.id === editingAddressId) return updatedAddress
          if (updatedAddress.isDefault) return { ...a, isDefault: false }
          return a
        })
      )
      setSelectedAddressId(updatedAddress.id)
      setEditingAddressId(null)
      toast.success('Address updated successfully', { description: 'Using updated delivery details.' })
    } catch (err: any) {
      toast.error(err.message || 'Unable to update address.')
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
      toast.success('Address removed')
    } catch {
      toast.error('Unable to remove address')
    }
  }

  const handleSetDefaultAddress = async (addressId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user?.id) return
    try {
      const token = useAppStore.getState().accessToken
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`/api/addresses/${addressId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ userId: user.id, isDefault: true }),
      })

      if (!res.ok) throw new Error('Failed to set default address')

      setAddresses((prev) =>
        prev.map((a) => ({ ...a, isDefault: a.id === addressId }))
      )
      setSelectedAddressId(addressId)
      toast.success('Set as default delivery address')
    } catch {
      toast.error('Unable to set default address')
    }
  }

  // ─── Place Order ──────────────────────────────────────────────────────────

  const handlePlaceOrder = async () => {
    if (!validateStep1()) return

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
        orderData.guestName = guestName.trim()
        orderData.guestPhone = guestPhone.trim()
        orderData.guestEmail = guestEmail.trim() || undefined
        orderData.guestAddress = `${guestAddress.trim()}, ${guestCity.trim()}${guestDistrict ? `, ${guestDistrict.trim()}` : ''}`
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
        toast.success('Order placed successfully!', {
          description: `Order #${orderNum} confirmed. Thank you!`,
        })
        navigate('order-confirmation', { orderId, orderNumber: orderNum })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to place order')
      setPlacing(false)
    }
  }

  // ─── Empty Cart Screen ────────────────────────────────────────────────────

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-muted/20">
        <div className="flex-1 flex items-center justify-center py-16 px-4">
          <div className="text-center max-w-md">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Your shopping cart is empty</h2>
            <p className="text-muted-foreground mb-6 text-sm">Explore our premium organic products and add items to your cart before proceeding to checkout.</p>
            <Button onClick={() => navigate('products')} className="rounded-xl px-8 h-12 shadow-sm font-semibold">
              Browse Products
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Section Header ────────────────────────────────────────────────────────
  const SectionHeader = ({
    icon: Icon, title, subtitle, badge,
  }: { icon: typeof MapPin; title: string; subtitle?: string; badge?: string }) => (
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <span>{title}</span>
        {badge && <Badge variant="secondary" className="ml-auto text-xs font-semibold">{badge}</Badge>}
      </CardTitle>
      {subtitle && <p className="text-xs text-muted-foreground mt-1 ml-10">{subtitle}</p>}
    </CardHeader>
  )

  // ─── Order Items Summary ──────────────────────────────────────────────────
  const renderSummaryItems = (compact = false) => (
    <div className={`space-y-3 ${compact ? 'max-h-[40vh] overflow-y-auto pr-1' : 'max-h-72 overflow-y-auto pr-1'}`}>
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
              <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                {item.quantity}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.productName}</p>
              <p className="text-xs text-muted-foreground">
                {formatPrice(itemPrice)} {item.unit && `· per ${item.unit}`}
              </p>
            </div>
            <span className="text-sm font-semibold whitespace-nowrap text-primary">
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
        <span className="text-muted-foreground">Delivery Charge ({shippingMethod === 'express' ? 'Express' : 'Standard'})</span>
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
        <span className="font-semibold text-base">Grand Total</span>
        <motion.span
          key={total}
          initial={{ scale: 1.05 }}
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
            You save {formatPrice(discount)} on this order!
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
          Have a Coupon Code?
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
                  <span className="text-xs text-emerald-700 font-semibold">-{formatPrice(discount)}</span>
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
                  placeholder="Enter coupon code (e.g. KHATI10)"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value)
                    if (couponApplied) { setDiscount(0); setCouponApplied(false) }
                  }}
                  className="h-10 text-sm rounded-xl"
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                />
                <Button
                  variant="outline"
                  onClick={handleApplyCoupon}
                  className="h-10 border-primary/30 text-primary hover:bg-primary/5 font-semibold px-5 rounded-xl"
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
        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs">
          <Truck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold text-emerald-700">Congratulations! You qualify for FREE delivery!</span>
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

  // Sidebar Summary Card
  const SummaryCard = (
    <Card className="shadow-md rounded-2xl border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Order Summary
          </span>
          <Badge variant="secondary" className="text-xs font-semibold">{totalItems()} items</Badge>
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

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-muted/20 pb-12">
      {/* Compact Header */}
      <div className="bg-background border-b sticky top-0 z-30 shadow-sm">
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
            className="rounded-xl text-xs font-medium"
            onClick={() => navigate('cart')}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Cart
          </Button>
        </div>
      </div>

      {/* 2-Step Indicator */}
      <CheckoutStepIndicator
        currentStep={currentStep}
        onStepClick={goToStep}
        maxReachedStep={maxReachedStep}
      />

      {/* Main Container */}
      <div className="flex-1 container mx-auto px-4 py-6 sm:py-8">
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left Column: Checkout Step Forms */}
          <div className="lg:col-span-2 space-y-6">

            {/* ─── STEP 1: Delivery & Payment Details ───────────────────────── */}
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  {/* Delivery Address Card */}
                  <Card className="shadow-sm rounded-2xl border">
                    <SectionHeader
                      icon={MapPin}
                      title="1. Delivery Address"
                      subtitle="Choose or add a delivery address"
                      badge="Required"
                    />
                    <CardContent className="space-y-4 pt-0">
                      {isAuthenticated && user?.id ? (
                        <>
                          {/* Saved Addresses List */}
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
                                  return (
                                    <div
                                      key={addr.id}
                                      onClick={() => setSelectedAddressId(addr.id)}
                                      className={`relative rounded-xl p-4 border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                                        isSelected
                                          ? 'border-primary bg-primary/5 shadow-sm'
                                          : 'border-border bg-card hover:border-primary/40'
                                      }`}
                                    >
                                      <div>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                          <div className="flex items-center gap-2">
                                            <RadioGroupItem value={addr.id} id={addr.id} className="mt-0.5" />
                                            <span className="font-semibold text-sm text-foreground truncate max-w-[150px]">
                                              {addr.name}
                                            </span>
                                          </div>
                                          {addr.isDefault && (
                                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] px-2 py-0">
                                              Default
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground font-medium mb-1">
                                          <Phone className="h-3 w-3 inline mr-1" />
                                          {addr.phone}
                                        </p>
                                        <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">
                                          {addr.address}, {addr.city}{addr.district ? `, ${addr.district}` : ''}
                                        </p>
                                      </div>

                                      <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/50 text-xs">
                                        <button
                                          type="button"
                                          onClick={(e) => handleStartEditAddress(addr, e)}
                                          className="text-primary hover:underline font-medium flex items-center gap-1"
                                        >
                                          <Edit2 className="h-3 w-3" /> Edit
                                        </button>
                                        {!addr.isDefault && (
                                          <button
                                            type="button"
                                            onClick={(e) => handleSetDefaultAddress(addr.id, e)}
                                            className="text-muted-foreground hover:text-foreground font-medium"
                                          >
                                            Set Default
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={(e) => handleDeleteAddress(addr.id, e)}
                                          className="text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                                        >
                                          <Trash2 className="h-3 w-3" /> Remove
                                        </button>
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
                                  setNewAddr({ name: user.name || '', phone: user.phone || '', address: '', city: 'Dhaka', district: 'Dhaka', postalCode: '' })
                                  setShowAddAddress(true)
                                }}
                                className="w-full h-11 border-dashed border-2 rounded-xl text-primary hover:bg-primary/5 font-semibold text-xs"
                              >
                                + Add New Delivery Address
                              </Button>
                            </div>
                          )}

                          {/* No saved address state */}
                          {addresses.length === 0 && !showAddAddress && !editingAddressId && (
                            <div className="text-center py-6 border-2 border-dashed rounded-xl bg-muted/20 p-4">
                              <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                              <p className="text-sm font-semibold mb-1">No saved addresses found</p>
                              <p className="text-xs text-muted-foreground mb-4">Add a delivery address to complete your order</p>
                              <Button
                                onClick={() => {
                                  setNewAddr({ name: user.name || '', phone: user.phone || '', address: '', city: 'Dhaka', district: 'Dhaka', postalCode: '' })
                                  setShowAddAddress(true)
                                }}
                                className="rounded-xl px-6 h-10 text-xs font-semibold"
                              >
                                + Create Delivery Address
                              </Button>
                            </div>
                          )}

                          {/* Add Address Form */}
                          {showAddAddress && (
                            <div className="space-y-3 bg-card border rounded-xl p-4 shadow-sm">
                              <div className="flex items-center justify-between border-b pb-2">
                                <h4 className="font-semibold text-sm">Add New Address</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowAddAddress(false)}
                                  className="h-7 w-7 p-0 rounded-full"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs font-medium mb-1 block">Full Name *</Label>
                                  <Input
                                    placeholder="Enter recipient name"
                                    value={newAddr.name}
                                    onChange={(e) => setNewAddr({ ...newAddr, name: e.target.value })}
                                    className="h-10 text-sm rounded-xl"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs font-medium mb-1 block">Phone Number *</Label>
                                  <Input
                                    placeholder="017XXXXXXXX"
                                    value={newAddr.phone}
                                    onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
                                    className="h-10 text-sm rounded-xl"
                                  />
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs font-medium mb-1 block">Detailed Address (House/Road/Area) *</Label>
                                <Input
                                  placeholder="e.g. House 12, Road 5, Block B, Mirpur"
                                  value={newAddr.address}
                                  onChange={(e) => setNewAddr({ ...newAddr, address: e.target.value })}
                                  className="h-10 text-sm rounded-xl"
                                />
                              </div>
                              <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs font-medium mb-1 block">City / Area *</Label>
                                  <Input
                                    placeholder="e.g. Dhaka, Chittagong"
                                    value={newAddr.city}
                                    onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                                    className="h-10 text-sm rounded-xl"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs font-medium mb-1 block">District</Label>
                                  <Select
                                    value={newAddr.district}
                                    onValueChange={(val) => setNewAddr({ ...newAddr, district: val })}
                                  >
                                    <SelectTrigger className="h-10 text-sm rounded-xl">
                                      <SelectValue placeholder="Select District" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {bangladeshDistricts.map((d) => (
                                        <SelectItem key={d} value={d}>{d}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <Checkbox
                                  id="new-default"
                                  checked={newAddrIsDefault}
                                  onCheckedChange={(c) => setNewAddrIsDefault(!!c)}
                                />
                                <Label htmlFor="new-default" className="text-xs cursor-pointer">
                                  Set as default delivery address
                                </Label>
                              </div>

                              <div className="flex gap-2 pt-2">
                                <Button
                                  variant="outline"
                                  onClick={() => setShowAddAddress(false)}
                                  className="flex-1 h-10 text-xs rounded-xl"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={handleAddAddress}
                                  disabled={savingAddress}
                                  className="flex-1 h-10 text-xs rounded-xl font-semibold"
                                >
                                  {savingAddress ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                                  Save & Use Address
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Edit Address Form */}
                          {editingAddressId && (
                            <div className="space-y-3 bg-card border rounded-xl p-4 shadow-sm">
                              <div className="flex items-center justify-between border-b pb-2">
                                <h4 className="font-semibold text-sm">Edit Address</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingAddressId(null)}
                                  className="h-7 w-7 p-0 rounded-full"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs font-medium mb-1 block">Full Name *</Label>
                                  <Input
                                    value={editingAddr.name}
                                    onChange={(e) => setEditingAddr({ ...editingAddr, name: e.target.value })}
                                    className="h-10 text-sm rounded-xl"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs font-medium mb-1 block">Phone Number *</Label>
                                  <Input
                                    value={editingAddr.phone}
                                    onChange={(e) => setEditingAddr({ ...editingAddr, phone: e.target.value })}
                                    className="h-10 text-sm rounded-xl"
                                  />
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs font-medium mb-1 block">Detailed Address *</Label>
                                <Input
                                  value={editingAddr.address}
                                  onChange={(e) => setEditingAddr({ ...editingAddr, address: e.target.value })}
                                  className="h-10 text-sm rounded-xl"
                                />
                              </div>
                              <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs font-medium mb-1 block">City *</Label>
                                  <Input
                                    value={editingAddr.city}
                                    onChange={(e) => setEditingAddr({ ...editingAddr, city: e.target.value })}
                                    className="h-10 text-sm rounded-xl"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs font-medium mb-1 block">District</Label>
                                  <Select
                                    value={editingAddr.district}
                                    onValueChange={(val) => setEditingAddr({ ...editingAddr, district: val })}
                                  >
                                    <SelectTrigger className="h-10 text-sm rounded-xl">
                                      <SelectValue placeholder="Select District" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {bangladeshDistricts.map((d) => (
                                        <SelectItem key={d} value={d}>{d}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="flex gap-2 pt-2">
                                <Button
                                  variant="outline"
                                  onClick={() => setEditingAddressId(null)}
                                  className="flex-1 h-10 text-xs rounded-xl"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={handleUpdateAddress}
                                  disabled={savingAddress}
                                  className="flex-1 h-10 text-xs rounded-xl font-semibold"
                                >
                                  {savingAddress ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                                  Save Changes
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        /* Guest Contact & Shipping Form */
                        <div className="space-y-4">
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs flex items-center justify-between">
                            <span className="text-amber-800 font-medium">Checking out as Guest</span>
                            <button
                              type="button"
                              onClick={() => navigate('login')}
                              className="text-primary font-bold hover:underline"
                            >
                              Login for Saved Addresses →
                            </button>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs font-medium mb-1 block">Full Name *</Label>
                              <Input
                                placeholder="Enter your full name"
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                className={`h-10 text-sm rounded-xl ${formErrors.guestName ? 'border-red-500' : ''}`}
                              />
                              {formErrors.guestName && (
                                <p className="text-[11px] text-red-500 mt-1">{formErrors.guestName}</p>
                              )}
                            </div>

                            <div>
                              <Label className="text-xs font-medium mb-1 block">Mobile Number (01XXXXXXXXX) *</Label>
                              <Input
                                placeholder="01712345678"
                                value={guestPhone}
                                onChange={(e) => setGuestPhone(e.target.value)}
                                className={`h-10 text-sm rounded-xl ${formErrors.guestPhone ? 'border-red-500' : ''}`}
                              />
                              {formErrors.guestPhone && (
                                <p className="text-[11px] text-red-500 mt-1">{formErrors.guestPhone}</p>
                              )}
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs font-medium mb-1 block">Email Address (Optional)</Label>
                            <Input
                              placeholder="your@email.com"
                              type="email"
                              value={guestEmail}
                              onChange={(e) => setGuestEmail(e.target.value)}
                              className="h-10 text-sm rounded-xl"
                            />
                          </div>

                          <div>
                            <Label className="text-xs font-medium mb-1 block">Full Delivery Address (House/Road/Area) *</Label>
                            <Input
                              placeholder="e.g. House 45, Road 12, Sector 3, Uttara"
                              value={guestAddress}
                              onChange={(e) => setGuestAddress(e.target.value)}
                              className={`h-10 text-sm rounded-xl ${formErrors.guestAddress ? 'border-red-500' : ''}`}
                            />
                            {formErrors.guestAddress && (
                              <p className="text-[11px] text-red-500 mt-1">{formErrors.guestAddress}</p>
                            )}
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs font-medium mb-1 block">City / Area *</Label>
                              <Input
                                placeholder="e.g. Dhaka, Chittagong"
                                value={guestCity}
                                onChange={(e) => setGuestCity(e.target.value)}
                                className={`h-10 text-sm rounded-xl ${formErrors.guestCity ? 'border-red-500' : ''}`}
                              />
                              {formErrors.guestCity && (
                                <p className="text-[11px] text-red-500 mt-1">{formErrors.guestCity}</p>
                              )}
                            </div>
                            <div>
                              <Label className="text-xs font-medium mb-1 block">District</Label>
                              <Select
                                value={guestDistrict}
                                onValueChange={(val) => setGuestDistrict(val)}
                              >
                                <SelectTrigger className="h-10 text-sm rounded-xl">
                                  <SelectValue placeholder="Select District" />
                                </SelectTrigger>
                                <SelectContent>
                                  {bangladeshDistricts.map((d) => (
                                    <SelectItem key={d} value={d}>{d}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Delivery Method Card */}
                  <Card className="shadow-sm rounded-2xl border">
                    <SectionHeader
                      icon={Truck}
                      title="2. Delivery Method"
                      subtitle="Choose your preferred delivery speed"
                    />
                    <CardContent className="pt-0">
                      <RadioGroup
                        value={shippingMethod}
                        onValueChange={setShippingMethod}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                      >
                        <div
                          onClick={() => setShippingMethod('standard')}
                          className={`rounded-xl p-4 border-2 cursor-pointer transition-all ${
                            shippingMethod === 'standard'
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border bg-card hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="standard" id="std" />
                              <Label htmlFor="std" className="font-semibold text-sm cursor-pointer">
                                Regular Delivery
                              </Label>
                            </div>
                            <span className="text-xs font-bold text-primary">
                              {sub >= freeThreshold ? 'FREE' : formatPrice(standardShipping)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 ml-6">
                            Estimated delivery in 3–5 business days across Bangladesh.
                          </p>
                        </div>

                        <div
                          onClick={() => setShippingMethod('express')}
                          className={`rounded-xl p-4 border-2 cursor-pointer transition-all ${
                            shippingMethod === 'express'
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border bg-card hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="express" id="exp" />
                              <Label htmlFor="exp" className="font-semibold text-sm cursor-pointer flex items-center gap-1">
                                Express Delivery
                                <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">Fast</Badge>
                              </Label>
                            </div>
                            <span className="text-xs font-bold text-primary">
                              {formatPrice(expressShipping)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 ml-6">
                            Next-day priority delivery in major metropolitan areas.
                          </p>
                        </div>
                      </RadioGroup>
                    </CardContent>
                  </Card>

                  {/* Payment Method Card */}
                  <Card className="shadow-sm rounded-2xl border">
                    <SectionHeader
                      icon={CreditCard}
                      title="3. Payment Method"
                      subtitle="Select how you wish to pay"
                    />
                    <CardContent className="pt-0 space-y-3">
                      <RadioGroup
                        value={paymentMethod}
                        onValueChange={setPaymentMethod}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                      >
                        <div
                          onClick={() => setPaymentMethod('cod')}
                          className={`rounded-xl p-4 border-2 cursor-pointer transition-all ${
                            paymentMethod === 'cod'
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border bg-card hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="cod" id="cod" />
                              <Label htmlFor="cod" className="font-semibold text-sm cursor-pointer flex items-center gap-1.5">
                                <Banknote className="h-4 w-4 text-emerald-600" />
                                Cash on Delivery (COD)
                              </Label>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground ml-6 leading-relaxed">
                            Pay with cash when your package is delivered right to your door.
                          </p>
                        </div>

                        <div
                          onClick={() => setPaymentMethod('online')}
                          className={`rounded-xl p-4 border-2 cursor-pointer transition-all ${
                            paymentMethod === 'online'
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border bg-card hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="online" id="online" />
                              <Label htmlFor="online" className="font-semibold text-sm cursor-pointer flex items-center gap-1.5">
                                <Wallet className="h-4 w-4 text-primary" />
                                Online Payment (SSLCommerz)
                              </Label>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground ml-6 leading-relaxed">
                            bKash, Nagad, Rocket, Visa, Mastercard, Internet Banking.
                          </p>
                        </div>
                      </RadioGroup>
                    </CardContent>
                  </Card>

                  {/* Order Note & Terms Card */}
                  <Card className="shadow-sm rounded-2xl border">
                    <CardContent className="pt-5 space-y-4">
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                          Delivery Note / Special Instructions (Optional)
                        </Label>
                        <Textarea
                          placeholder="e.g. Call before delivery, drop at front desk, leave with security..."
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          className="text-xs rounded-xl min-h-[70px] resize-none"
                        />
                      </div>

                      <div className="flex items-start gap-2 pt-2 border-t">
                        <Checkbox
                          id="terms"
                          checked={termsAccepted}
                          onCheckedChange={(c) => setTermsAccepted(!!c)}
                          className="mt-0.5"
                        />
                        <Label htmlFor="terms" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                          I agree to the{' '}
                          <span onClick={() => navigate('terms')} className="text-primary hover:underline font-medium">
                            Terms & Conditions
                          </span>
                          {' '}and{' '}
                          <span onClick={() => navigate('delivery-policy')} className="text-primary hover:underline font-medium">
                            Delivery Policy
                          </span>.
                        </Label>
                      </div>
                      {formErrors.terms && (
                        <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {formErrors.terms}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Primary Action Button: Proceed to Review */}
                  <Button
                    onClick={() => goToStep(2)}
                    className="w-full h-14 rounded-2xl text-base font-bold shadow-md hover:shadow-lg transition-all"
                    size="lg"
                  >
                    Continue to Review Order
                    <ChevronRight className="h-5 w-5 ml-1" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── STEP 2: Review & Place Order ─────────────────────────────── */}
            <AnimatePresence mode="wait">
              {currentStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  {/* Summary Card */}
                  <Card className="shadow-sm rounded-2xl border">
                    <SectionHeader
                      icon={CheckCircle2}
                      title="Review Order Details"
                      subtitle="Please verify your details before placing the order"
                      badge="Final Step"
                    />
                    <CardContent className="space-y-4 pt-0">
                      {/* Delivery Address Summary */}
                      <div className="p-4 rounded-xl bg-card border flex items-start justify-between gap-3">
                        <div className="flex gap-3">
                          <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <div className="text-xs space-y-1">
                            <p className="font-semibold text-sm text-foreground">Delivery Address</p>
                            {isAuthenticated && selectedAddrObj ? (
                              <>
                                <p className="font-medium text-foreground">{selectedAddrObj.name} · {selectedAddrObj.phone}</p>
                                <p className="text-muted-foreground">{selectedAddrObj.address}, {selectedAddrObj.city}{selectedAddrObj.district ? `, ${selectedAddrObj.district}` : ''}</p>
                              </>
                            ) : (
                              <>
                                <p className="font-medium text-foreground">{guestName} · {guestPhone}</p>
                                <p className="text-muted-foreground">{guestAddress}, {guestCity}{guestDistrict ? `, ${guestDistrict}` : ''}</p>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentStep(1)}
                          className="text-xs text-primary font-medium h-8"
                        >
                          <Edit2 className="h-3 w-3 mr-1" /> Change
                        </Button>
                      </div>

                      {/* Delivery & Payment Method Summary */}
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-card border flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-primary" />
                            <div>
                              <p className="font-semibold text-foreground">Delivery Speed</p>
                              <p className="text-muted-foreground">
                                {shippingMethod === 'express' ? 'Express Delivery (Next Day)' : 'Regular Delivery (3-5 Days)'}
                              </p>
                            </div>
                          </div>
                          <span className="font-semibold">{shipping === 0 ? 'FREE' : formatPrice(shipping)}</span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-card border flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {paymentMethod === 'cod' ? (
                              <Banknote className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Wallet className="h-4 w-4 text-primary" />
                            )}
                            <div>
                              <p className="font-semibold text-foreground">Payment Method</p>
                              <p className="text-muted-foreground">
                                {paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Online Payment (SSLCommerz)'}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {paymentMethod === 'cod' ? 'COD' : 'SSLCommerz'}
                          </Badge>
                        </div>
                      </div>

                      {/* Item List Review */}
                      <div className="pt-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Order Items ({totalItems()})
                        </h4>
                        {renderSummaryItems(true)}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <div className="space-y-3">
                    <Button
                      onClick={handlePlaceOrder}
                      disabled={placing}
                      className="w-full h-14 rounded-2xl text-base font-bold shadow-md hover:shadow-lg transition-all"
                      size="lg"
                    >
                      {placing ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          Processing Order...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-5 w-5 mr-2 text-emerald-300" />
                          {paymentMethod === 'online' ? 'Pay & Place Order' : 'Place Order'} • {formatPrice(total)}
                        </>
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() => setCurrentStep(1)}
                      className="w-full h-11 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                      Back to Delivery & Payment Details
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* Right Column: Sticky Order Summary Sidebar */}
          <div className="lg:col-span-1 hidden lg:block">
            <div className="sticky top-20">
              {SummaryCard}
            </div>
          </div>

        </div>
      </div>

      {/* Mobile Sticky Bottom Summary Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-background border-t p-3 shadow-lg flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground">Total Payable</p>
          <p className="text-lg font-bold text-primary">{formatPrice(total)}</p>
        </div>
        <div className="flex gap-2">
          <Sheet open={mobileSummaryOpen} onOpenChange={setMobileSummaryOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl text-xs h-10 px-3">
                Items ({totalItems()})
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
              <SheetHeader className="pb-3">
                <SheetTitle className="text-base font-bold">Order Summary</SheetTitle>
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
            onClick={currentStep === 1 ? () => goToStep(2) : handlePlaceOrder}
            disabled={placing}
            className="rounded-xl text-xs font-bold h-10 px-5 shadow-sm"
          >
            {placing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : currentStep === 1 ? (
              'Continue →'
            ) : (
              'Place Order'
            )}
          </Button>
        </div>
      </div>

    </div>
  )
}
