'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { authFetch } from '@/lib/api'
import {
  Settings,
  Save,
  Upload,
  Bell,
  Shield,
  Key,
  Database,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Plus,
  Download,
  RefreshCw,
  LayoutDashboard,
} from 'lucide-react'

interface SiteConfig {
  siteName: string
  tagline: string
  description: string
  logo: string
  favicon: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  currency: string
  currencySymbol: string
  phone: string
  email: string
  address: string
  socialLinks: {
    facebook?: string
    instagram?: string
    twitter?: string
    youtube?: string
  }
  freeShippingThreshold: number
  shippingCharge: number
  taxRate: number
  enableCod: boolean
  enableOnlinePayment: boolean
  minOrderAmount: number
  returnWindowDays: number
  deliveryZones: string[]
  maintenanceMode: boolean
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string
  googleAnalytics?: string
  footerText?: string
  whatsapp?: string
  // Notification settings
  emailNotifications?: boolean
  smsNotifications?: boolean
  orderUpdateEmail?: boolean
  orderUpdateSms?: boolean
  promoEmail?: boolean
  promoSms?: boolean
  restockEmail?: boolean
  systemAlertEmail?: boolean
  // Security
  twoFactorEnabled?: boolean
  sessionTimeout?: number
  // API Keys
  sslcommerzStoreId?: string
  sslcommerzPassword?: string
  googleMapsApiKey?: string
  firebaseApiKey?: string
  // Backup
  lastBackupDate?: string
  autoBackup?: boolean
  backupFrequency?: string
  // ── Homepage business settings (Round 3E) ──
  announcementEnabled?: boolean
  announcementText?: string
  freeDeliveryEnabled?: boolean
  freeDeliveryMinAmount?: number
  freeDeliveryMessage?: string
  flashSaleEnabled?: boolean
  flashSaleTitle?: string
  flashSaleSubtitle?: string
  homepagePromoText?: string
}

interface ApiKeyEntry {
  id: string
  name: string
  key: string
  createdAt: string
  lastUsed?: string
}

const defaultConfig: SiteConfig = {
  siteName: 'Khati Khadyo',
  tagline: 'Authentic Bangladeshi Food Products',
  description: '',
  logo: '',
  favicon: '',
  primaryColor: '#2D6A4F',
  secondaryColor: '#B8860B',
  accentColor: '#D4A574',
  currency: 'BDT',
  currencySymbol: '৳',
  phone: '',
  email: '',
  address: '',
  socialLinks: { facebook: '', instagram: '', twitter: '', youtube: '' },
  freeShippingThreshold: 1500,
  shippingCharge: 60,
  taxRate: 0,
  enableCod: true,
  enableOnlinePayment: false,
  minOrderAmount: 0,
  returnWindowDays: 7,
  deliveryZones: [],
  maintenanceMode: false,
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  googleAnalytics: '',
  footerText: '',
  whatsapp: '',
  emailNotifications: true,
  smsNotifications: false,
  orderUpdateEmail: true,
  orderUpdateSms: false,
  promoEmail: true,
  promoSms: false,
  restockEmail: true,
  systemAlertEmail: true,
  twoFactorEnabled: false,
  sessionTimeout: 30,
  sslcommerzStoreId: '',
  sslcommerzPassword: '',
  googleMapsApiKey: '',
  firebaseApiKey: '',
  lastBackupDate: '',
  autoBackup: false,
  backupFrequency: 'weekly',
  // ── Homepage business settings (Round 3E) ──
  announcementEnabled: true,
  announcementText: 'Selected items at special prices',
  freeDeliveryEnabled: true,
  freeDeliveryMinAmount: 1500,
  freeDeliveryMessage: 'Free Delivery on Orders Above ৳1,500',
  flashSaleEnabled: true,
  flashSaleTitle: 'Flash Sale',
  flashSaleSubtitle: 'Today',
  homepagePromoText: '100% Authentic Bangladeshi Products',
}

