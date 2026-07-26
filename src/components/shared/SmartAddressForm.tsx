'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Phone, Mail, MapPin, Home as HomeIcon,
  Briefcase, Users, Store, Tag, Compass, FileText, ChevronDown,
  Search, Eye, Sparkles
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  BD_DIVISIONS,
  getDistrictsForDivision,
} from '@/lib/bangladesh-locations'
import { SmartAddressData } from '@/lib/bangladesh-address'

const ADDRESS_LABELS = [
  { id: 'Home', label: 'Home', icon: HomeIcon },
  { id: 'Office', label: 'Office', icon: Briefcase },
  { id: 'Family', label: 'Family', icon: Users },
  { id: 'Shop', label: 'Shop', icon: Store },
  { id: 'Other', label: 'Other', icon: Tag },
]

const DRAFT_KEY = 'khati_khadyo_address_draft'

interface SearchableSelectProps {
  label: string
  value: string
  onChange: (val: string) => void
  options: string[]
  placeholder: string
  error?: string
}

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="relative" ref={ref}>
      <Label className="text-xs font-medium mb-1 block text-foreground">{label}</Label>
      <div
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between h-10 px-3 border rounded-xl bg-background text-sm cursor-pointer transition-colors ${
          error ? 'border-red-500' : 'hover:border-primary/40'
        }`}
      >
        <span className={value ? 'text-foreground font-medium truncate' : 'text-muted-foreground'}>
          {value || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground ml-1 flex-shrink-0" />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-xl shadow-lg p-2 max-h-60 overflow-hidden flex flex-col">
          <div className="relative mb-1">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs rounded-lg"
            />
          </div>
          <div className="overflow-y-auto max-h-44 space-y-0.5 pr-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2 text-center">No matches found</p>
            ) : (
              filtered.map((item) => (
                <div
                  key={item}
                  onClick={() => {
                    onChange(item)
                    setOpen(false)
                    setSearch('')
                  }}
                  className={`px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                    value === item ? 'bg-primary text-white font-bold' : 'hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {item}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  )
}

interface SmartAddressFormProps {
  initialValues?: Partial<SmartAddressData>
  onSubmit: (data: SmartAddressData) => Promise<void> | void
  onCancel?: () => void
  isSubmitting?: boolean
  submitLabel?: string
  showDefaultCheckbox?: boolean
}

