'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Phone, Mail, MapPin, Building, Home as HomeIcon,
  Briefcase, Users, Store, Tag, Compass, FileText, CheckCircle2,
  Eye, RefreshCw, AlertCircle, Sparkles
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
  getUpazilasForDistrict,
  getAreasForUpazila
} from '@/lib/bangladesh-locations'
import { SmartAddressData } from '@/lib/bangladesh-address'

const ADDRESS_LABELS = [
  { id: 'Home', label: 'Home', icon: HomeIcon, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'Office', label: 'Office', icon: Briefcase, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'Family', label: 'Family', icon: Users, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'Shop', label: 'Shop', icon: Store, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'Other', label: 'Other', icon: Tag, color: 'bg-gray-50 text-gray-700 border-gray-200' },
]

const DRAFT_KEY = 'khati_khadyo_address_draft'

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
  submitLabel = 'Save & Use Address',
  showDefaultCheckbox = true,
}: SmartAddressFormProps) {
  const [formData, setFormData] = useState<SmartAddressData>(() => {
    let base: SmartAddressData = {
      name: initialValues?.name || '',
      phone: initialValues?.phone || '',
      altPhone: initialValues?.altPhone || '',
      email: initialValues?.email || '',
      division: initialValues?.division || 'Dhaka Division',
      district: initialValues?.district || 'Dhaka',
      upazila: initialValues?.upazila || 'Mirpur',
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

  // Derived cascading location options
  const districts = getDistrictsForDivision(formData.division)
  const upazilas = getUpazilasForDistrict(formData.district)

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
    const upList = getUpazilasForDistrict(newDistrict)
    const newUpazila = upList[0] || 'Mirpur'
    setFormData((prev) => ({
      ...prev,
      division,
      district: newDistrict,
      upazila: newUpazila,
    }))
  }

  const handleDistrictChange = (district: string) => {
    const upList = getUpazilasForDistrict(district)
    const newUpazila = upList[0] || 'Mirpur'
    setFormData((prev) => ({
      ...prev,
      district,
      upazila: newUpazila,
    }))
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!formData.name.trim()) errs.name = 'Full Name is required'
    if (!formData.phone.trim()) {
      errs.phone = 'Primary Phone is required'
    } else if (!/^(?:01\d{9}|\+8801\d{9})$/.test(formData.phone.trim())) {
      errs.phone = 'Valid 11-digit BD phone number required (01XXXXXXXXX)'
    }
    if (formData.altPhone && !/^(?:01\d{9}|\+8801\d{9})$/.test(formData.altPhone.trim())) {
      errs.altPhone = 'Valid 11-digit BD phone number required'
    }
    if (!formData.division) errs.division = 'Division is required'
    if (!formData.district) errs.district = 'District is required'
    if (!formData.upazila) errs.upazila = 'Upazila / Thana is required'
    if (!formData.addressDetail.trim()) errs.addressDetail = 'Detailed Address (House/Road or Village/Para) is required'

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
    <form onSubmit={handleSubmit} className="space-y-5 bg-card border rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Bangladesh Smart Address</h3>
            <p className="text-xs text-muted-foreground">Form tailored for City, Town & Village deliveries</p>
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

      {/* ─── Contact Information ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Contact Information
        </h4>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium mb-1 block">Full Name *</Label>
            <div className="relative">
              <User className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="e.g. Nasim Parvez"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`pl-9 h-10 text-sm rounded-xl ${errors.name ? 'border-red-500' : ''}`}
              />
            </div>
            {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <Label className="text-xs font-medium mb-1 block">Primary Phone Number *</Label>
            <div className="relative">
              <Phone className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="01712345678"
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
                placeholder="018XXXXXXXX (for delivery rider)"
                value={formData.altPhone || ''}
                onChange={(e) => setFormData({ ...formData, altPhone: e.target.value })}
                className="pl-9 h-10 text-sm rounded-xl"
              />
            </div>
            {errors.altPhone && <p className="text-[11px] text-red-500 mt-1">{errors.altPhone}</p>}
          </div>

          <div>
            <Label className="text-xs font-medium mb-1 block">Email Address (Optional)</Label>
            <div className="relative">
              <Mail className="h-4 w-4 absolute left-3 top-3 text-muted-foreground/60" />
              <Input
                type="email"
                placeholder="customer@email.com"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="pl-9 h-10 text-sm rounded-xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Location Hierarchy (Cascading Dropdowns) ──────────────────────── */}
      <div className="space-y-3 pt-1 border-t">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Location Hierarchy
        </h4>

        <div className="grid sm:grid-cols-3 gap-3">
          {/* Division */}
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
          </div>

          {/* District */}
          <div>
            <Label className="text-xs font-medium mb-1 block">District *</Label>
            <Select
              value={formData.district}
              onValueChange={handleDistrictChange}
            >
              <SelectTrigger className="h-10 text-sm rounded-xl">
                <SelectValue placeholder="Select District" />
              </SelectTrigger>
              <SelectContent>
                {districts.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upazila / City / Thana */}
          <div>
            <Label className="text-xs font-medium mb-1 block">Upazila / Thana *</Label>
            <Select
              value={formData.upazila}
              onValueChange={(val) => setFormData({ ...formData, upazila: val })}
            >
              <SelectTrigger className="h-10 text-sm rounded-xl">
                <SelectValue placeholder="Select Upazila/Thana" />
              </SelectTrigger>
              <SelectContent>
                {upazilas.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Area / Union / Ward */}
        <div>
          <Label className="text-xs font-medium mb-1 block">Area / Union / Ward (Optional)</Label>
          <Input
            placeholder="e.g. Mirpur DOHS, Section 10, Sector 4, or Union Name"
            value={formData.unionOrArea || ''}
            onChange={(e) => setFormData({ ...formData, unionOrArea: e.target.value })}
            className="h-10 text-sm rounded-xl"
          />
        </div>
      </div>

      {/* ─── Detailed Address Field ────────────────────────────────────────── */}
      <div className="space-y-3 pt-1 border-t">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Detailed Address
        </h4>

        <div>
          <Label className="text-xs font-medium mb-1 block">
            House / Road / Flat OR Village / Para / Bari *
          </Label>
          <Textarea
            placeholder="Urban Example: House 15, Road 7, Block B&#10;Village Example: Village: South Char, Para: Mollabari"
            value={formData.addressDetail}
            onChange={(e) => setFormData({ ...formData, addressDetail: e.target.value })}
            className={`min-h-[80px] text-sm rounded-xl resize-none ${errors.addressDetail ? 'border-red-500' : ''}`}
          />
          {errors.addressDetail && <p className="text-[11px] text-red-500 mt-1">{errors.addressDetail}</p>}
          <p className="text-[11px] text-muted-foreground mt-1">
            Accepts natural Bangladeshi writing style for both city apartments and rural villages.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium mb-1 block">Nearest Landmark (Optional)</Label>
            <div className="relative">
              <Compass className="h-4 w-4 absolute left-3 top-3 text-muted-foreground/60" />
              <Input
                placeholder="e.g. Near BRAC Bank, Opposite Mosque, Near School"
                value={formData.landmark || ''}
                onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                className="pl-9 h-10 text-sm rounded-xl"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium mb-1 block">Delivery Instruction / Note (Optional)</Label>
            <div className="relative">
              <FileText className="h-4 w-4 absolute left-3 top-3 text-muted-foreground/60" />
              <Input
                placeholder="e.g. Call before delivery, leave at gate"
                value={formData.deliveryNote || ''}
                onChange={(e) => setFormData({ ...formData, deliveryNote: e.target.value })}
                className="pl-9 h-10 text-sm rounded-xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Address Label Selector ────────────────────────────────────────── */}
      <div className="space-y-2 pt-1 border-t">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
          Address Label
        </Label>
        <div className="flex flex-wrap gap-2">
          {ADDRESS_LABELS.map((item) => {
            const Icon = item.icon
            const isSelected = formData.label === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFormData({ ...formData, label: item.id })}
                className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
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

      {/* ─── Default Checkbox ──────────────────────────────────────────────── */}
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

      {/* ─── Live Address Preview Card ─────────────────────────────────────── */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-muted/40 border border-primary/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Live Rider Delivery Preview Card
                </span>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                  {formData.label}
                </Badge>
              </div>
              <div className="text-xs space-y-1 text-foreground/90 font-mono bg-card p-3 rounded-lg border">
                <p className="font-bold text-sm text-foreground">{formData.name || 'Recipient Name'}</p>
                <p className="text-primary font-semibold">📞 {formData.phone || '01XXXXXXXXX'} {formData.altPhone ? `(Alt: ${formData.altPhone})` : ''}</p>
                <p className="text-muted-foreground mt-1">{formData.addressDetail || 'Detailed Address Line'}</p>
                <p className="text-muted-foreground">
                  {formData.unionOrArea ? `${formData.unionOrArea}, ` : ''}{formData.upazila}, {formData.district}, {formData.division}
                </p>
                {formData.landmark && <p className="text-amber-700 font-semibold">📍 Landmark: {formData.landmark}</p>}
                {formData.deliveryNote && <p className="text-emerald-700 italic">📝 Note: {formData.deliveryNote}</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 h-11 text-xs rounded-xl"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 h-11 text-xs rounded-xl font-bold shadow-sm"
        >
          {isSubmitting ? 'Saving Address...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
