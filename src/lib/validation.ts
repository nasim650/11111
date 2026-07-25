export type ValidationResult<T> = {
  ok: true
  data: T
} | {
  ok: false
  errors: Record<string, string>
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,254}$/
const BD_PHONE_REGEX = /^(?:01\d{9}|\+8801\d{9})$/
const NAME_REGEX = /^[\p{L}\p{M}\d\s.'()&,+:;!?/_-]+$/u
const ADDRESS_REGEX = /^[\p{L}\p{M}\d\s.,'()/#&+:;_-]+$/u
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const COUPON_REGEX = /^[A-Z0-9_-]{3,32}$/

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email || null
}

export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const phone = value.trim().replace(/[\s-]/g, '')
  return phone || null
}

export function normalizeCouponCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return COUPON_REGEX.test(code) ? code : null
}

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_REGEX.test(value)
}

export function isValidBangladeshPhone(value: string): boolean {
  return BD_PHONE_REGEX.test(value)
}

export function validateStrongPassword(password: unknown): string | null {
  if (typeof password !== 'string') return 'Password is required'
  if (password.length < 6) return 'Password must be at least 6 characters'
  if (password.length > 128) return 'Password must be 128 characters or fewer'
  return null
}

export function cleanText(value: unknown, maxLength: number, allowAddress = false): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim().replace(/\s+/g, ' ')
  if (!text) return null
  if (text.length > maxLength) return null
  const regex = allowAddress ? ADDRESS_REGEX : NAME_REGEX
  return regex.test(text) ? text : null
}

export function cleanOptionalText(value: unknown, maxLength: number, allowAddress = false): string | null {
  if (value === undefined || value === null || value === '') return null
  return cleanText(value, maxLength, allowAddress)
}

export function cleanSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const slug = value.trim().toLowerCase()
  if (!slug || slug.length > 120) return null
  return SLUG_REGEX.test(slug) ? slug : null
}

export function cleanOptionalUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') return null
  const url = value.trim()
  if (url.length > 1000) return null
  if (url.startsWith('/') || url.startsWith('https://')) return url
  return null
}

export function numberInRange(value: unknown, min: number, max: number): number | null {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || num < min || num > max) return null
  return num
}

export function intInRange(value: unknown, min: number, max: number): number | null {
  const num = numberInRange(value, min, max)
  if (num === null) return null
  return Math.trunc(num)
}

export function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

export function validateRegistration(body: Record<string, unknown>): ValidationResult<{
  name: string | null
  email: string | null
  phone: string | null
  password: string
}> {
  const errors: Record<string, string> = {}
  const email = normalizeEmail(body.email)
  const phone = normalizePhone(body.phone)
  const name = cleanOptionalText(body.name, 80)
  const password = typeof body.password === 'string' ? body.password : ''
  const confirmPassword = body.confirmPassword

  if (!email && !phone) errors.identifier = 'Email or phone is required'
  if (email && !isValidEmail(email)) errors.email = 'Invalid email address'
  if (phone && !isValidBangladeshPhone(phone)) errors.phone = 'Invalid Bangladesh phone number'
  if (body.name && !name) errors.name = 'Name contains invalid characters or is too long'
  const passwordError = validateStrongPassword(password)
  if (passwordError) errors.password = passwordError
  if (confirmPassword !== undefined && confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, data: { name, email, phone, password } }
}

export function validateLogin(body: Record<string, unknown>): ValidationResult<{
  email: string | null
  phone: string | null
  password: string
}> {
  const errors: Record<string, string> = {}
  const email = normalizeEmail(body.email)
  const phone = normalizePhone(body.phone)
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email && !phone) errors.identifier = 'Email or phone is required'
  if (email && !isValidEmail(email)) errors.email = 'Invalid email address'
  if (phone && !isValidBangladeshPhone(phone)) errors.phone = 'Invalid Bangladesh phone number'
  if (!password) errors.password = 'Password is required'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, data: { email, phone, password } }
}