export default function SmartAddressForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Save Delivery Address',
  showDefaultCheckbox = true,
}: SmartAddressFormProps) {
  const [formData, setFormData] = useState<SmartAddressData>(() => {
    let base: SmartAddressData = {
      name: initialValues?.name || '',
      phone: initialValues?.phone || '',
      altPhone: initialValues?.altPhone || '',
      email: initialValues?.email || '',
      division: (initialValues?.division || 'Dhaka').replace(/\s*Division$/, '').trim(),
      district: initialValues?.district || 'Dhaka',
      upazila: initialValues?.upazila || '',
      postalCode: initialValues?.postalCode || '',
      unionOrArea: initialValues?.unionOrArea || '',
      addressDetail: initialValues?.addressDetail || '',
      landmark: initialValues?.landmark || '',
      deliveryNote: initialValues?.deliveryNote || '',
      label: initialValues?.label || 'Home',
      isDefault: initialValues?.isDefault ?? false,
    }

    if (typeof window !== 'undefined' && !initialValues?.name) {
      try {
        const savedDraft = localStorage.getItem(DRAFT_KEY)
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft)
          if (parsed && typeof parsed === 'object') {
            base = { ...base, ...parsed }
          }
        }
      } catch {}
    }
    return base
  })

  const [showPreview, setShowPreview] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Derived districts options
  const districts = getDistrictsForDivision(formData.division)

  // Auto-save draft in localStorage for unfinished address entries
  useEffect(() => {
    if (!initialValues?.name && (formData.name || formData.phone || formData.addressDetail)) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(formData))
      } catch {}
    }
  }, [formData, initialValues])

  const handleDivisionChange = (division: string) => {
    const list = getDistrictsForDivision(division)
    const newDistrict = list[0] || 'Dhaka'
    setFormData((prev) => ({
      ...prev,
      division,
      district: newDistrict,
    }))
  }

  const handleDistrictChange = (district: string) => {
    setFormData((prev) => ({
      ...prev,
      district,
    }))
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!formData.name.trim()) errs.name = 'Please enter your full name'
    if (!formData.phone.trim()) {
      errs.phone = 'Please enter your mobile number'
    } else if (!/^(?:01\d{9}|\+8801\d{9})$/.test(formData.phone.trim())) {
      errs.phone = 'Please enter a valid 11-digit mobile number'
    }
    if (formData.altPhone && !/^(?:01\d{9}|\+8801\d{9})$/.test(formData.altPhone.trim())) {
      errs.altPhone = 'Please enter a valid 11-digit mobile number'
    }
    if (!formData.division) errs.division = 'Please select your division'
    if (!formData.district) errs.district = 'Please select your district'
    if (!formData.upazila.trim()) errs.upazila = 'Please enter your Upazila or Thana'
    if (!formData.postalCode?.trim()) {
      errs.postalCode = 'Please enter your postal code'
    } else if (!/^\d{4}$/.test(formData.postalCode.trim())) {
      errs.postalCode = 'Please enter a valid 4-digit postal code (e.g. 1207)'
    }
    if (!formData.addressDetail.trim()) errs.addressDetail = 'Please enter your detailed address'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {}
    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-card border rounded-2xl p-5 shadow-sm">
      {/* Form Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Delivery Address</h3>
            <p className="text-xs text-muted-foreground">Simple address for quick delivery anywhere in Bangladesh</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          className="text-xs text-primary font-medium"
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </Button>
      </div>

      {/* Contact Details */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium mb-1 block">Full Name *</Label>
          <div className="relative">
            <User className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Enter your full name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`pl-9 h-10 text-sm rounded-xl ${errors.name ? 'border-red-500' : ''}`}
            />
          </div>
          {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name}</p>}
        </div>

        <div>
          <Label className="text-xs font-medium mb-1 block">Mobile Number *</Label>
          <div className="relative">
            <Phone className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="01XXXXXXXXX"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={`pl-9 h-10 text-sm rounded-xl ${errors.phone ? 'border-red-500' : ''}`}
            />
          </div>
          {errors.phone && <p className="text-[11px] text-red-500 mt-1">{errors.phone}</p>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium mb-1 block">Alternative Phone (Optional)</Label>
          <div className="relative">
            <Phone className="h-4 w-4 absolute left-3 top-3 text-muted-foreground/60" />
            <Input
              placeholder="01XXXXXXXXX"
              value={formData.altPhone || ''}
              onChange={(e) => setFormData({ ...formData, altPhone: e.target.value })}
              className="pl-9 h-10 text-sm rounded-xl"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Used if we cannot reach your primary number.</p>
          {errors.altPhone && <p className="text-[11px] text-red-500 mt-1">{errors.altPhone}</p>}
        </div>

        <div>
          <Label className="text-xs font-medium mb-1 block">Email (Optional)</Label>
          <div className="relative">
            <Mail className="h-4 w-4 absolute left-3 top-3 text-muted-foreground/60" />
            <Input
              type="email"
              placeholder="your@email.com"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="pl-9 h-10 text-sm rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Location Fields */}
      <div className="grid sm:grid-cols-2 gap-3 pt-1 border-t">
        {/* Division Dropdown */}
        <div>
          <Label className="text-xs font-medium mb-1 block">Division *</Label>
          <Select
            value={formData.division}
            onValueChange={handleDivisionChange}
          >
            <SelectTrigger className="h-10 text-sm rounded-xl">
              <SelectValue placeholder="Select Division" />
            </SelectTrigger>
            <SelectContent>
              {BD_DIVISIONS.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.division && <p className="text-[11px] text-red-500 mt-1">{errors.division}</p>}
        </div>

        {/* District Searchable Dropdown */}
        <SearchableSelect
          label="District *"
          value={formData.district}
          onChange={handleDistrictChange}
          options={districts}
          placeholder="Select District"
          error={errors.district}
        />

        {/* Upazila / Thana (Free Text Input) */}
        <div>
          <Label className="text-xs font-medium mb-1 block">Upazila / Thana *</Label>
          <Input
            placeholder="Enter your Upazila or Thana"
            value={formData.upazila}
            onChange={(e) => setFormData({ ...formData, upazila: e.target.value })}
            className={`h-10 text-sm rounded-xl ${errors.upazila ? 'border-red-500' : ''}`}
          />
          {errors.upazila && <p className="text-[11px] text-red-500 mt-1">{errors.upazila}</p>}
        </div>

        {/* Postal Code * (Restored) */}
        <div>
          <Label className="text-xs font-medium mb-1 block">Postal Code *</Label>
          <Input
            placeholder="e.g. 1207"
            value={formData.postalCode || ''}
            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
            className={`h-10 text-sm rounded-xl ${errors.postalCode ? 'border-red-500' : ''}`}
          />
          {errors.postalCode && <p className="text-[11px] text-red-500 mt-1">{errors.postalCode}</p>}
        </div>
      </div>

      {/* Area / Union / Ward */}
      <div>
        <Label className="text-xs font-medium mb-1 block">Area / Union / Ward (Optional)</Label>
        <Input
          placeholder="Enter your area or union"
          value={formData.unionOrArea || ''}
          onChange={(e) => setFormData({ ...formData, unionOrArea: e.target.value })}
          className="h-10 text-sm rounded-xl"
        />
      </div>

      {/* Detailed Address */}
      <div>
        <Label className="text-xs font-medium mb-1 block">Detailed Address *</Label>
        <Textarea
          placeholder="House, Road, Village or Landmark"
          value={formData.addressDetail}
          onChange={(e) => setFormData({ ...formData, addressDetail: e.target.value })}
          className={`min-h-[76px] text-sm rounded-xl resize-none ${errors.addressDetail ? 'border-red-500' : ''}`}
        />
        {errors.addressDetail && <p className="text-[11px] text-red-500 mt-1">{errors.addressDetail}</p>}
        <p className="text-[11px] text-muted-foreground mt-1">
          Enter house, road and flat number for city delivery, or village, para and bari name for village delivery.
        </p>
      </div>

      {/* Landmark & Note */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium mb-1 block">Nearest Landmark (Optional)</Label>
          <div className="relative">
            <Compass className="h-4 w-4 absolute left-3 top-3 text-muted-foreground/60" />
            <Input
              placeholder="Nearest well-known place"
              value={formData.landmark || ''}
              onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
              className="pl-9 h-10 text-sm rounded-xl"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium mb-1 block">Delivery Note (Optional)</Label>
          <div className="relative">
            <FileText className="h-4 w-4 absolute left-3 top-3 text-muted-foreground/60" />
            <Input
              placeholder="Special delivery instructions (optional)"
              value={formData.deliveryNote || ''}
              onChange={(e) => setFormData({ ...formData, deliveryNote: e.target.value })}
              className="pl-9 h-10 text-sm rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Address Label Selector */}
      <div className="pt-1 border-t">
        <Label className="text-xs font-medium mb-1.5 block">Address Label</Label>
        <div className="flex flex-wrap gap-2">
          {ADDRESS_LABELS.map((item) => {
            const Icon = item.icon
            const isSelected = formData.label === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFormData({ ...formData, label: item.id })}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-card text-muted-foreground hover:border-primary/40'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Default Address Checkbox */}
      {showDefaultCheckbox && (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="smart-default"
            checked={formData.isDefault}
            onCheckedChange={(c) => setFormData({ ...formData, isDefault: !!c })}
          />
          <Label htmlFor="smart-default" className="text-xs font-medium cursor-pointer">
            Save as my default delivery address
          </Label>
        </div>
      )}

      {/* Live Address Preview Card */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3.5 rounded-xl bg-muted/30 border border-primary/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Address Preview Card
                </span>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                  {formData.label}
                </Badge>
              </div>
              <div className="text-xs space-y-1 text-foreground font-mono bg-card p-3 rounded-lg border">
                <p className="font-bold text-foreground">{formData.name || 'Your Full Name'}</p>
                <p className="text-primary font-semibold">📞 {formData.phone || '01XXXXXXXXX'} {formData.altPhone ? `(Alt: ${formData.altPhone})` : ''}</p>
                <p className="text-muted-foreground">{formData.addressDetail || 'House, Road, Village or Landmark'}</p>
                <p className="text-muted-foreground">
                  {formData.unionOrArea ? `${formData.unionOrArea}, ` : ''}{formData.upazila || 'Upazila'}, {formData.district}, {formData.division}{formData.postalCode ? ` - ${formData.postalCode}` : ''}
                </p>
                {formData.landmark && <p className="text-amber-700 font-semibold">📍 Landmark: {formData.landmark}</p>}
                {formData.deliveryNote && <p className="text-emerald-700 italic">📝 Note: {formData.deliveryNote}</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form Action Buttons */}
      <div className="flex gap-2 pt-2 border-t">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 h-10 text-xs rounded-xl"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 h-10 text-xs rounded-xl font-bold shadow-sm"
        >
          {isSubmitting ? 'Saving Address...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
