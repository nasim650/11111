'use client'

import { useEffect, useReducer, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Mail, Phone, MapPin, Lock, Package, LogOut, Save,
  Heart, ShoppingBag, Camera, Calendar, Edit3, Trash2, Plus,
  Check, Eye, EyeOff, ChevronRight, Settings, Home, Bell,
  Shield, Globe, CreditCard, HelpCircle, AlertTriangle, Star,
  KeyRound, MapPinned, ShoppingBagIcon, BadgeCheck, Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useAppStore } from '@/lib/store'
import { extractItems } from '@/lib/api'
import SmartAddressForm from '@/components/shared/SmartAddressForm'
import { packSmartAddress, unpackSmartAddress, type SmartAddressData } from '@/lib/bangladesh-address'
import { toast } from 'sonner'
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

interface OrderSummary {
  id: string
  orderNumber: string
  total: number
  status: string
  createdAt: string
  items: number
}

type ProfileTab = 'profile' | 'orders' | 'addresses' | 'settings'

// Password strength helper
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 10) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score: 20, label: 'Weak', color: 'bg-red-500' }
  if (score <= 2) return { score: 40, label: 'Fair', color: 'bg-orange-500' }
  if (score <= 3) return { score: 60, label: 'Good', color: 'bg-amber-500' }
  if (score <= 4) return { score: 80, label: 'Strong', color: 'bg-emerald-500' }
  return { score: 100, label: 'Very Strong', color: 'bg-emerald-600' }
}

// Order status gradient colors
function getStatusGradient(status: string): string {
  switch (status?.toLowerCase()) {
    case 'delivered': return 'from-emerald-500 to-emerald-600'
    case 'shipped': return 'from-sky-500 to-sky-600'
    case 'processing': return 'from-amber-500 to-amber-600'
    case 'pending': return 'from-gray-400 to-gray-500'
    case 'cancelled': return 'from-red-500 to-red-600'
    default: return 'from-gray-400 to-gray-500'
  }
}

function getStatusBgClass(status: string): string {
  switch (status?.toLowerCase()) {
    case 'delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'shipped': return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'processing': return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'pending': return 'bg-gray-50 text-gray-700 border-gray-200'
    case 'cancelled': return 'bg-red-50 text-red-700 border-red-200'
    default: return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

function getStatusIconComponent(status: string) {
  switch (status?.toLowerCase()) {
    case 'delivered': return <BadgeCheck className="h-4 w-4" />
    case 'shipped': return <ShoppingBagIcon className="h-4 w-4" />
    case 'processing': return <Clock className="h-4 w-4" />
    case 'pending': return <Package className="h-4 w-4" />
    case 'cancelled': return <AlertTriangle className="h-4 w-4" />
    default: return <Package className="h-4 w-4" />
  }
}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: 'easeOut' as const }
}

const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.06 }
  }
}

const staggerItem = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } }
}