export function validateContact(body: Record<string, unknown>): ValidationResult<{
  name: string
  email: string
  phone: string | null
  subject: string | null
  message: string
}> {
  const errors: Record<string, string> = {}
  const name = cleanText(body.name, 80)
  const email = normalizeEmail(body.email)
  const phone = normalizePhone(body.phone)
  const subject = cleanOptionalText(body.subject, 120)
  const message = cleanText(body.message, 2000, true)

  if (!name) errors.name = 'Name is required and must use valid characters'
  if (!email || !isValidEmail(email)) errors.email = 'Valid email is required'
  if (phone && !isValidBangladeshPhone(phone)) errors.phone = 'Invalid Bangladesh phone number'
  if (body.subject && !subject) errors.subject = 'Subject is too long or contains invalid characters'
  if (!message) errors.message = 'Message is required and must be 2000 characters or fewer'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, data: { name: name!, email: email!, phone, subject, message: message! } }
}

export function validateCheckout(body: Record<string, unknown>): ValidationResult<{
  userId: string | null
  guestName: string
  guestPhone: string
  guestEmail: string | null
  guestAddress: string
  items: Array<{ productId: string; quantity: number; image: string | null }>
  paymentMethod: string
  orderNote: string | null
  couponCode: string | null
  addressId: string | null
  shippingMethod: string | null
  loyaltyPoints: number | null
}> {
  const errors: Record<string, string> = {}
  const userId = cleanOptionalText(body.userId, 80)
  const addressId = cleanOptionalText(body.addressId, 80)
  const guestName = cleanText(body.guestName, 80)
  const guestPhone = normalizePhone(body.guestPhone)
  const guestEmail = normalizeEmail(body.guestEmail)
  const guestAddress = cleanText(body.guestAddress, 240, true)
  const paymentMethod = cleanText(body.paymentMethod || 'cod', 40)
  const shippingMethod = cleanOptionalText(body.shippingMethod, 40)
  const orderNote = cleanOptionalText(body.orderNote, 500, true)
  const couponCode = body.couponCode ? normalizeCouponCode(body.couponCode) : null
  const loyaltyPoints = intInRange(body.loyaltyPoints, 1, 1000000)
  const itemsInput = Array.isArray(body.items) ? body.items : []
  const items: Array<{ productId: string; quantity: number; image: string | null }> = []

  if (body.userId && !userId) errors.userId = 'Invalid user'
  if (body.addressId && !addressId) errors.addressId = 'Invalid address'
  if (!guestName && !addressId) errors.guestName = 'Customer name is required'
  if (!guestPhone && !addressId) errors.guestPhone = 'Valid Bangladesh phone is required'
  if (guestPhone && !isValidBangladeshPhone(guestPhone)) errors.guestPhone = 'Valid Bangladesh phone is required'
  if (guestEmail && !isValidEmail(guestEmail)) errors.guestEmail = 'Invalid email address'
  if (!guestAddress && !addressId) errors.guestAddress = 'Delivery address is required'
  if (!paymentMethod) errors.paymentMethod = 'Payment method is required'
  if (body.orderNote && !orderNote) errors.orderNote = 'Order note must be 500 characters or fewer'
  if (body.couponCode && !couponCode) errors.couponCode = 'Invalid coupon code format'
  if (paymentMethod && !['cod', 'online'].includes(paymentMethod)) {
    errors.paymentMethod = 'Payment method must be cash on delivery or online payment'
  }
  if (itemsInput.length === 0) errors.items = 'Order items are required'
  if (itemsInput.length > 50) errors.items = 'Too many order items'

  for (const [index, item] of itemsInput.entries()) {
    if (!item || typeof item !== 'object') {
      errors[`items.${index}`] = 'Invalid order item'
      continue
    }
    const record = item as Record<string, unknown>
    const productId = cleanText(record.productId, 80)
    const quantity = intInRange(record.quantity, 1, 999)
    const image = cleanOptionalUrl(record.image)

    if (!productId) errors[`items.${index}.productId`] = 'Product is required'
    if (quantity === null) errors[`items.${index}.quantity`] = 'Quantity must be between 1 and 999'
    if (record.image && !image) errors[`items.${index}.image`] = 'Invalid image URL'
    if (productId && quantity !== null) items.push({ productId, quantity, image })
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    data: {
      userId,
      guestName: guestName || '',
      guestPhone: guestPhone || '',
      guestEmail,
      guestAddress: guestAddress || '',
      items,
      paymentMethod: paymentMethod!,
      orderNote,
      couponCode,
      addressId,
      shippingMethod,
      loyaltyPoints,
    },
  }
}

