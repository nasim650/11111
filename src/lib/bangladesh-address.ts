/**
 * Bangladesh Smart Address Parser & Formatter Utility
 * --------------------------------------------------
 * Handles packing, unpacking, formatting, and rider delivery label generation.
 */

export interface SmartAddressData {
  id?: string
  name: string
  phone: string
  altPhone?: string
  email?: string
  division: string
  district: string
  upazila: string
  postalCode?: string
  unionOrArea?: string
  addressDetail: string // House/Road/Flat OR Village/Para/Bari
  landmark?: string
  deliveryNote?: string
  label: string // 'Home' | 'Office' | 'Family' | 'Shop' | 'Other'
  isDefault?: boolean
}

/**
 * Packs a SmartAddressData object into standard Prisma Address string fields
 * so extended metadata is preserved safely without altering DB schema.
 */
export function packSmartAddress(data: SmartAddressData) {
  const metaPayload = JSON.stringify({
    altPhone: data.altPhone || '',
    division: data.division || '',
    upazila: data.upazila || '',
    postalCode: data.postalCode || '',
    unionOrArea: data.unionOrArea || '',
    addressDetail: data.addressDetail || '',
    landmark: data.landmark || '',
    deliveryNote: data.deliveryNote || '',
    label: data.label || 'Home',
  })

  // Detailed combined human-readable address line
  const fullAddressLine = [
    data.addressDetail,
    data.unionOrArea ? `Area/Union: ${data.unionOrArea}` : '',
    data.upazila ? `Upazila: ${data.upazila}` : '',
    data.postalCode ? `Postal Code: ${data.postalCode}` : '',
    data.landmark ? `Landmark: ${data.landmark}` : '',
    data.deliveryNote ? `Note: ${data.deliveryNote}` : '',
    data.altPhone ? `Alt Phone: ${data.altPhone}` : '',
    `__BDMETA__${metaPayload}`,
  ].filter(Boolean).join(' | ')

  return {
    name: data.name,
    phone: data.phone,
    address: fullAddressLine,
    city: data.upazila || data.district,
    district: data.district,
    postalCode: data.postalCode || data.label || 'Home',
    isDefault: data.isDefault ?? false,
  }
}

/**
 * Unpacks any raw DB Address object or string into a structured SmartAddressData
 */
export function unpackSmartAddress(rawAddress: any): SmartAddressData {
  const cleanDivision = (div: string) => (div || 'Dhaka').replace(/\s*Division$/, '').trim()

  if (!rawAddress) {
    return {
      name: '',
      phone: '',
      division: 'Dhaka',
      district: 'Dhaka',
      upazila: 'Mirpur',
      postalCode: '',
      addressDetail: '',
      label: 'Home',
    }
  }

  // Handle if rawAddress is object from DB
  const name = rawAddress.name || rawAddress.guestName || ''
  const phone = rawAddress.phone || rawAddress.guestPhone || ''
  const district = rawAddress.district || 'Dhaka'
  const city = rawAddress.city || 'Dhaka'
  const postalCodeLabel = rawAddress.postalCode || 'Home'
  const addressStr = typeof rawAddress === 'string' ? rawAddress : (rawAddress.address || rawAddress.guestAddress || '')

  // Check for encoded metadata payload
  if (addressStr.includes('__BDMETA__')) {
    try {
      const parts = addressStr.split('__BDMETA__')
      const meta = JSON.parse(parts[1])
      return {
        id: rawAddress.id,
        name,
        phone,
        altPhone: meta.altPhone || '',
        division: cleanDivision(meta.division),
        district: district || 'Dhaka',
        upazila: meta.upazila || city || 'Mirpur',
        postalCode: meta.postalCode || (/^\d{4}$/.test(rawAddress.postalCode) ? rawAddress.postalCode : ''),
        unionOrArea: meta.unionOrArea || '',
        addressDetail: meta.addressDetail || parts[0].split(' | ')[0] || '',
        landmark: meta.landmark || '',
        deliveryNote: meta.deliveryNote || '',
        label: meta.label || (postalCodeLabel && !/^\d{4}$/.test(postalCodeLabel) ? postalCodeLabel : 'Home'),
        isDefault: rawAddress.isDefault ?? false,
      }
    } catch {
      // Fallback if JSON parse fails
    }
  }

  // Legacy free-text parsing fallback
  const firstLine = addressStr.split(' | ')[0] || addressStr
  return {
    id: rawAddress.id,
    name,
    phone,
    division: cleanDivision(rawAddress.division || 'Dhaka'),
    district,
    upazila: city || 'Mirpur',
    postalCode: /^\d{4}$/.test(postalCodeLabel) ? postalCodeLabel : '',
    addressDetail: firstLine,
    label: postalCodeLabel && !/^\d{4}$/.test(postalCodeLabel) ? postalCodeLabel : 'Home',
    isDefault: rawAddress.isDefault ?? false,
  }
}

/**
 * Formats a SmartAddressData into a clean multi-line display string
 */
export function formatAddressDisplay(smart: SmartAddressData): string {
  const lines: string[] = []
  if (smart.addressDetail) lines.push(smart.addressDetail)
  if (smart.unionOrArea) lines.push(`${smart.unionOrArea}, ${smart.upazila}`)
  else if (smart.upazila) lines.push(smart.upazila)
  if (smart.district || smart.division) lines.push(`${smart.district || ''}${smart.division ? `, ${smart.division}` : ''}`)
  if (smart.landmark) lines.push(`Landmark: ${smart.landmark}`)
  return lines.join('\n')
}

/**
 * Generates a rider-friendly 5-second printable delivery label string
 */
export function generateDeliveryLabelText(
  smart: SmartAddressData,
  orderNumber: string,
  totalAmount: number,
  paymentMethod: string
): string {
  return `
========================================
KHATI KHADYO - DELIVERY LABEL
========================================
ORDER NUMBER : #${orderNumber}
TOTAL PAYABLE: ৳${totalAmount.toLocaleString()} (${paymentMethod.toUpperCase()})
----------------------------------------
RECIPIENT NAME: ${smart.name}
PRIMARY PHONE : ${smart.phone}
${smart.altPhone ? `ALT PHONE     : ${smart.altPhone}` : ''}
----------------------------------------
ADDRESS LABEL : [ ${smart.label.toUpperCase()} ]
DIVISION      : ${smart.division}
DISTRICT      : ${smart.district}
UPAZILA/THANA : ${smart.upazila}
${smart.unionOrArea ? `UNION / AREA  : ${smart.unionOrArea}` : ''}
----------------------------------------
DETAILED ADDRESS:
${smart.addressDetail}

${smart.landmark ? `LANDMARK: ${smart.landmark}` : ''}
${smart.deliveryNote ? `DELIVERY NOTE: ${smart.deliveryNote}` : ''}
========================================
`.trim()
}