export default function ProfilePage() {
  const { user, isAuthenticated, navigate, logout, wishlistItems } = useAppStore()
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile')
  const [editing, setEditing] = useState(false)

  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState(user?.phone || '')

  // Validation states for profile form
  const [nameError, setNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [phoneTouched, setPhoneTouched] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [smsNotifications, setSmsNotifications] = useState(true)
  const [promoNotifications, setPromoNotifications] = useState(false)

  // Address form
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [addressForm, setAddressForm] = useState({
    name: '', phone: '', address: '', city: '', district: '', postalCode: '', isDefault: false
  })
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({})

  // Use reducer for data fetched in effects
  const [addresses, setAddresses] = useReducer(
    (_: Address[], next: Address[]) => next,
    []
  )
  const [recentOrders, setRecentOrders] = useReducer(
    (_: OrderSummary[], next: OrderSummary[]) => next,
    []
  )

  // Refs for animated counters
  const ordersRef = useRef<HTMLButtonElement>(null)
  const wishlistRef = useRef<HTMLButtonElement>(null)
  const addressesRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('login')
      return
    }
    if (user?.id) {
      fetch(`/api/addresses?userId=${user.id}`)
        .then((r) => r.json())
        .then((data) => {
          setAddresses(extractItems<Address>(data))
        })
        .catch(() => {})

      fetch(`/api/orders?userId=${user.id}&limit=5`)
        .then((r) => r.json())
        .then((data) => {
          const items = extractItems<OrderSummary>(data)
          setRecentOrders(items)
        })
        .catch(() => {})
    }
  }, [isAuthenticated, user?.id, navigate])

  // Profile validation helpers
  const validateName = (val: string) => {
    if (!val.trim()) return 'Name is required'
    if (val.trim().length < 2) return 'Name must be at least 2 characters'
    return ''
  }

  const validateEmail = (val: string) => {
    if (!val.trim()) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Please enter a valid email'
    return ''
  }

  const validatePhone = (val: string) => {
    if (!val.trim()) return '' // phone is optional
    if (!/^[\d+\-\s()]{7,15}$/.test(val.trim())) return 'Please enter a valid phone number'
    return ''
  }

  const isProfileFormValid = () => {
    return !validateName(name) && !validateEmail(email) && !validatePhone(phone)
  }

  const handleSaveProfile = async () => {
    if (!user?.id) return
    const nErr = validateName(name)
    const eErr = validateEmail(email)
    const pErr = validatePhone(phone)
    setNameError(nErr)
    setEmailError(eErr)
    setPhoneError(pErr)
    setNameTouched(true)
    setEmailTouched(true)
    setPhoneTouched(true)

    if (nErr || eErr || pErr) {
      toast.error('Please fix the errors before saving')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone }),
      })
      if (!res.ok) throw new Error('Failed to update profile')
      toast.success('Profile updated successfully!')
      setEditing(false)
      setNameTouched(false)
      setEmailTouched(false)
      setPhoneTouched(false)
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Please fill in both password fields')
      return
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) throw new Error('Failed to change password')
      toast.success('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch {
      toast.error('Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAddress = async (addressId: string) => {
    try {
      const res = await fetch(`/api/addresses/${addressId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${useAppStore.getState().accessToken}` } })
      if (!res.ok) throw new Error('Failed to delete address')
      setAddresses(addresses.filter((a) => a.id !== addressId))
      toast.success('Address deleted')
    } catch {
      toast.error('Failed to delete address')
    }
  }

  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      const res = await fetch(`/api/addresses/${addressId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })
      if (!res.ok) throw new Error('Failed to set default address')
      setAddresses(addresses.map((a) => ({ ...a, isDefault: a.id === addressId })))
      toast.success('Default address updated!')
    } catch {
      toast.error('Failed to set default address')
    }
  }

  const validateAddressForm = () => {
    const errs: Record<string, string> = {}
    if (!addressForm.name.trim()) errs.name = 'Name is required'
    if (!addressForm.phone.trim()) errs.phone = 'Phone is required'
    else if (!/^[\d+\-\s()]{7,15}$/.test(addressForm.phone.trim())) errs.phone = 'Invalid phone number'
    if (!addressForm.address.trim()) errs.address = 'Address is required'
    if (!addressForm.city.trim()) errs.city = 'City is required'
    setAddressErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSaveSmartAddress = async (smart: SmartAddressData) => {
    if (!user?.id) return
    setSaving(true)
    try {
      const packed = packSmartAddress(smart)
      const isEdit = !!editingAddressId
      const url = isEdit ? `/api/addresses/${editingAddressId}` : '/api/addresses'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, ...packed }),
      })

      if (!res.ok) throw new Error(isEdit ? 'Failed to update address' : 'Failed to save address')
      const data = await res.json()
      const saved = data.data || data

      if (isEdit) {
        setAddresses(addresses.map((a) => (a.id === editingAddressId ? saved : a)))
        toast.success('Address updated successfully!')
      } else {
        setAddresses([...addresses, saved])
        toast.success('Smart address saved successfully!')
      }

      setShowAddressForm(false)
      setEditingAddressId(null)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save address')
    } finally {
      setSaving(false)
    }
  }

  const handleEditAddress = (addr: Address) => {
    setEditingAddressId(addr.id)
    setAddressForm({
      name: addr.name,
      phone: addr.phone,
      address: addr.address,
      city: addr.city,
      district: addr.district || '',
      postalCode: addr.postalCode || '',
      isDefault: addr.isDefault,
    })
    setAddressErrors({})
    setShowAddressForm(true)
  }

  const handleDeleteAccount = async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete account')
      toast.success('Account deleted successfully')
      logout()
      navigate('home')
    } catch {
      toast.error('Failed to delete account. Please contact support.')
    }
  }

  const handleLogout = () => {
    logout()
    navigate('home')
    toast.success('Logged out successfully')
  }

  if (!isAuthenticated || !user) {
    return null
  }

  const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A'
  const initials = user.name?.split(' ').map(w => w.charAt(0)).join('').toUpperCase().slice(0, 2) || 'U'
  const pwStrength = getPasswordStrength(newPassword)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50/80 to-white">
      {/* Profile Header with Cover Photo Area */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        {/* Cover Photo Gradient */}
        <div className="h-44 sm:h-56 bg-gradient-to-br from-primary via-emerald-700 to-emerald-900 relative overflow-hidden">
          {/* Decorative patterns */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="profile-pattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                  <circle cx="30" cy="30" r="10" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#profile-pattern)" />
            </svg>
          </div>
          <div className="absolute top-6 right-12 w-36 h-36 rounded-full border-2 border-white/10 animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-6 left-16 w-24 h-24 rounded-full border-2 border-white/10" />
          <div className="absolute top-1/3 left-1/3 w-16 h-16 rounded-full bg-white/5 blur-xl" />
          <div className="absolute bottom-1/4 right-1/4 w-24 h-24 rounded-full bg-secondary/10 blur-xl" />
          {/* Edit Profile overlay button */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-4 right-4 z-10"
          >
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full shadow-lg bg-white/90 backdrop-blur-sm hover:bg-white text-primary"
              onClick={() => {
                if (editing) {
                  setEditing(false)
                  setName(user?.name || '')
                  setEmail(user?.email || '')
                  setPhone(user?.phone || '')
                  setNameError('')
                  setEmailError('')
                  setPhoneError('')
                  setNameTouched(false)
                  setEmailTouched(false)
                  setPhoneTouched(false)
                } else {
                  setEditing(true)
                  setActiveTab('profile')
                }
              }}
            >
              <Edit3 className="h-3.5 w-3.5 mr-1.5" />
              {editing ? 'Cancel Edit' : 'Edit Profile'}
            </Button>
          </motion.div>
        </div>

        {/* Profile Info Section - Overlapping cover */}
        <div className="container mx-auto px-4 -mt-16 sm:-mt-20 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="bg-white rounded-2xl shadow-lg ring-1 ring-gray-100 p-6"
          >
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              {/* Avatar with Edit Overlay */}
              <div className="relative group -mt-16 sm:-mt-20">
                <Avatar className="h-28 w-28 ring-4 ring-white shadow-xl">
                  <AvatarImage src={user.avatar || undefined} />
                  <AvatarFallback className="text-3xl bg-gradient-to-br from-primary to-emerald-600 text-white font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <button className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                    <Camera className="h-4 w-4 text-primary" />
                  </div>
                </button>
              </div>

              {/* Info */}
              <div className="text-center sm:text-left flex-1 pt-2">
                <h1 className="text-2xl font-bold">{user.name || 'User'}</h1>
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 mt-1.5 text-muted-foreground text-sm">
                  {user.email && (
                    <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {user.email}</span>
                  )}
                  {user.phone && (
                    <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {user.phone}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-3">
                  <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 rounded-full px-3 py-1">
                    <Calendar className="h-3 w-3 mr-1" /> Member since {joinDate}
                  </Badge>
                  <Badge className="bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/15 rounded-full px-3 py-1">
                    {user.role === 'admin' ? '⭐ Admin' : '👤 Customer'}
                  </Badge>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-1.5" /> Logout
                </Button>
              </div>
            </div>

            {/* Quick Stats - Enhanced with animations */}
            <div className="grid grid-cols-3 gap-4 mt-6 max-w-lg mx-auto sm:mx-0">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="bg-gradient-to-br from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 rounded-xl p-4 text-center transition-all duration-200 cursor-pointer group border border-primary/5"
                onClick={() => setActiveTab('orders')}
                ref={ordersRef}
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-primary/20 transition-colors">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xl font-bold text-primary">{recentOrders.length}</p>
                <p className="text-xs text-muted-foreground">Orders</p>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="bg-gradient-to-br from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 rounded-xl p-4 text-center transition-all duration-200 cursor-pointer group border border-red-50"
                onClick={() => navigate('wishlist')}
                ref={wishlistRef}
              >
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-2 group-hover:bg-red-200 transition-colors">
                  <Heart className="h-5 w-5 text-red-500" />
                </div>
                <p className="text-xl font-bold text-red-500">{wishlistItems.length}</p>
                <p className="text-xs text-muted-foreground">Wishlist</p>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="bg-gradient-to-br from-secondary/5 to-amber-50 hover:from-secondary/10 hover:to-amber-100 rounded-xl p-4 text-center transition-all duration-200 cursor-pointer group border border-secondary/5"
                onClick={() => setActiveTab('addresses')}
                ref={addressesRef}
              >
                <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-secondary/20 transition-colors">
                  <MapPinned className="h-5 w-5 text-secondary" />
                </div>
                <p className="text-xl font-bold text-secondary">{addresses.length}</p>
                <p className="text-xs text-muted-foreground">Addresses</p>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Tabs - Enhanced */}
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProfileTab)}>
          <TabsList className="grid w-full grid-cols-4 mb-6 h-12 bg-white shadow-sm rounded-xl border">
            <TabsTrigger value="profile" className="gap-1.5 text-sm rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">
              <User className="h-4 w-4 hidden sm:block" /> Profile
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-1.5 text-sm rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">
              <Package className="h-4 w-4 hidden sm:block" /> Orders
            </TabsTrigger>
            <TabsTrigger value="addresses" className="gap-1.5 text-sm rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">
              <MapPin className="h-4 w-4 hidden sm:block" /> Addresses
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 text-sm rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">
              <Settings className="h-4 w-4 hidden sm:block" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <motion.div {...fadeInUp}>
              <Card className="rounded-2xl shadow-sm border-0 ring-1 ring-gray-100">
                <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-primary/5 to-transparent rounded-t-2xl">
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    Personal Information
                  </CardTitle>
                  <div className="flex gap-2">
                    {editing && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => {
                          setEditing(false)
                          setName(user?.name || '')
                          setEmail(user?.email || '')
                          setPhone(user?.phone || '')
                          setNameError('')
                          setEmailError('')
                          setPhoneError('')
                          setNameTouched(false)
                          setEmailTouched(false)
                          setPhoneTouched(false)
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      variant={editing ? 'default' : 'outline'}
                      size="sm"
                      className="rounded-lg"
                      onClick={() => {
                        if (editing) handleSaveProfile()
                        else setEditing(true)
                      }}
                      disabled={saving}
                    >
                      {editing ? (
                        <>{saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />} Save</>
                      ) : (
                        <><Edit3 className="h-4 w-4 mr-1.5" /> Edit</>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-1">
                        Full Name <span className="text-red-500">*</span>
                        {editing && nameTouched && !nameError && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                      </Label>
                      <div className="relative">
                        <Input
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value)
                            if (nameTouched) setNameError(validateName(e.target.value))
                          }}
                          onBlur={() => { setNameTouched(true); setNameError(validateName(name)) }}
                          disabled={!editing}
                          className={`h-11 rounded-xl transition-colors ${!editing ? 'bg-muted/50' : ''} ${
                            editing && nameTouched && nameError ? 'border-red-400 ring-2 ring-red-100 focus-visible:ring-red-200' :
                            editing && nameTouched && !nameError ? 'border-emerald-300 focus-visible:ring-emerald-200' : ''
                          }`}
                        />
                        {editing && nameTouched && nameError && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {nameError}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-1">
                        Email <span className="text-red-500">*</span>
                        {editing && emailTouched && !emailError && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                      </Label>
                      <div className="relative">
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value)
                            if (emailTouched) setEmailError(validateEmail(e.target.value))
                          }}
                          onBlur={() => { setEmailTouched(true); setEmailError(validateEmail(email)) }}
                          disabled={!editing}
                          className={`h-11 rounded-xl transition-colors ${!editing ? 'bg-muted/50' : ''} ${
                            editing && emailTouched && emailError ? 'border-red-400 ring-2 ring-red-100 focus-visible:ring-red-200' :
                            editing && emailTouched && !emailError ? 'border-emerald-300 focus-visible:ring-emerald-200' : ''
                          }`}
                        />
                        {editing && emailTouched && emailError && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {emailError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1">
                      Phone
                      {editing && phoneTouched && !phoneError && phone && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                    </Label>
                    <div className="relative">
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value)
                          if (phoneTouched) setPhoneError(validatePhone(e.target.value))
                        }}
                        onBlur={() => { setPhoneTouched(true); setPhoneError(validatePhone(phone)) }}
                        disabled={!editing}
                        className={`h-11 rounded-xl transition-colors ${!editing ? 'bg-muted/50' : ''} ${
                          editing && phoneTouched && phoneError ? 'border-red-400 ring-2 ring-red-100 focus-visible:ring-red-200' :
                          editing && phoneTouched && !phoneError && phone ? 'border-emerald-300 focus-visible:ring-emerald-200' : ''
                        }`}
                      />
                      {editing && phoneTouched && phoneError && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {phoneError}
                        </p>
                      )}
                    </div>
                  </div>
                  {editing && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10"
                    >
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Make your changes and click <span className="font-semibold text-primary">Save</span> to update your profile
                      </p>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Orders Tab - Enhanced with last 3 orders and status badges */}
          <TabsContent value="orders">
            <motion.div {...fadeInUp} className="space-y-4">
              <Card className="rounded-2xl shadow-sm border-0 ring-1 ring-gray-100">
                <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-primary/5 to-transparent rounded-t-2xl">
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ShoppingBag className="h-4 w-4 text-primary" />
                    </div>
                    Recent Orders
                  </CardTitle>
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => navigate('orders')}>
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {recentOrders.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-16"
                    >
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center mx-auto mb-5">
                        <Package className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                      <p className="text-muted-foreground font-medium text-lg">No orders yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Start shopping to see your orders here</p>
                      <Button variant="default" className="mt-5 rounded-xl px-6" onClick={() => navigate('products')}>
                        Start Shopping
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="space-y-3"
                    >
                      {recentOrders.slice(0, 3).map((order) => (
                        <motion.div
                          key={order.id}
                          variants={staggerItem}
                          whileHover={{ x: 4, transition: { duration: 0.15 } }}
                          className="flex items-center justify-between p-4 border rounded-xl hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group bg-white"
                          onClick={() => navigate('order-detail', { id: order.id })}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getStatusGradient(order.status)} flex items-center justify-center shadow-sm`}>
                              <Package className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">#{order.orderNumber || order.id.slice(-8)}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                {' · '}{order.items || 0} item{(order.items || 0) !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className="font-bold text-sm">৳{(order.total ?? 0).toLocaleString()}</p>
                              <Badge className={`text-xs mt-1 border rounded-full ${getStatusBgClass(order.status)}`}>
                                <span className="mr-1">{getStatusIconComponent(order.status)}</span>
                                {order.status}
                              </Badge>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </motion.div>
                      ))}
                      {recentOrders.length > 3 && (
                        <Button
                          variant="outline"
                          className="w-full rounded-xl mt-2"
                          onClick={() => navigate('orders')}
                        >
                          View All {recentOrders.length} Orders <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      )}
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              {/* Wishlist Summary */}
              <Card className="rounded-2xl shadow-sm border-0 ring-1 ring-gray-100">
                <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-red-50 to-transparent rounded-t-2xl">
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                      <Heart className="h-4 w-4 text-red-500" />
                    </div>
                    Wishlist ({wishlistItems.length})
                  </CardTitle>
                  {wishlistItems.length > 0 && (
                    <Button variant="outline" size="sm" className="rounded-lg" onClick={() => navigate('wishlist')}>
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {wishlistItems.length === 0 ? (
                    <div className="text-center py-8">
                      <Heart className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">No items in your wishlist</p>
                    </div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                      {wishlistItems.slice(0, 5).map((item) => (
                        <motion.div
                          key={item.productId}
                          whileHover={{ y: -4 }}
                          className="flex-shrink-0 w-28 text-center group cursor-pointer"
                          onClick={() => navigate('product-detail', { id: item.productId })}
                        >
                          <div className="w-28 h-28 rounded-xl bg-muted/30 overflow-hidden mb-2 ring-1 ring-gray-100 group-hover:ring-primary/30 transition-all">
                            <img
                              src={item.image}
                              alt={item.productName}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                          </div>
                          <p className="text-xs font-medium line-clamp-2">{item.productName}</p>
                          <p className="text-xs text-primary font-semibold mt-0.5">
                            ৳{(item.discountPrice ?? item.price).toLocaleString()}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Addresses Tab - Enhanced with better cards and default badge */}
          <TabsContent value="addresses">
            <motion.div {...fadeInUp}>
              <Card className="rounded-2xl shadow-sm border-0 ring-1 ring-gray-100">
                <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-secondary/5 to-transparent rounded-t-2xl">
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-secondary" />
                    </div>
                    Saved Addresses
                  </CardTitle>
                  <Button size="sm" className="rounded-lg" onClick={() => {
                    setEditingAddressId(null)
                    setAddressForm({ name: '', phone: '', address: '', city: '', district: '', postalCode: '', isDefault: false })
                    setAddressErrors({})
                    setShowAddressForm(!showAddressForm)
                  }}>
                    <Plus className="h-4 w-4 mr-1.5" /> Add Address
                  </Button>
                </CardHeader>
                <CardContent>
                  <AnimatePresence>
                    {(showAddressForm || editingAddressId) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-6 overflow-hidden"
                      >
                        <SmartAddressForm
                          initialValues={
                            editingAddressId
                              ? unpackSmartAddress(addresses.find((a) => a.id === editingAddressId))
                              : { name: user?.name || '', phone: user?.phone || '' }
                          }
                          onSubmit={handleSaveSmartAddress}
                          onCancel={() => {
                            setShowAddressForm(false)
                            setEditingAddressId(null)
                          }}
                          isSubmitting={saving}
                          submitLabel={editingAddressId ? 'Update Smart Address' : 'Save Smart Address'}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {addresses.length === 0 && !showAddressForm && !editingAddressId ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-16"
                    >
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center mx-auto mb-5">
                        <MapPin className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                      <p className="text-muted-foreground font-medium text-lg">No saved addresses</p>
                      <p className="text-sm text-muted-foreground mt-1">Add a Bangladesh Smart Address for fast 1-click checkout</p>
                      <Button
                        variant="default"
                        className="mt-5 rounded-xl px-6 font-bold"
                        onClick={() => {
                          setEditingAddressId(null)
                          setShowAddressForm(true)
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1.5" /> Add Your Smart Address
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    >
                      {addresses.map((addr) => {
                        const smart = unpackSmartAddress(addr)
                        return (
                          <motion.div
                            key={addr.id}
                            variants={staggerItem}
                            whileHover={{ y: -2 }}
                            className={`relative border rounded-2xl p-5 hover:shadow-md transition-all group ${
                              addr.isDefault ? 'border-primary/40 ring-2 ring-primary/10 bg-gradient-to-br from-primary/[0.02] to-primary/[0.04]' : 'hover:border-primary/30'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                                {smart.label || 'Home'}
                              </Badge>
                              {addr.isDefault && (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                                  <Star className="h-3 w-3 mr-1" /> Default
                                </Badge>
                              )}
                            </div>

                            <div className="space-y-1 text-xs">
                              <p className="font-bold text-sm text-foreground">{smart.name}</p>
                              <p className="text-primary font-semibold">📞 {smart.phone} {smart.altPhone ? `(Alt: ${smart.altPhone})` : ''}</p>
                              <p className="text-muted-foreground font-mono mt-1">{smart.addressDetail}</p>
                              <p className="text-muted-foreground font-medium">
                                {smart.unionOrArea ? `${smart.unionOrArea}, ` : ''}{smart.upazila}, {smart.district}, {smart.division}
                              </p>
                              {smart.landmark && <p className="text-amber-700 font-semibold mt-1">📍 Landmark: {smart.landmark}</p>}
                              {smart.deliveryNote && <p className="text-emerald-700 italic">📝 Note: {smart.deliveryNote}</p>}
                            </div>

                            <div className="flex gap-2 mt-4 pt-3 border-t">
                              {!addr.isDefault && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-8 rounded-lg text-primary hover:text-primary hover:bg-primary/10"
                                  onClick={() => handleSetDefaultAddress(addr.id)}
                                >
                                  <Star className="h-3.5 w-3.5 mr-1" /> Set Default
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-8 rounded-lg text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => {
                                  setEditingAddressId(addr.id)
                                  setShowAddressForm(false)
                                }}
                              >
                                <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteAddress(addr.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                              </Button>
                            </div>
                          </motion.div>
                        )
                      })}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Settings Tab - Enhanced with password strength and better styling */}
          <TabsContent value="settings" className="space-y-4">
            {/* Change Password */}
            <motion.div {...fadeInUp}>
              <Card className="rounded-2xl shadow-sm border-0 ring-1 ring-gray-100">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent rounded-t-2xl">
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <KeyRound className="h-4 w-4 text-primary" />
                    </div>
                    Change Password
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-w-md p-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Current Password</Label>
                    <div className="relative">
                      <Input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="pr-10 h-11 rounded-xl"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">New Password</Label>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        className="pr-10 h-11 rounded-xl"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {/* Password strength indicator */}
                    {newPassword.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-1.5"
                      >
                        <Progress value={pwStrength.score} className={`h-1.5 ${pwStrength.color}`} />
                        <p className={`text-xs font-medium ${
                          pwStrength.score <= 20 ? 'text-red-500' :
                          pwStrength.score <= 40 ? 'text-orange-500' :
                          pwStrength.score <= 60 ? 'text-amber-500' :
                          'text-emerald-500'
                        }`}>
                          Password strength: {pwStrength.label}
                        </p>
                      </motion.div>
                    )}
                    {newPassword.length > 0 && newPassword.length < 6 && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Password must be at least 6 characters
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Confirm New Password</Label>
                    <Input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className={`h-11 rounded-xl ${
                        confirmNewPassword.length > 0 && newPassword !== confirmNewPassword ? 'border-red-400 ring-2 ring-red-100' :
                        confirmNewPassword.length > 0 && newPassword === confirmNewPassword ? 'border-emerald-300 ring-2 ring-emerald-50' : ''
                      }`}
                    />
                    {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Passwords do not match
                      </p>
                    )}
                    {confirmNewPassword.length > 0 && newPassword === confirmNewPassword && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Passwords match
                      </p>
                    )}
                  </div>
                  <Button onClick={handleChangePassword} disabled={saving} className="rounded-xl w-full sm:w-auto">
                    {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                    Change Password
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Notification Preferences */}
            <motion.div {...fadeInUp} transition={{ delay: 0.1 }}>
              <Card className="rounded-2xl shadow-sm border-0 ring-1 ring-gray-100">
                <CardHeader className="bg-gradient-to-r from-sky-50 to-transparent rounded-t-2xl">
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-sky-100 flex items-center justify-center">
                      <Bell className="h-4 w-4 text-sky-600" />
                    </div>
                    Notification Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 p-6">
                  <div className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Email Notifications</p>
                        <p className="text-xs text-muted-foreground">Order updates, shipping & delivery alerts</p>
                      </div>
                    </div>
                    <Switch
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-sky-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">SMS Notifications</p>
                        <p className="text-xs text-muted-foreground">Order confirmations & important updates via SMS</p>
                      </div>
                    </div>
                    <Switch
                      checked={smsNotifications}
                      onCheckedChange={setSmsNotifications}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                        <Star className="h-5 w-5 text-secondary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Promotional Offers</p>
                        <p className="text-xs text-muted-foreground">Sales, deals, and special discounts</p>
                      </div>
                    </div>
                    <Switch
                      checked={promoNotifications}
                      onCheckedChange={setPromoNotifications}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Preferences */}
            <motion.div {...fadeInUp} transition={{ delay: 0.2 }}>
              <Card className="rounded-2xl shadow-sm border-0 ring-1 ring-gray-100">
                <CardHeader className="bg-gradient-to-r from-emerald-50 to-transparent rounded-t-2xl">
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Globe className="h-4 w-4 text-emerald-600" />
                    </div>
                    Account Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-1">
                    <motion.div
                      whileHover={{ x: 4 }}
                      className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate('orders')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Payment Methods</p>
                          <p className="text-xs text-muted-foreground">Manage saved payment methods</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </motion.div>
                    <motion.div
                      whileHover={{ x: 4 }}
                      className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate('privacy')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                          <Shield className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Privacy & Data</p>
                          <p className="text-xs text-muted-foreground">Manage your data and privacy settings</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </motion.div>
                    <motion.div
                      whileHover={{ x: 4 }}
                      className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate('contact')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                          <HelpCircle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Help & Support</p>
                          <p className="text-xs text-muted-foreground">FAQs and contact support</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Account Actions */}
            <motion.div {...fadeInUp} transition={{ delay: 0.3 }}>
              <Card className="rounded-2xl shadow-sm border-0 ring-1 ring-gray-100">
                <CardHeader className="bg-gradient-to-r from-red-50 to-transparent rounded-t-2xl">
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                      <Settings className="h-4 w-4 text-red-500" />
                    </div>
                    Account Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-6">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 rounded-xl h-11"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Logout from Account
                  </Button>
                  <Separator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl h-11"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          Delete Account
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete your account and remove all your data including orders, addresses, and wishlist items from our servers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="rounded-lg bg-red-600 hover:bg-red-700 text-white"
                          onClick={handleDeleteAccount}
                        >
                          Delete Account
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
