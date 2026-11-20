import test from 'node:test'
import assert from 'node:assert/strict'

const {
  validateAddressParts,
  validateCheckout,
  cleanText,
  normalizePhone,
  isValidBangladeshPhone
} = await import('../src/lib/validation.ts')

const {
  packSmartAddress,
  unpackSmartAddress
} = await import('../src/lib/bangladesh-address.ts')

test('1. Smart address pack and unpack round-trip preserves all Bangladesh fields', () => {
  const original = {
    name: 'তানভীর আহমেদ',
    phone: '01712345678',
    altPhone: '01812345678',
    division: 'ঢাকা',
    district: 'ঢাকা',
    upazila: 'মিরপুর',
    unionOrArea: 'মিরপুর-১০',
    addressDetail: 'বাড়ি ১২, রোড ৪, ব্লক সি',
    landmark: 'গোলচত্বরের কাছে',
    deliveryNote: 'গেটে এসে ফোন দিবেন',
    label: 'Home',
    postalCode: '1216',
    isDefault: true,
  }

  const packed = packSmartAddress(original)
  assert.ok(packed.address.includes('__BDMETA__'), 'Packed address should contain metadata marker')
  assert.equal(packed.city, 'মিরপুর')
  assert.equal(packed.district, 'ঢাকা')
  assert.equal(packed.postalCode, '1216')

  const unpacked = unpackSmartAddress({
    name: packed.name,
    phone: packed.phone,
    address: packed.address,
    city: packed.city,
    district: packed.district,
    postalCode: packed.postalCode,
    isDefault: true,
  })

  assert.equal(unpacked.name, original.name)
  assert.equal(unpacked.phone, original.phone)
  assert.equal(unpacked.altPhone, original.altPhone)
  assert.equal(unpacked.division, original.division)
  assert.equal(unpacked.district, original.district)
  assert.equal(unpacked.upazila, original.upazila)
  assert.equal(unpacked.unionOrArea, original.unionOrArea)
  assert.equal(unpacked.addressDetail, original.addressDetail)
  assert.equal(unpacked.landmark, original.landmark)
  assert.equal(unpacked.deliveryNote, original.deliveryNote)
  assert.equal(unpacked.label, original.label)
  assert.equal(unpacked.postalCode, original.postalCode)
  assert.equal(unpacked.isDefault, true)
})

test('2. validateAddressParts accepts and validates a full Bangladesh Smart Address', () => {
  const smartData = {
    name: 'মাহমুদুল হাসান',
    phone: '01819999888',
    division: 'চট্টগ্রাম',
    district: 'চট্টগ্রাম',
    upazila: 'পাঁচলাইশ',
    unionOrArea: 'জিইসি মোড়',
    addressDetail: 'ফ্ল্যাট ৪বি, বাসা ৯, রোড ২',
    landmark: 'সেন্ট্রাল প্লাজার পেছনে',
    deliveryNote: 'কলিংবেল চাপুন',
    label: 'Office',
    postalCode: '4000',
  }

  const packed = packSmartAddress(smartData)

  const validated = validateAddressParts({
    name: packed.name,
    phone: packed.phone,
    address: packed.address,
    city: packed.city,
    district: packed.district,
    postalCode: packed.postalCode,
    isDefault: true,
  })

  assert.equal(validated.ok, true, 'Smart address must pass validation')
  if (validated.ok) {
    assert.equal(validated.data.name, 'মাহমুদুল হাসান')
    assert.equal(validated.data.phone, '01819999888')
    assert.ok(validated.data.address.includes('__BDMETA__'))
    assert.equal(validated.data.city, 'পাঁচলাইশ')
    assert.equal(validated.data.district, 'চট্টগ্রাম')
  }
})

test('3. validateAddressParts accepts legacy plain string addresses with Bengali text and punctuation', () => {
  const legacyAddr = {
    name: 'আরিফুল ইসলাম',
    phone: '+8801912345678',
    address: 'বাড়ি নং ৪৫/এ, রোড নং ৩, ধানমন্ডি। ল্যান্ডমার্ক: লেকের পশ্চিম পাড়—২য় তলা।',
    city: 'ঢাকা',
    district: 'ঢাকা',
    postalCode: '1205',
    isDefault: false,
  }

  const validated = validateAddressParts(legacyAddr)
  assert.equal(validated.ok, true, 'Legacy Bengali address must pass validation')
  if (validated.ok) {
    assert.equal(validated.data.name, 'আরিফুল ইসলাম')
    assert.equal(validated.data.phone, '01912345678')
    assert.equal(validated.data.address, legacyAddr.address)
  }
})

test('4. validateAddressParts rejects malformed or corrupted metadata JSON', () => {
  const malformed = {
    name: 'Customer Test',
    phone: '01711223344',
    address: 'বাড়ি ১২, ধানমন্ডি | __BDMETA__{"addressDetail": invalid json',
    city: 'ঢাকা',
  }

  const validated = validateAddressParts(malformed)
  assert.equal(validated.ok, false, 'Malformed metadata must fail validation')
  if (!validated.ok) {
    assert.ok(validated.errors.address, 'Should return address validation error')
  }
})

test('5. validateAddressParts sanitizes and strips unauthorized properties injected into metadata', () => {
  const injectedMetadata = JSON.stringify({
    addressDetail: 'Valid Detail',
    division: 'ঢাকা',
    district: 'ঢাকা',
    upazila: 'মিরপুর',
    unauthorizedRole: 'admin',
    isVerified: true,
    maliciousPayload: '<script>alert(1)</script>',
  })

  const payload = {
    name: 'Tamim',
    phone: '01711223344',
    address: `মিরপুর, ঢাকা | __BDMETA__${injectedMetadata}`,
    city: 'মিরপুর',
  }

  const validated = validateAddressParts(payload)
  assert.equal(validated.ok, true)
  if (validated.ok) {
    // Unpack to ensure unauthorized fields were stripped by re-packing
    const unpacked = unpackSmartAddress({
      name: validated.data.name,
      phone: validated.data.phone,
      address: validated.data.address,
      city: validated.data.city,
    })
    assert.equal(unpacked.addressDetail, 'Valid Detail')
    assert.equal(unpacked.unauthorizedRole, undefined)
    assert.equal(unpacked.isVerified, undefined)
    assert.equal(unpacked.maliciousPayload, undefined)
  }
})

test('6. validateCheckout allows guest orders with smart packed addresses', () => {
  const guestSmart = {
    name: 'অতিথি ক্রেতা',
    phone: '01311223344',
    division: 'রাজশাহী',
    district: 'রাজশাহী',
    upazila: 'বোয়ালিয়া',
    addressDetail: 'সাহেব বাজার, আরডিএ মার্কেট রোড',
    postalCode: '6000',
  }

  const packed = packSmartAddress(guestSmart)

  const checkoutPayload = {
    paymentMethod: 'cod',
    shippingMethod: 'standard',
    guestName: guestSmart.name,
    guestPhone: guestSmart.phone,
    guestAddress: packed.address,
    items: [
      {
        productId: 'prod-001',
        productName: 'সরিষার তেল',
        quantity: 2,
        price: 250,
      },
    ],
  }

  const validated = validateCheckout(checkoutPayload)
  assert.equal(validated.ok, true, 'Checkout should succeed for guest with smart address')
  if (validated.ok) {
    assert.equal(validated.data.guestName, 'অতিথি ক্রেতা')
    assert.equal(validated.data.guestPhone, '01311223344')
    assert.ok(validated.data.guestAddress?.includes('__BDMETA__'))
  }
})