interface FormErrors {
  [key: string]: string
}

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<SiteConfig>(defaultConfig)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general')
  const [errors, setErrors] = useState<FormErrors>({})
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([
    { id: '1', name: 'Production API Key', key: 'kk_prod_a1b2c3d4e5f6', createdAt: '2024-01-15', lastUsed: '2024-12-01' },
    { id: '2', name: 'Staging API Key', key: 'kk_stg_x9y8z7w6v5u4', createdAt: '2024-03-20', lastUsed: '2024-11-28' },
  ])
  const [showPassword, setShowPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<FormErrors>({})
  const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({})

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/site-config')
      if (res.ok) {
        const data = await res.json()
        const configItems = data.data || data || []
        const mapped: Record<string, string> = {}
        if (Array.isArray(configItems)) {
          configItems.forEach((item: { key: string; value: string; type: string }) => {
            mapped[item.key] = item.value
          })
        }
        setConfig({
          ...defaultConfig,
          siteName: mapped.siteName || defaultConfig.siteName,
          tagline: mapped.tagline || defaultConfig.tagline,
          description: mapped.description || defaultConfig.description,
          logo: mapped.logo || defaultConfig.logo,
          favicon: mapped.favicon || defaultConfig.favicon,
          primaryColor: mapped.primaryColor || defaultConfig.primaryColor,
          secondaryColor: mapped.secondaryColor || defaultConfig.secondaryColor,
          accentColor: mapped.accentColor || defaultConfig.accentColor,
          currency: mapped.currency || defaultConfig.currency,
          currencySymbol: mapped.currencySymbol || defaultConfig.currencySymbol,
          phone: mapped.phone || defaultConfig.phone,
          email: mapped.email || defaultConfig.email,
          address: mapped.address || defaultConfig.address,
          whatsapp: mapped.whatsapp || defaultConfig.whatsapp,
          freeShippingThreshold: Number(mapped.freeShippingThreshold) || defaultConfig.freeShippingThreshold,
          shippingCharge: Number(mapped.shippingCharge) || defaultConfig.shippingCharge,
          taxRate: Number(mapped.taxRate) || defaultConfig.taxRate,
          enableCod: mapped.enableCod === 'true' || defaultConfig.enableCod,
          enableOnlinePayment: mapped.enableOnlinePayment === 'true' || defaultConfig.enableOnlinePayment,
          minOrderAmount: Number(mapped.minOrderAmount) || defaultConfig.minOrderAmount,
          returnWindowDays: Number(mapped.returnWindowDays) || defaultConfig.returnWindowDays,
          maintenanceMode: mapped.maintenanceMode === 'true' || defaultConfig.maintenanceMode,
          metaTitle: mapped.metaTitle || defaultConfig.metaTitle,
          metaDescription: mapped.metaDescription || defaultConfig.metaDescription,
          metaKeywords: mapped.metaKeywords || defaultConfig.metaKeywords,
          googleAnalytics: mapped.googleAnalytics || defaultConfig.googleAnalytics,
          footerText: mapped.footerText || defaultConfig.footerText,
          socialLinks: {
            facebook: mapped['socialLinks.facebook'] || '',
            instagram: mapped['socialLinks.instagram'] || '',
            twitter: mapped['socialLinks.twitter'] || '',
            youtube: mapped['socialLinks.youtube'] || '',
          },
          emailNotifications: mapped.emailNotifications === undefined ? defaultConfig.emailNotifications : mapped.emailNotifications === 'true',
          smsNotifications: mapped.smsNotifications === undefined ? defaultConfig.smsNotifications : mapped.smsNotifications === 'true',
          orderUpdateEmail: mapped.orderUpdateEmail === undefined ? defaultConfig.orderUpdateEmail : mapped.orderUpdateEmail === 'true',
          orderUpdateSms: mapped.orderUpdateSms === undefined ? defaultConfig.orderUpdateSms : mapped.orderUpdateSms === 'true',
          promoEmail: mapped.promoEmail === undefined ? defaultConfig.promoEmail : mapped.promoEmail === 'true',
          promoSms: mapped.promoSms === undefined ? defaultConfig.promoSms : mapped.promoSms === 'true',
          restockEmail: mapped.restockEmail === undefined ? defaultConfig.restockEmail : mapped.restockEmail === 'true',
          systemAlertEmail: mapped.systemAlertEmail === undefined ? defaultConfig.systemAlertEmail : mapped.systemAlertEmail === 'true',
          twoFactorEnabled: mapped.twoFactorEnabled === undefined ? defaultConfig.twoFactorEnabled : mapped.twoFactorEnabled === 'true',
          sessionTimeout: Number(mapped.sessionTimeout) || defaultConfig.sessionTimeout,
          sslcommerzStoreId: mapped.sslcommerzStoreId || defaultConfig.sslcommerzStoreId,
          sslcommerzPassword: mapped.sslcommerzPassword || defaultConfig.sslcommerzPassword,
          googleMapsApiKey: mapped.googleMapsApiKey || defaultConfig.googleMapsApiKey,
          firebaseApiKey: mapped.firebaseApiKey || defaultConfig.firebaseApiKey,
          autoBackup: mapped.autoBackup === undefined ? defaultConfig.autoBackup : mapped.autoBackup === 'true',
          backupFrequency: mapped.backupFrequency || defaultConfig.backupFrequency,
          lastBackupDate: mapped.lastBackupDate || defaultConfig.lastBackupDate,
          // ── Homepage business settings (Round 3E) ──
          announcementEnabled: mapped.announcement_enabled === undefined ? defaultConfig.announcementEnabled : mapped.announcement_enabled === 'true',
          announcementText: mapped.announcement_text || defaultConfig.announcementText,
          freeDeliveryEnabled: mapped.free_delivery_enabled === undefined ? defaultConfig.freeDeliveryEnabled : mapped.free_delivery_enabled === 'true',
          freeDeliveryMinAmount: Number(mapped.free_delivery_min_amount) || defaultConfig.freeDeliveryMinAmount,
          freeDeliveryMessage: mapped.free_delivery_message || defaultConfig.freeDeliveryMessage,
          flashSaleEnabled: mapped.flash_sale_enabled === undefined ? defaultConfig.flashSaleEnabled : mapped.flash_sale_enabled === 'true',
          flashSaleTitle: mapped.flash_sale_title || defaultConfig.flashSaleTitle,
          flashSaleSubtitle: mapped.flash_sale_subtitle || defaultConfig.flashSaleSubtitle,
          homepagePromoText: mapped.homepage_promo_text || defaultConfig.homepagePromoText,
        })
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  function validateConfig(): boolean {
    const newErrors: FormErrors = {}
    if (!config.siteName.trim()) newErrors.siteName = 'Site name is required'
    if (!config.email.trim()) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email)) newErrors.email = 'Invalid email format'
    if (config.shippingCharge < 0) newErrors.shippingCharge = 'Shipping charge cannot be negative'
    if (config.freeShippingThreshold < 0) newErrors.freeShippingThreshold = 'Free shipping threshold cannot be negative'
    if (config.taxRate < 0 || config.taxRate > 100) newErrors.taxRate = 'Tax rate must be between 0-100'
    if ((config.sessionTimeout ?? 0) < 5) newErrors.sessionTimeout = 'Session timeout must be at least 5 minutes'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSave() {
    if (!validateConfig()) {
      toast.error('Please fix the validation errors before saving')
      return
    }
    setSaving(true)
    try {
      // Save each config key as individual upsert
      const entries: Array<{ key: string; value: string; type: string; group: string; label?: string }> = [
        { key: 'siteName', value: config.siteName, type: 'text', group: 'general', label: 'Site Name' },
        { key: 'tagline', value: config.tagline, type: 'text', group: 'general', label: 'Tagline' },
        { key: 'description', value: config.description, type: 'text', group: 'general', label: 'Description' },
        { key: 'logo', value: config.logo, type: 'image', group: 'general', label: 'Logo' },
        { key: 'favicon', value: config.favicon, type: 'image', group: 'general', label: 'Favicon' },
        { key: 'footerText', value: config.footerText || '', type: 'text', group: 'general', label: 'Footer Text' },
        { key: 'maintenanceMode', value: String(config.maintenanceMode), type: 'boolean', group: 'general', label: 'Maintenance Mode' },
        { key: 'phone', value: config.phone, type: 'text', group: 'contact', label: 'Phone' },
        { key: 'email', value: config.email, type: 'text', group: 'contact', label: 'Email' },
        { key: 'address', value: config.address, type: 'text', group: 'contact', label: 'Address' },
        { key: 'whatsapp', value: config.whatsapp || '', type: 'text', group: 'contact', label: 'WhatsApp' },
        { key: 'socialLinks.facebook', value: config.socialLinks.facebook || '', type: 'text', group: 'social', label: 'Facebook' },
        { key: 'socialLinks.instagram', value: config.socialLinks.instagram || '', type: 'text', group: 'social', label: 'Instagram' },
        { key: 'socialLinks.twitter', value: config.socialLinks.twitter || '', type: 'text', group: 'social', label: 'Twitter' },
        { key: 'socialLinks.youtube', value: config.socialLinks.youtube || '', type: 'text', group: 'social', label: 'YouTube' },
        { key: 'metaTitle', value: config.metaTitle || '', type: 'text', group: 'seo', label: 'Meta Title' },
        { key: 'metaDescription', value: config.metaDescription || '', type: 'text', group: 'seo', label: 'Meta Description' },
        { key: 'metaKeywords', value: config.metaKeywords || '', type: 'text', group: 'seo', label: 'Meta Keywords' },
        { key: 'googleAnalytics', value: config.googleAnalytics || '', type: 'text', group: 'seo', label: 'Google Analytics' },
        { key: 'enableCod', value: String(config.enableCod), type: 'boolean', group: 'payment', label: 'COD' },
        { key: 'enableOnlinePayment', value: String(config.enableOnlinePayment), type: 'boolean', group: 'payment', label: 'Online Payment' },
        { key: 'shippingCharge', value: String(config.shippingCharge), type: 'number', group: 'payment', label: 'Shipping Charge' },
        { key: 'freeShippingThreshold', value: String(config.freeShippingThreshold), type: 'number', group: 'payment', label: 'Free Shipping Threshold' },
        { key: 'minOrderAmount', value: String(config.minOrderAmount), type: 'number', group: 'payment', label: 'Min Order Amount' },
        { key: 'returnWindowDays', value: String(config.returnWindowDays), type: 'number', group: 'payment', label: 'Return Window' },
        { key: 'taxRate', value: String(config.taxRate), type: 'number', group: 'payment', label: 'Tax Rate' },
        { key: 'primaryColor', value: config.primaryColor, type: 'text', group: 'appearance', label: 'Primary Color' },
        { key: 'secondaryColor', value: config.secondaryColor, type: 'text', group: 'appearance', label: 'Secondary Color' },
        { key: 'accentColor', value: config.accentColor, type: 'text', group: 'appearance', label: 'Accent Color' },
        { key: 'currency', value: config.currency, type: 'text', group: 'general', label: 'Currency' },
        { key: 'currencySymbol', value: config.currencySymbol, type: 'text', group: 'general', label: 'Currency Symbol' },
        // Notification settings
        { key: 'emailNotifications', value: String(config.emailNotifications ?? true), type: 'boolean', group: 'notifications', label: 'Email Notifications' },
        { key: 'smsNotifications', value: String(config.smsNotifications ?? false), type: 'boolean', group: 'notifications', label: 'SMS Notifications' },
        { key: 'orderUpdateEmail', value: String(config.orderUpdateEmail ?? true), type: 'boolean', group: 'notifications', label: 'Order Update Email' },
        { key: 'orderUpdateSms', value: String(config.orderUpdateSms ?? false), type: 'boolean', group: 'notifications', label: 'Order Update SMS' },
        { key: 'promoEmail', value: String(config.promoEmail ?? true), type: 'boolean', group: 'notifications', label: 'Promo Email' },
        { key: 'promoSms', value: String(config.promoSms ?? false), type: 'boolean', group: 'notifications', label: 'Promo SMS' },
        { key: 'restockEmail', value: String(config.restockEmail ?? true), type: 'boolean', group: 'notifications', label: 'Restock Email' },
        { key: 'systemAlertEmail', value: String(config.systemAlertEmail ?? true), type: 'boolean', group: 'notifications', label: 'System Alert Email' },
        // Security
        { key: 'twoFactorEnabled', value: String(config.twoFactorEnabled ?? false), type: 'boolean', group: 'security', label: '2FA Enabled' },
        { key: 'sessionTimeout', value: String(config.sessionTimeout ?? 30), type: 'number', group: 'security', label: 'Session Timeout' },
        // API Keys
        { key: 'sslcommerzStoreId', value: config.sslcommerzStoreId || '', type: 'text', group: 'api', label: 'SSLCommerz Store ID' },
        { key: 'sslcommerzPassword', value: config.sslcommerzPassword || '', type: 'text', group: 'api', label: 'SSLCommerz Password' },
        { key: 'googleMapsApiKey', value: config.googleMapsApiKey || '', type: 'text', group: 'api', label: 'Google Maps API Key' },
        { key: 'firebaseApiKey', value: config.firebaseApiKey || '', type: 'text', group: 'api', label: 'Firebase API Key' },
        // Backup
        { key: 'autoBackup', value: String(config.autoBackup ?? false), type: 'boolean', group: 'general', label: 'Auto Backup' },
        { key: 'backupFrequency', value: config.backupFrequency || 'weekly', type: 'text', group: 'general', label: 'Backup Frequency' },
        // ── Homepage business settings (Round 3E) ──
        { key: 'announcement_enabled', value: String(config.announcementEnabled ?? true), type: 'boolean', group: 'homepage', label: 'Announcement Bar Enabled' },
        { key: 'announcement_text', value: config.announcementText || '', type: 'text', group: 'homepage', label: 'Announcement Text' },
        { key: 'free_delivery_enabled', value: String(config.freeDeliveryEnabled ?? true), type: 'boolean', group: 'homepage', label: 'Free Delivery Enabled' },
        { key: 'free_delivery_min_amount', value: String(config.freeDeliveryMinAmount ?? 1500), type: 'number', group: 'homepage', label: 'Free Delivery Min Amount' },
        { key: 'free_delivery_message', value: config.freeDeliveryMessage || '', type: 'text', group: 'homepage', label: 'Free Delivery Message' },
        { key: 'flash_sale_enabled', value: String(config.flashSaleEnabled ?? true), type: 'boolean', group: 'homepage', label: 'Flash Sale Enabled' },
        { key: 'flash_sale_title', value: config.flashSaleTitle || '', type: 'text', group: 'homepage', label: 'Flash Sale Title' },
        { key: 'flash_sale_subtitle', value: config.flashSaleSubtitle || '', type: 'text', group: 'homepage', label: 'Flash Sale Subtitle' },
        { key: 'homepage_promo_text', value: config.homepagePromoText || '', type: 'text', group: 'homepage', label: 'Homepage Promo Text' },
      ]

      await Promise.all(
        entries.map((entry) =>
          authFetch('/api/site-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry),
          })
        )
      )
      toast.success('Settings saved successfully!')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  function updateConfig(partial: Partial<SiteConfig>) {
    setConfig((prev) => ({ ...prev, ...partial }))
    // Clear errors for updated fields
    setErrors((prev) => {
      const next = { ...prev }
      Object.keys(partial).forEach((key) => delete next[key])
      return next
    })
  }

  function updateSocialLinks(partial: Record<string, string>) {
    setConfig((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, ...partial } }))
  }

  async function handleImageUpload(field: 'logo' | 'favicon') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const formData = new FormData()
      formData.append('files', file)
      try {
        const res = await authFetch('/api/uploads', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('Upload failed')
        const data = await res.json()
        const files = data.files ?? data ?? []
        if (files.length > 0) {
          updateConfig({ [field]: files[0].url })
          toast.success(`${field === 'logo' ? 'Logo' : 'Favicon'} uploaded successfully`)
        }
      } catch {
        toast.error('Image upload failed')
      }
    }
    input.click()
  }

  function handlePasswordChange() {
    const errs: FormErrors = {}
    if (!currentPassword) errs.currentPassword = 'Current password is required'
    if (!newPassword) errs.newPassword = 'New password is required'
    else if (newPassword.length < 8) errs.newPassword = 'Password must be at least 8 characters'
    if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match'
    setPasswordErrors(errs)
    if (Object.keys(errs).length > 0) return

    // Simulate password change
    toast.success('Password changed successfully!')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  function generateApiKey() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let key = 'kk_'
    for (let i = 0; i < 20; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const newKey: ApiKeyEntry = {
      id: String(Date.now()),
      name: `API Key ${apiKeys.length + 1}`,
      key,
      createdAt: new Date().toISOString().split('T')[0],
    }
    setApiKeys((prev) => [...prev, newKey])
    toast.success('New API key generated')
  }

  function deleteApiKey(id: string) {
    setApiKeys((prev) => prev.filter((k) => k.id !== id))
    toast.success('API key deleted')
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  async function handleBackup() {
    setTabLoading((prev) => ({ ...prev, backup: true }))
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      updateConfig({ lastBackupDate: new Date().toISOString() })
      toast.success('Backup completed successfully!')
    } catch {
      toast.error('Backup failed')
    } finally {
      setTabLoading((prev) => ({ ...prev, backup: false }))
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Settings className="size-5" /> Site Settings
        </h2>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="size-4" /> {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="general" className="gap-1.5"><Settings className="size-3.5" /> General</TabsTrigger>
          <TabsTrigger value="contact" className="gap-1.5"><Bell className="size-3.5" /> Contact</TabsTrigger>
          <TabsTrigger value="social" className="gap-1.5">Social</TabsTrigger>
          <TabsTrigger value="seo" className="gap-1.5">SEO</TabsTrigger>
          <TabsTrigger value="payment" className="gap-1.5">Payment</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="size-3.5" /> Notifications</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><Shield className="size-3.5" /> Security</TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-1.5"><Key className="size-3.5" /> API Keys</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5">Appearance</TabsTrigger>
          <TabsTrigger value="homepage" className="gap-1.5"><LayoutDashboard className="size-3.5" /> Homepage</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>General Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Site Name *</Label>
                  <Input value={config.siteName} onChange={(e) => updateConfig({ siteName: e.target.value })} className={errors.siteName ? 'border-destructive' : ''} />
                  {errors.siteName && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="size-3" />{errors.siteName}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input value={config.tagline} onChange={(e) => updateConfig({ tagline: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={config.description} onChange={(e) => updateConfig({ description: e.target.value })} rows={3} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex gap-2">
                    <Input value={config.logo} onChange={(e) => updateConfig({ logo: e.target.value })} placeholder="URL or upload" />
                    <Button type="button" variant="outline" size="icon" onClick={() => handleImageUpload('logo')}><Upload className="size-4" /></Button>
                  </div>
                  {config.logo && <img src={config.logo} alt="Logo" className="h-12 object-contain mt-1" />}
                </div>
                <div className="space-y-2">
                  <Label>Favicon</Label>
                  <div className="flex gap-2">
                    <Input value={config.favicon} onChange={(e) => updateConfig({ favicon: e.target.value })} placeholder="URL or upload" />
                    <Button type="button" variant="outline" size="icon" onClick={() => handleImageUpload('favicon')}><Upload className="size-4" /></Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Footer Text</Label>
                <Input value={config.footerText ?? ''} onChange={(e) => updateConfig({ footerText: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={config.maintenanceMode} onCheckedChange={(c) => updateConfig({ maintenanceMode: c })} />
                <Label>Maintenance Mode</Label>
                {config.maintenanceMode && <Badge variant="destructive" className="text-xs">Site is in maintenance mode</Badge>}
              </div>
            </CardContent>
          </Card>

          {/* Backup Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="size-5 text-primary" />
                <CardTitle>Backup & Recovery</CardTitle>
              </div>
              <CardDescription>Manage database backups and recovery options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <span className="text-sm font-medium">Last Backup</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {config.lastBackupDate
                      ? new Date(config.lastBackupDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'Never'}
                  </p>
                </div>
                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <RefreshCw className="size-4 text-primary" />
                    <span className="text-sm font-medium">Auto Backup</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={config.autoBackup ?? false} onCheckedChange={(c) => updateConfig({ autoBackup: c })} />
                    <span className="text-sm text-muted-foreground">{config.autoBackup ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>
              {config.autoBackup && (
                <div className="space-y-2">
                  <Label>Backup Frequency</Label>
                  <div className="flex gap-2">
                    {['daily', 'weekly', 'monthly'].map((freq) => (
                      <Button
                        key={freq}
                        variant={config.backupFrequency === freq ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateConfig({ backupFrequency: freq })}
                      >
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleBackup} disabled={tabLoading.backup} className="gap-2">
                  {tabLoading.backup ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {tabLoading.backup ? 'Backing up...' : 'Create Backup Now'}
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => toast.info('Restore feature coming soon')}>
                  <RefreshCw className="size-4" /> Restore from Backup
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input value={config.email} onChange={(e) => updateConfig({ email: e.target.value })} placeholder="info@..." className={errors.email ? 'border-destructive' : ''} />
                  {errors.email && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="size-3" />{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={config.phone} onChange={(e) => updateConfig({ phone: e.target.value })} placeholder="+880..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea value={config.address} onChange={(e) => updateConfig({ address: e.target.value })} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={config.whatsapp ?? ''} onChange={(e) => updateConfig({ whatsapp: e.target.value })} placeholder="+880..." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Tab */}
        <TabsContent value="social" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Social Media Links</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Facebook</Label>
                <Input value={config.socialLinks.facebook ?? ''} onChange={(e) => updateSocialLinks({ facebook: e.target.value })} placeholder="https://facebook.com/..." />
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input value={config.socialLinks.instagram ?? ''} onChange={(e) => updateSocialLinks({ instagram: e.target.value })} placeholder="https://instagram.com/..." />
              </div>
              <div className="space-y-2">
                <Label>YouTube</Label>
                <Input value={config.socialLinks.youtube ?? ''} onChange={(e) => updateSocialLinks({ youtube: e.target.value })} placeholder="https://youtube.com/..." />
              </div>
              <div className="space-y-2">
                <Label>Twitter / X</Label>
                <Input value={config.socialLinks.twitter ?? ''} onChange={(e) => updateSocialLinks({ twitter: e.target.value })} placeholder="https://twitter.com/..." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEO Tab */}
        <TabsContent value="seo" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>SEO Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Meta Title</Label>
                <Input value={config.metaTitle ?? ''} onChange={(e) => updateConfig({ metaTitle: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Default Meta Description</Label>
                <Textarea value={config.metaDescription ?? ''} onChange={(e) => updateConfig({ metaDescription: e.target.value })} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Default Meta Keywords</Label>
                <Input value={config.metaKeywords ?? ''} onChange={(e) => updateConfig({ metaKeywords: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Google Analytics ID</Label>
                <Input value={config.googleAnalytics ?? ''} onChange={(e) => updateConfig({ googleAnalytics: e.target.value })} placeholder="G-XXXXXXXXXX" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Payment & Delivery Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Switch checked={config.enableCod} onCheckedChange={(c) => updateConfig({ enableCod: c })} />
                  <Label>Cash on Delivery (COD)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={config.enableOnlinePayment} onCheckedChange={(c) => updateConfig({ enableOnlinePayment: c })} />
                  <Label>Online Payment</Label>
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Delivery Charge (৳)</Label>
                  <Input type="number" value={config.shippingCharge} onChange={(e) => updateConfig({ shippingCharge: Number(e.target.value) })} className={errors.shippingCharge ? 'border-destructive' : ''} />
                  {errors.shippingCharge && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="size-3" />{errors.shippingCharge}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Free Shipping Above (৳)</Label>
                  <Input type="number" value={config.freeShippingThreshold} onChange={(e) => updateConfig({ freeShippingThreshold: Number(e.target.value) })} className={errors.freeShippingThreshold ? 'border-destructive' : ''} />
                  {errors.freeShippingThreshold && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="size-3" />{errors.freeShippingThreshold}</p>}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Min Order Amount (৳)</Label>
                  <Input type="number" value={config.minOrderAmount} onChange={(e) => updateConfig({ minOrderAmount: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Return Window (Days)</Label>
                  <Input type="number" value={config.returnWindowDays} onChange={(e) => updateConfig({ returnWindowDays: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tax Rate (%)</Label>
                <Input type="number" value={config.taxRate} onChange={(e) => updateConfig({ taxRate: Number(e.target.value) })} className={errors.taxRate ? 'border-destructive' : ''} />
                {errors.taxRate && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="size-3" />{errors.taxRate}</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="size-5 text-primary" />
                <CardTitle>Notification Settings</CardTitle>
              </div>
              <CardDescription>Configure how and when notifications are sent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Notifications */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Email Notifications
                </h3>
                <div className="space-y-3 pl-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Enable Email Notifications</Label>
                      <p className="text-xs text-muted-foreground">Master switch for all email notifications</p>
                    </div>
                    <Switch checked={config.emailNotifications ?? true} onCheckedChange={(c) => updateConfig({ emailNotifications: c })} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Order Updates</Label>
                      <p className="text-xs text-muted-foreground">Send email when order status changes</p>
                    </div>
                    <Switch checked={config.orderUpdateEmail ?? true} onCheckedChange={(c) => updateConfig({ orderUpdateEmail: c })} disabled={!config.emailNotifications} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Promotional Emails</Label>
                      <p className="text-xs text-muted-foreground">Send offers, discounts, and sale notifications</p>
                    </div>
                    <Switch checked={config.promoEmail ?? true} onCheckedChange={(c) => updateConfig({ promoEmail: c })} disabled={!config.emailNotifications} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Restock Alerts</Label>
                      <p className="text-xs text-muted-foreground">Notify customers when out-of-stock items are available</p>
                    </div>
                    <Switch checked={config.restockEmail ?? true} onCheckedChange={(c) => updateConfig({ restockEmail: c })} disabled={!config.emailNotifications} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">System Alerts</Label>
                      <p className="text-xs text-muted-foreground">Critical system notifications for admins</p>
                    </div>
                    <Switch checked={config.systemAlertEmail ?? true} onCheckedChange={(c) => updateConfig({ systemAlertEmail: c })} disabled={!config.emailNotifications} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* SMS Notifications */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-amber-500" />
                  SMS Notifications
                </h3>
                <div className="space-y-3 pl-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Enable SMS Notifications</Label>
                      <p className="text-xs text-muted-foreground">Master switch for all SMS notifications</p>
                    </div>
                    <Switch checked={config.smsNotifications ?? false} onCheckedChange={(c) => updateConfig({ smsNotifications: c })} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Order Updates</Label>
                      <p className="text-xs text-muted-foreground">Send SMS when order status changes</p>
                    </div>
                    <Switch checked={config.orderUpdateSms ?? false} onCheckedChange={(c) => updateConfig({ orderUpdateSms: c })} disabled={!config.smsNotifications} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Promotional SMS</Label>
                      <p className="text-xs text-muted-foreground">Send offers and discounts via SMS</p>
                    </div>
                    <Switch checked={config.promoSms ?? false} onCheckedChange={(c) => updateConfig({ promoSms: c })} disabled={!config.smsNotifications} />
                  </div>
                </div>
              </div>

              {!config.emailNotifications && !config.smsNotifications && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  All notifications are disabled. Customers will not receive any updates.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="size-5 text-primary" />
                <CardTitle>Security Settings</CardTitle>
              </div>
              <CardDescription>Manage password and authentication settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Password Change */}
              <div>
                <h3 className="font-medium mb-3">Change Password</h3>
                <div className="space-y-3 max-w-md">
                  <div className="space-y-2">
                    <Label>Current Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => { setCurrentPassword(e.target.value); setPasswordErrors((p) => ({ ...p, currentPassword: '' })) }}
                        className={passwordErrors.currentPassword ? 'border-destructive pr-10' : 'pr-10'}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {passwordErrors.currentPassword && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="size-3" />{passwordErrors.currentPassword}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setPasswordErrors((p) => ({ ...p, newPassword: '' })) }}
                      className={passwordErrors.newPassword ? 'border-destructive' : ''}
                    />
                    {passwordErrors.newPassword && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="size-3" />{passwordErrors.newPassword}</p>}
                    {newPassword && (
                      <div className="flex gap-1 mt-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full ${
                              newPassword.length >= level * 3
                                ? level <= 1 ? 'bg-red-400' : level <= 2 ? 'bg-amber-400' : level <= 3 ? 'bg-emerald-400' : 'bg-emerald-600'
                                : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm New Password</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setPasswordErrors((p) => ({ ...p, confirmPassword: '' })) }}
                      className={passwordErrors.confirmPassword ? 'border-destructive' : ''}
                    />
                    {passwordErrors.confirmPassword && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="size-3" />{passwordErrors.confirmPassword}</p>}
                  </div>
                  <Button onClick={handlePasswordChange} className="gap-2">
                    <Shield className="size-4" /> Change Password
                  </Button>
                </div>
              </div>

              <Separator />

              {/* 2FA */}
              <div>
                <h3 className="font-medium mb-3">Two-Factor Authentication</h3>
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div>
                    <p className="font-medium">Enable 2FA</p>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your admin account</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {config.twoFactorEnabled && <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>}
                    <Switch checked={config.twoFactorEnabled ?? false} onCheckedChange={(c) => {
                      updateConfig({ twoFactorEnabled: c })
                      toast.success(c ? '2FA enabled' : '2FA disabled')
                    }} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Session */}
              <div>
                <h3 className="font-medium mb-3">Session Settings</h3>
                <div className="space-y-2 max-w-md">
                  <Label>Session Timeout (minutes)</Label>
                  <Input
                    type="number"
                    value={config.sessionTimeout ?? 30}
                    onChange={(e) => updateConfig({ sessionTimeout: Number(e.target.value) })}
                    className={errors.sessionTimeout ? 'border-destructive' : ''}
                  />
                  {errors.sessionTimeout && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="size-3" />{errors.sessionTimeout}</p>}
                  <p className="text-xs text-muted-foreground">Admin session will expire after this period of inactivity</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="size-5 text-primary" />
                  <div>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>Manage API integrations and keys</CardDescription>
                  </div>
                </div>
                <Button onClick={generateApiKey} size="sm" className="gap-2">
                  <Plus className="size-4" /> Generate New Key
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Integration Keys */}
              <div>
                <h3 className="font-medium mb-3">Payment Gateway (SSLCommerz)</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Store ID</Label>
                    <Input value={config.sslcommerzStoreId ?? ''} onChange={(e) => updateConfig({ sslcommerzStoreId: e.target.value })} placeholder="your_store_id" />
                  </div>
                  <div className="space-y-2">
                    <Label>Password / Secret Key</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={config.sslcommerzPassword ?? ''}
                        onChange={(e) => updateConfig({ sslcommerzPassword: e.target.value })}
                        placeholder="your_password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-3">Third-Party Services</h3>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Google Maps API Key</Label>
                    <Input value={config.googleMapsApiKey ?? ''} onChange={(e) => updateConfig({ googleMapsApiKey: e.target.value })} placeholder="AIza..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Firebase API Key</Label>
                    <Input value={config.firebaseApiKey ?? ''} onChange={(e) => updateConfig({ firebaseApiKey: e.target.value })} placeholder="AIza..." />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Custom API Keys */}
              <div>
                <h3 className="font-medium mb-3">Custom API Keys</h3>
                {apiKeys.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Key className="size-8 mx-auto mb-2 opacity-30" />
                    <p>No custom API keys yet</p>
                    <Button variant="outline" size="sm" className="mt-2 gap-2" onClick={generateApiKey}>
                      <Plus className="size-4" /> Generate Key
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.map((apiKey) => (
                      <div key={apiKey.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{apiKey.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{apiKey.key.slice(0, 12)}••••••••</code>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => copyToClipboard(apiKey.key)}
                              aria-label="Copy API key"
                            >
                              <Copy className="size-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Created: {apiKey.createdAt}
                            {apiKey.lastUsed && ` · Last used: ${apiKey.lastUsed}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive shrink-0"
                          onClick={() => deleteApiKey(apiKey.id)}
                          aria-label="Delete API key"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={config.primaryColor} onChange={(e) => updateConfig({ primaryColor: e.target.value })} className="w-12 p-1 h-10" />
                    <Input value={config.primaryColor} onChange={(e) => updateConfig({ primaryColor: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={config.secondaryColor} onChange={(e) => updateConfig({ secondaryColor: e.target.value })} className="w-12 p-1 h-10" />
                    <Input value={config.secondaryColor} onChange={(e) => updateConfig({ secondaryColor: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={config.accentColor} onChange={(e) => updateConfig({ accentColor: e.target.value })} className="w-12 p-1 h-10" />
                    <Input value={config.accentColor} onChange={(e) => updateConfig({ accentColor: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-md border" style={{ backgroundColor: config.primaryColor }} />
                  <span className="text-sm">Primary</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-md border" style={{ backgroundColor: config.secondaryColor }} />
                  <span className="text-sm">Secondary</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-md border" style={{ backgroundColor: config.accentColor }} />
                  <span className="text-sm">Accent</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Homepage Tab (Round 3E) */}
        <TabsContent value="homepage" className="space-y-4 mt-4">
          {/* Announcement Bar */}
          <Card>
            <CardHeader>
              <CardTitle>Announcement Bar</CardTitle>
              <CardDescription>Control the marquee announcement shown at the very top of the homepage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Announcement Bar</Label>
                  <p className="text-xs text-muted-foreground">Show or hide the top announcement marquee.</p>
                </div>
                <Switch
                  checked={config.announcementEnabled ?? true}
                  onCheckedChange={(v) => updateConfig({ announcementEnabled: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>Announcement Text</Label>
                <Input
                  value={config.announcementText ?? ''}
                  onChange={(e) => updateConfig({ announcementText: e.target.value })}
                  placeholder="Selected items at special prices"
                />
                <p className="text-xs text-muted-foreground">The primary message shown in the announcement marquee.</p>
              </div>
            </CardContent>
          </Card>

          {/* Free Delivery */}
          <Card>
            <CardHeader>
              <CardTitle>Free Delivery</CardTitle>
              <CardDescription>Control the free-delivery promotional message shown on the homepage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Free Delivery Message</Label>
                  <p className="text-xs text-muted-foreground">Show or hide the free-delivery announcement.</p>
                </div>
                <Switch
                  checked={config.freeDeliveryEnabled ?? true}
                  onCheckedChange={(v) => updateConfig({ freeDeliveryEnabled: v })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Minimum Order Amount</Label>
                  <Input
                    type="number"
                    min={0}
                    value={config.freeDeliveryMinAmount ?? 1500}
                    onChange={(e) => updateConfig({ freeDeliveryMinAmount: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">Orders at or above this amount qualify for free delivery.</p>
                </div>
                <div className="space-y-2">
                  <Label>Display Message</Label>
                  <Input
                    value={config.freeDeliveryMessage ?? ''}
                    onChange={(e) => updateConfig({ freeDeliveryMessage: e.target.value })}
                    placeholder="Free Delivery on Orders Above ৳1,500"
                  />
                  <p className="text-xs text-muted-foreground">The text shown to customers.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Flash Sale */}
          <Card>
            <CardHeader>
              <CardTitle>Flash Sale</CardTitle>
              <CardDescription>Control the Flash Sale section heading shown on the homepage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Flash Sale Section</Label>
                  <p className="text-xs text-muted-foreground">Show or hide the Flash Sale section.</p>
                </div>
                <Switch
                  checked={config.flashSaleEnabled ?? true}
                  onCheckedChange={(v) => updateConfig({ flashSaleEnabled: v })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Flash Sale Title</Label>
                  <Input
                    value={config.flashSaleTitle ?? ''}
                    onChange={(e) => updateConfig({ flashSaleTitle: e.target.value })}
                    placeholder="Flash Sale"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Flash Sale Subtitle (Badge)</Label>
                  <Input
                    value={config.flashSaleSubtitle ?? ''}
                    onChange={(e) => updateConfig({ flashSaleSubtitle: e.target.value })}
                    placeholder="Today"
                  />
                  <p className="text-xs text-muted-foreground">Short label shown next to the title (e.g. “Today”).</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Homepage Promo Text */}
          <Card>
            <CardHeader>
              <CardTitle>Homepage Promotional Text</CardTitle>
              <CardDescription>A short brand line shown in the announcement marquee.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Promotional Text</Label>
                <Input
                  value={config.homepagePromoText ?? ''}
                  onChange={(e) => updateConfig({ homepagePromoText: e.target.value })}
                  placeholder="100% Authentic Bangladeshi Products"
                />
                <p className="text-xs text-muted-foreground">Used as a secondary promotional line in the announcement marquee.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