export function validateAddressParts(body: Record<string, unknown>): ValidationResult<{
  name: string
  phone: string
  address: string
  city: string
  district: string | null
  postalCode: string | null
}> {
  const errors: Record<string, string> = {}
  const name = cleanText(body.name ?? body.guestName, 80)
  const phone = normalizePhone(body.phone ?? body.guestPhone)
  const address = cleanText(body.address ?? body.guestAddress, 240, true)
  const city = cleanText(body.city, 80)
  const district = cleanOptionalText(body.district, 80)
  const postalCode = cleanOptionalText(body.postalCode, 20, true)

  if (!name) errors.name = 'Name is required'
  if (!phone || !isValidBangladeshPhone(phone)) errors.phone = 'Valid Bangladesh phone is required'
  if (!address) errors.address = 'Address is required and must be 240 characters or fewer'
  if (!city) errors.city = 'City is required'
  if (body.district && !district) errors.district = 'District contains invalid characters'
  if (body.postalCode && !postalCode) errors.postalCode = 'Postal code contains invalid characters'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, data: { name: name!, phone: phone!, address: address!, city: city!, district, postalCode } }
}

export function validateReview(body: Record<string, unknown>): ValidationResult<{
  userId: string
  productId: string
  rating: number
  comment: string | null
}> {
  const errors: Record<string, string> = {}
  const userId = cleanText(body.userId, 80)
  const productId = cleanText(body.productId, 80)
  const rating = intInRange(body.rating, 1, 5)
  const comment = cleanOptionalText(body.comment, 1000, true)

  if (!userId) errors.userId = 'User is required'
  if (!productId) errors.productId = 'Product is required'
  if (rating === null) errors.rating = 'Rating must be between 1 and 5'
  if (body.comment && !comment) errors.comment = 'Comment is too long or contains invalid characters'
  if (comment && /(https?:\/\/|www\.)/i.test(comment)) errors.comment = 'Links are not allowed in reviews'
  if (comment && /(.)\1{12,}/u.test(comment)) errors.comment = 'Review appears to be spam'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, data: { userId: userId!, productId: productId!, rating: rating!, comment } }
}

export function validateCoupon(body: Record<string, unknown>, partial = false): ValidationResult<Record<string, unknown>> {
  const errors: Record<string, string> = {}
  const data: Record<string, unknown> = {}

  if (!partial || body.code !== undefined) {
    const code = normalizeCouponCode(body.code)
    if (!code) errors.code = 'Coupon code must be 3-32 letters, numbers, underscores, or dashes'
    else data.code = code
  }
  if (!partial || body.type !== undefined) {
    const type = body.type || 'percentage'
    if (type !== 'percentage' && type !== 'fixed') errors.type = 'Coupon type must be percentage or fixed'
    else data.type = type
  }
  if (!partial || body.value !== undefined) {
    const value = numberInRange(body.value, 0.01, 1000000)
    if (value === null) errors.value = 'Coupon value must be greater than 0'
    else data.value = value
  }
  for (const field of ['minOrder', 'maxDiscount'] as const) {
    if (body[field] !== undefined) {
      data[field] = body[field] ? numberInRange(body[field], 0, 10000000) : null
      if (body[field] && data[field] === null) errors[field] = `${field} must be a valid amount`
    }
  }
  if (body.usageLimit !== undefined) {
    data.usageLimit = body.usageLimit ? intInRange(body.usageLimit, 1, 1000000) : null
    if (body.usageLimit && data.usageLimit === null) errors.usageLimit = 'Usage limit must be a positive integer'
  }
  if (!partial || body.validFrom !== undefined) {
    const validFrom = new Date(String(body.validFrom || ''))
    if (Number.isNaN(validFrom.getTime())) errors.validFrom = 'Valid from date is required'
    else data.validFrom = validFrom
  }
  if (!partial || body.validTo !== undefined) {
    const validTo = new Date(String(body.validTo || ''))
    if (Number.isNaN(validTo.getTime())) errors.validTo = 'Valid to date is required'
    else data.validTo = validTo
  }
  if (data.validFrom instanceof Date && data.validTo instanceof Date && data.validFrom >= data.validTo) {
    errors.validTo = 'Valid to date must be after valid from date'
  }
  if (body.isActive !== undefined) data.isActive = booleanValue(body.isActive, true)

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, data }
}

export function validationError(errors: Record<string, string>) {
  return { success: false, error: 'Validation failed', errors }
}
