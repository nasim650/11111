import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.APP_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'

  if (isProduction && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    console.error('❌ SEED BLOCKED: Seeding is blocked in production to prevent data loss and default credential creation.')
    console.error('To run seeding safely in development or staging, ensure NODE_ENV is not set to production.')
    process.exit(1)
  }

  if (isProduction && process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    console.error('❌ DESTRUCTIVE SEED BLOCKED: Table truncation (deleteMany) is disabled in production.')
    console.error('To allow destructive re-seed, set ALLOW_DESTRUCTIVE_SEED=true explicitly.')
    process.exit(1)
  }

  console.log('🌱 Seeding database...')

  // Clean existing data (in correct order to respect foreign keys)
  console.log('🧹 Cleaning existing data...')
  await prisma.auditLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.contactMessage.deleteMany()
  await prisma.newsletterSubscriber.deleteMany()
  await prisma.mediaFile.deleteMany()
  await prisma.deliveryLabel.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.wishlist.deleteMany()
  await prisma.review.deleteMany()
  await prisma.productVideo.deleteMany()
  await prisma.productImage.deleteMany()
  await prisma.product.deleteMany()
  await prisma.subcategory.deleteMany()
  await prisma.category.deleteMany()
  await prisma.address.deleteMany()
  await prisma.user.deleteMany()
  await prisma.coupon.deleteMany()
  await prisma.policyPage.deleteMany()
  await prisma.menuItem.deleteMany()
  await prisma.homepageSection.deleteMany()
  await prisma.banner.deleteMany()
  await prisma.siteConfig.deleteMany()
  await prisma.testimonial.deleteMany()
  await prisma.fAQItem.deleteMany()
  await prisma.teamMember.deleteMany()
  await prisma.partner.deleteMany()

  // ─── Users ──────────────────────────────────────────────────────────────
  console.log('👤 Creating users...')
  const rawAdminPassword = process.env.SEED_ADMIN_PASSWORD || (isProduction ? null : 'admin123')
  if (!rawAdminPassword) {
    console.error('❌ SEED BLOCKED: In production, SEED_ADMIN_PASSWORD environment variable must be provided.')
    process.exit(1)
  }
  const adminPassword = await bcrypt.hash(rawAdminPassword, 12)
  const rawCustomerPassword = process.env.SEED_CUSTOMER_PASSWORD || (isProduction ? null : 'customer123')
  if (!rawCustomerPassword) {
    console.error('❌ SEED BLOCKED: In production, SEED_CUSTOMER_PASSWORD environment variable must be provided.')
    process.exit(1)
  }
  const customerPassword = await bcrypt.hash(rawCustomerPassword, 10)

  const admin = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@khatikhadyo.com',
      password: adminPassword,
      role: 'admin',
      isVerified: true,
      isActive: true,
    },
  })

  const customer = await prisma.user.create({
    data: {
      name: 'Test Customer',
      email: 'customer@test.com',
      phone: '+8801712345678',
      password: customerPassword,
      role: 'customer',
      isVerified: true,
      isActive: true,
    },
  })

  console.log(`  ✅ Admin: ${admin.email}`)
  console.log(`  ✅ Customer: ${customer.email}`)

  // ─── Site Configuration ─────────────────────────────────────────────────
  console.log('⚙️  Creating site configuration...')
  const siteConfigs = [
    // General
    { key: 'site_name', value: 'Khati Khadyo', type: 'text', group: 'general', label: 'Site Name' },
    { key: 'tagline', value: 'খাটি খাদ্য, নির্ভরযোগ্য মান, ফ্রেশ এবং বিশ্বস্ত বাংলাদেশী খাদ্যপণ্য', type: 'text', group: 'general', label: 'Tagline' },
    { key: 'logo', value: '/all_logo.png', type: 'image', group: 'general', label: 'Logo' },
    { key: 'favicon', value: '/favicon.png', type: 'image', group: 'general', label: 'Favicon' },
    { key: 'footer_text', value: '© 2024 Khati Khadyo. All rights reserved. খাটি খাদ্য, বিশ্বস্ত মান।', type: 'text', group: 'general', label: 'Footer Text' },
    { key: 'currency', value: 'BDT', type: 'text', group: 'general', label: 'Currency' },
    { key: 'currency_symbol', value: '৳', type: 'text', group: 'general', label: 'Currency Symbol' },
    { key: 'site_description', value: 'Khati Khadyo is your trusted source for authentic Bangladeshi food products. From pure ghee to organic honey, we deliver the best quality traditional food items across Bangladesh.', type: 'text', group: 'general', label: 'Site Description' },
    { key: 'maintenance_mode', value: 'false', type: 'boolean', group: 'general', label: 'Maintenance Mode' },

    // Contact
    { key: 'phone', value: '+8801712345678', type: 'text', group: 'contact', label: 'Phone' },
    { key: 'email', value: 'info@khatikhadyo.com', type: 'text', group: 'contact', label: 'Email' },
    { key: 'address', value: 'Dhaka, Bangladesh', type: 'text', group: 'contact', label: 'Address' },
    { key: 'whatsapp', value: '+8801712345678', type: 'text', group: 'contact', label: 'WhatsApp' },
    { key: 'messenger', value: 'https://m.me/khatikhadyo', type: 'text', group: 'contact', label: 'Messenger' },

    // Social
    { key: 'facebook', value: 'https://facebook.com/khatikhadyo', type: 'text', group: 'social', label: 'Facebook' },
    { key: 'instagram', value: 'https://instagram.com/khatikhadyo', type: 'text', group: 'social', label: 'Instagram' },
    { key: 'youtube', value: 'https://youtube.com/@khatikhadyo', type: 'text', group: 'social', label: 'YouTube' },
    { key: 'twitter', value: 'https://twitter.com/khatikhadyo', type: 'text', group: 'social', label: 'Twitter' },

    // SEO
    { key: 'default_meta_title', value: 'Khati Khadyo - Authentic Bangladeshi Food Products | খাটি খাদ্য', type: 'text', group: 'seo', label: 'Default Meta Title' },
    { key: 'default_meta_description', value: 'Buy authentic Bangladeshi food products online. Pure ghee, organic honey, fresh seasonal fruits, traditional sweets and more. Free delivery on orders over ৳500.', type: 'text', group: 'seo', label: 'Default Meta Description' },
    { key: 'default_meta_keywords', value: 'khati khadyo, bangladeshi food, pure ghee, organic honey, deshi gur, fresh fruits, traditional sweets, online grocery bangladesh', type: 'text', group: 'seo', label: 'Default Meta Keywords' },
    { key: 'google_analytics_id', value: 'G-XXXXXXXXXX', type: 'text', group: 'seo', label: 'Google Analytics ID' },

    // Payment
    { key: 'cod_enabled', value: 'true', type: 'boolean', group: 'payment', label: 'Cash on Delivery' },
    { key: 'bkash_enabled', value: 'true', type: 'boolean', group: 'payment', label: 'bKash Payment' },
    { key: 'nagad_enabled', value: 'true', type: 'boolean', group: 'payment', label: 'Nagad Payment' },
    { key: 'rocket_enabled', value: 'true', type: 'boolean', group: 'payment', label: 'Rocket Payment' },
    { key: 'card_enabled', value: 'true', type: 'boolean', group: 'payment', label: 'Card Payment' },
    { key: 'delivery_charge', value: '60', type: 'number', group: 'payment', label: 'Delivery Charge' },
    { key: 'free_delivery_min', value: '500', type: 'number', group: 'payment', label: 'Free Delivery Minimum' },

    // Appearance
    { key: 'primary_color', value: '#2D6A4F', type: 'text', group: 'appearance', label: 'Primary Color' },
    { key: 'secondary_color', value: '#B8860B', type: 'text', group: 'appearance', label: 'Secondary Color' },
    { key: 'announcement_text', value: 'Welcome to Khati Khadyo - খাটি খাদ্যপণ্য!', type: 'text', group: 'appearance', label: 'Announcement Text' },
    { key: 'accent_color', value: '#D4A373', type: 'text', group: 'appearance', label: 'Accent Color' },

    // Email
    { key: 'smtp_host', value: 'smtp.gmail.com', type: 'text', group: 'email', label: 'SMTP Host' },
    { key: 'smtp_port', value: '587', type: 'number', group: 'email', label: 'SMTP Port' },
    { key: 'smtp_user', value: 'noreply@khatikhadyo.com', type: 'text', group: 'email', label: 'SMTP User' },
    { key: 'smtp_from', value: 'Khati Khadyo <noreply@khatikhadyo.com>', type: 'text', group: 'email', label: 'SMTP From' },
  ]

  for (const config of siteConfigs) {
    await prisma.siteConfig.create({ data: config })
  }
  console.log(`  ✅ Created ${siteConfigs.length} site config entries`)

  // ─── Categories ─────────────────────────────────────────────────────────
  console.log('📁 Creating categories...')
  const categoriesData = [
    { name: 'দেশি গুড়', slug: 'deshi-gur', description: 'Pure and authentic Deshi Gur (jaggery) made from traditional methods. Rich in taste and nutrition.', icon: '🍬', showInHome: true, sortOrder: 1 },
    { name: 'খেজুরের গুড়', slug: 'khejurer-gur', description: 'Premium Khejurer Gur (date palm jaggery) - the winter delicacy of Bangladesh.', icon: '🌴', showInHome: true, sortOrder: 2 },
    { name: 'ঘি', slug: 'ghee', description: 'Pure Deshi Ghee made from cow milk. Traditional and aromatic.', icon: '🥛', showInHome: true, sortOrder: 3 },
    { name: 'মিষ্টি', slug: 'sweets', description: 'Traditional Bangladeshi sweets made with love and authentic recipes.', icon: '🍰', showInHome: true, sortOrder: 4 },
    { name: 'দই/যোগার্ট', slug: 'doi-yogurt', description: 'Fresh and creamy Mishti Doi and yogurt from renowned makers.', icon: '🥣', showInHome: true, sortOrder: 5 },
    { name: 'আম', slug: 'mango', description: 'Premium Bangladeshi mangoes - Himsagar, Langra, Fazli and more varieties.', icon: '🥭', showInHome: true, sortOrder: 6 },
    { name: 'ড্রাগন ফ্রুট', slug: 'dragon-fruit', description: 'Fresh dragon fruit from local farms in Bangladesh.', icon: '🐉', showInHome: true, sortOrder: 7 },
    { name: 'মধু', slug: 'honey', description: 'Pure Sundarbans honey and organic honey from trusted sources.', icon: '🍯', showInHome: true, sortOrder: 8 },
    { name: 'চাল ও ডাল', slug: 'rice-grains', description: 'Premium quality rice, lentils and grains from the best harvests.', icon: '🌾', showInHome: true, sortOrder: 9 },
    { name: 'মশলা', slug: 'spices-masala', description: 'Authentic Bangladeshi spices and masala for flavorful cooking.', icon: '🌶️', showInHome: true, sortOrder: 10 },
    { name: 'মৌসুমী ফল', slug: 'seasonal-fruits', description: 'Fresh seasonal fruits from across Bangladesh.', icon: '🍑', showInHome: true, sortOrder: 11 },
  ]

  const categories: Record<string, Awaited<ReturnType<typeof prisma.category.create>>> = {}
  for (const cat of categoriesData) {
    categories[cat.slug] = await prisma.category.create({
      data: {
        ...cat,
        image: `/images/categories/${cat.slug}.svg`,
        bannerImage: `/images/categories/${cat.slug}.svg`,
        isActive: true,
        showInMenu: true,
        metaTitle: `${cat.name} - Khati Khadyo`,
        metaDescription: cat.description,
      },
    })
  }
  console.log(`  ✅ Created ${categoriesData.length} categories`)

  // ─── Subcategories ──────────────────────────────────────────────────────
  console.log('📂 Creating subcategories...')
  const subcategoriesData = [
    { name: 'আখের গুড়', slug: 'akher-gur', categoryId: categories['deshi-gur'].id, sortOrder: 1 },
    { name: 'তালের গুড়', slug: 'taler-gur', categoryId: categories['deshi-gur'].id, sortOrder: 2 },
    { name: 'ভাজা ঘি', slug: 'bhaja-ghee', categoryId: categories['ghee'].id, sortOrder: 1 },
    { name: 'দেশি ঘি', slug: 'deshi-ghee', categoryId: categories['ghee'].id, sortOrder: 2 },
    { name: 'রসগোল্লা', slug: 'rasgolla', categoryId: categories['sweets'].id, sortOrder: 1 },
    { name: 'সন্দেশ', slug: 'sandesh', categoryId: categories['sweets'].id, sortOrder: 2 },
    { name: 'মিষ্টি দই', slug: 'mishti-doi', categoryId: categories['doi-yogurt'].id, sortOrder: 1 },
    { name: 'হিমসাগর', slug: 'himsagar', categoryId: categories['mango'].id, sortOrder: 1 },
    { name: 'ল্যাংড়া', slug: 'langra', categoryId: categories['mango'].id, sortOrder: 2 },
    { name: 'সুন্দরবনের মধু', slug: 'sundarbans-honey', categoryId: categories['honey'].id, sortOrder: 1 },
    { name: 'মাছের মশলা', slug: 'fish-masala', categoryId: categories['spices-masala'].id, sortOrder: 1 },
    { name: 'বিরিয়ানি মশলা', slug: 'biryani-masala', categoryId: categories['spices-masala'].id, sortOrder: 2 },
  ]

  for (const sub of subcategoriesData) {
    await prisma.subcategory.create({
      data: {
        name: sub.name,
        slug: sub.slug,
        categoryId: sub.categoryId,
        sortOrder: sub.sortOrder,
        isActive: true,
      },
    })
  }
  console.log(`  ✅ Created ${subcategoriesData.length} subcategories`)

  // ─── Products ───────────────────────────────────────────────────────────
  console.log('📦 Creating products...')
  const productsData = [
    // Deshi Gur products
    {
      name: 'পিউর আখের গুড় (Pure Sugarcane Gur)',
      slug: 'pure-akher-gur',
      shortDescription: '100% pure sugarcane jaggery from Rajshahi. No additives or preservatives.',
      description: 'Our Pure Akher Gur is made from fresh sugarcane juice using traditional methods in Rajshahi. This golden-brown gur is rich in iron, calcium, and minerals. Perfect for making traditional sweets or enjoying with luchi and roti. No artificial colors, flavors, or preservatives are added.',
      price: 350,
      discountPrice: 299,
      unit: 'kg',
      stock: 150,
      origin: 'Rajshahi, Bangladesh',
      qualityNote: 'Lab tested for purity. No additives or preservatives.',
      categoryId: categories['deshi-gur'].id,
      isFeatured: true,
      isBestSeller: true,
      isNewArrival: false,
      tags: 'gur,jaggery,organic,traditional',
      specifications: JSON.stringify({ weight: '1kg', shelf_life: '6 months', storage: 'Cool dry place' }),
    },
    {
      name: 'তালের গুড় (Palm Jaggery)',
      slug: 'taler-gur',
      shortDescription: 'Authentic palm jaggery with rich caramel flavor.',
      description: 'Traditional Taler Gur made from palmyra palm sap. This dark, rich jaggery has a distinctive caramel flavor that is loved across Bangladesh. Sourced directly from the palm tappers of Jessore.',
      price: 450,
      discountPrice: null,
      unit: 'kg',
      stock: 80,
      origin: 'Jessore, Bangladesh',
      qualityNote: 'Fresh batch, handcrafted by traditional artisans.',
      categoryId: categories['deshi-gur'].id,
      isFeatured: false,
      isBestSeller: false,
      isNewArrival: true,
      tags: 'palm,jaggery,taler gur',
      specifications: JSON.stringify({ weight: '1kg', shelf_life: '3 months', storage: 'Refrigerate after opening' }),
    },

    // Khejurer Gur products
    {
      name: 'প্রিমিয়াম খেজুরের গুড় (Premium Date Palm Gur)',
      slug: 'premium-khejurer-gur',
      shortDescription: 'Winter special premium date palm jaggery from Faridpur.',
      description: 'The crown jewel of Bangladeshi winter - Premium Khejurer Gur from Faridpur. This soft, melt-in-mouth jaggery is made from date palm sap collected during the cold winter nights. Known as "Nolen Gur" in some regions, it is the most sought-after sweetener for making payesh, pithe, and traditional desserts.',
      price: 600,
      discountPrice: 549,
      unit: 'kg',
      stock: 200,
      origin: 'Faridpur, Bangladesh',
      qualityNote: 'Seasonal specialty. Collected and processed during peak winter season.',
      categoryId: categories['khejurer-gur'].id,
      isFeatured: true,
      isBestSeller: true,
      isNewArrival: true,
      tags: 'khejurer gur,date palm,winter,seasonal',
      specifications: JSON.stringify({ weight: '1kg', season: 'Winter (Nov-Feb)', storage: 'Refrigerate' }),
    },

    // Ghee products
    {
      name: 'খাঁটি দেশি ঘি (Pure Deshi Ghee)',
      slug: 'pure-deshi-ghee',
      shortDescription: '100% pure cow ghee made from traditional bilona method.',
      description: 'Our Khatti Deshi Ghee is made using the traditional Vedic bilona method - churning curd made from pure cow milk. This golden, aromatic ghee is rich in healthy fats, vitamins A, D, E, and K. Perfect for cooking, tempering dal, making sweets, or simply drizzling over rice.',
      price: 1200,
      discountPrice: 1050,
      unit: 'kg',
      stock: 100,
      origin: 'Sirajganj, Bangladesh',
      qualityNote: 'Made from 100% cow milk. No vanaspati or vegetable oil mixed.',
      categoryId: categories['ghee'].id,
      isFeatured: true,
      isBestSeller: true,
      isNewArrival: false,
      tags: 'ghee,pure,organic,cow milk,bilona',
      specifications: JSON.stringify({ weight: '1kg', fat_content: '99.5%', storage: 'Cool dry place', shelf_life: '12 months' }),
    },
    {
      name: 'ভাজা ঘি (Clarified Butter)',
      slug: 'bhaja-ghee',
      shortDescription: 'Perfectly roasted clarified butter for authentic flavor.',
      description: 'Bhaja Ghee is specially prepared by roasting butter to a deeper, nuttier flavor profile. Ideal for making biryani, korma, and other rich dishes that require an intense ghee flavor.',
      price: 1350,
      discountPrice: null,
      unit: 'kg',
      stock: 60,
      origin: 'Dhaka, Bangladesh',
      qualityNote: 'Small batch production for consistent quality.',
      categoryId: categories['ghee'].id,
      isFeatured: false,
      isBestSeller: false,
      isNewArrival: true,
      tags: 'ghee,bhaja,clarified butter,biryani',
      specifications: JSON.stringify({ weight: '1kg', storage: 'Cool dry place', shelf_life: '12 months' }),
    },

    // Sweets products
    {
      name: 'রসগোল্লা (Rasgolla)',
      slug: 'rasgolla',
      shortDescription: 'Soft and spongy rasgolla in light sugar syrup.',
      description: 'Our Rasgolla is made fresh daily using premium quality chhana (cottage cheese). These soft, spongy balls soaked in light cardamom-scented sugar syrup melt in your mouth. A classic Bangladeshi sweet perfect for any celebration.',
      price: 400,
      discountPrice: 350,
      unit: 'kg',
      stock: 50,
      origin: 'Comilla, Bangladesh',
      qualityNote: 'Made fresh daily. Best consumed within 2 days.',
      categoryId: categories['sweets'].id,
      isFeatured: false,
      isBestSeller: true,
      isNewArrival: false,
      tags: 'rasgolla,sweet,mishti,celebration',
      specifications: JSON.stringify({ weight: '1kg', pieces: 'Approx 20', storage: 'Refrigerate', shelf_life: '2 days' }),
    },
    {
      name: 'ক্ষীর সন্দেশ (Kheer Sandesh)',
      slug: 'kheer-sandesh',
      shortDescription: 'Delicate sandesh with rich kheer filling.',
      description: 'Premium Kheer Sandesh made from fresh chhana and thickened milk. This delicate sweet has a smooth texture and rich, creamy flavor. Each piece is crafted by master sweet makers.',
      price: 550,
      discountPrice: null,
      unit: 'kg',
      stock: 40,
      origin: 'Dhaka, Bangladesh',
      qualityNote: 'Handmade by expert sweet makers.',
      categoryId: categories['sweets'].id,
      isFeatured: true,
      isBestSeller: false,
      isNewArrival: true,
      tags: 'sandesh,sweet,kheer,premium',
      specifications: JSON.stringify({ weight: '1kg', pieces: 'Approx 16', storage: 'Refrigerate', shelf_life: '3 days' }),
    },

    // Doi/Yogurt products
    {
      name: 'মিষ্টি দই (Mishti Doi)',
      slug: 'mishti-doi',
      shortDescription: 'Traditional sweet yogurt from Bogra.',
      description: 'The famous Bograr Mishti Doi - creamy, sweet, and perfectly fermented. Made from full-fat milk and caramelized sugar, this traditional sweet yogurt is a must-have dessert. The earthen pot gives it a unique earthy aroma.',
      price: 150,
      discountPrice: null,
      unit: 'piece',
      stock: 100,
      origin: 'Bogra, Bangladesh',
      qualityNote: 'Made in traditional earthen pots for authentic flavor.',
      categoryId: categories['doi-yogurt'].id,
      isFeatured: true,
      isBestSeller: true,
      isNewArrival: false,
      tags: 'doi,yogurt,mishti,bogra,sweet',
      specifications: JSON.stringify({ weight: '250g', storage: 'Refrigerate', shelf_life: '5 days' }),
    },

    // Mango products
    {
      name: 'হিমসাগর আম (Himsagar Mango)',
      slug: 'himsagar-mango',
      shortDescription: 'Premium Himsagar mangoes - the sweetest variety from Rajshahi.',
      description: 'Himsagar is considered one of the sweetest mango varieties in the world. Grown in the orchards of Rajshahi, these fiberless, creamy mangoes are a summer delight. Each mango is hand-picked at peak ripeness for maximum sweetness.',
      price: 800,
      discountPrice: 699,
      unit: 'kg',
      stock: 300,
      origin: 'Rajshahi, Bangladesh',
      qualityNote: 'Hand-picked at optimal ripeness. Chemical-free ripening process.',
      categoryId: categories['mango'].id,
      isFeatured: true,
      isBestSeller: true,
      isNewArrival: true,
      tags: 'mango,himsagar,rajshahi,seasonal,summer',
      specifications: JSON.stringify({ weight: '1kg', variety: 'Himsagar', season: 'May-July', storage: 'Room temperature until ripe, then refrigerate' }),
    },
    {
      name: 'ল্যাংড়া আম (Langra Mango)',
      slug: 'langra-mango',
      shortDescription: 'Classic Langra mangoes with distinctive flavor from Chapainawabganj.',
      description: 'Langra mangoes are known for their unique flavor - a perfect balance of sweet and tangy. Sourced from the famous mango orchards of Chapainawabganj, these medium-sized mangoes have thin skin and very little fiber.',
      price: 650,
      discountPrice: null,
      unit: 'kg',
      stock: 250,
      origin: 'Chapainawabganj, Bangladesh',
      qualityNote: 'Naturally ripened. No carbide used.',
      categoryId: categories['mango'].id,
      isFeatured: false,
      isBestSeller: false,
      isNewArrival: true,
      tags: 'mango,langra,seasonal,summer',
      specifications: JSON.stringify({ weight: '1kg', variety: 'Langra', season: 'June-August', storage: 'Room temperature until ripe' }),
    },

    // Dragon Fruit products
    {
      name: 'লাল ড্রাগন ফ্রুট (Red Dragon Fruit)',
      slug: 'red-dragon-fruit',
      shortDescription: 'Fresh red dragon fruit from Dinajpur farms.',
      description: 'Vibrant red dragon fruit grown in the highlands of Dinajpur. This superfood is rich in antioxidants, vitamin C, and fiber. The striking magenta flesh and mild sweet flavor make it perfect for smoothies, salads, or eating fresh.',
      price: 350,
      discountPrice: 299,
      unit: 'kg',
      stock: 75,
      origin: 'Dinajpur, Bangladesh',
      qualityNote: 'Freshly harvested. Pesticide-free cultivation.',
      categoryId: categories['dragon-fruit'].id,
      isFeatured: true,
      isBestSeller: false,
      isNewArrival: true,
      tags: 'dragon fruit,exotic,superfood,organic',
      specifications: JSON.stringify({ weight: '1kg', color: 'Red', storage: 'Refrigerate', shelf_life: '5-7 days' }),
    },

    // Honey products
    {
      name: 'সুন্দরবনের খাঁটি মধু (Sundarbans Pure Honey)',
      slug: 'sundarbans-pure-honey',
      shortDescription: 'Wild honey collected from the Sundarbans mangrove forest.',
      description: 'Authentic Sundarbans honey collected by traditional honey hunters (Mawali) from the largest mangrove forest in the world. This wild honey has a unique floral taste from the diverse mangrove flowers. Rich in enzymes, antioxidants, and natural antibiotics. Each jar is lab-tested for purity.',
      price: 900,
      discountPrice: 799,
      unit: 'kg',
      stock: 120,
      origin: 'Sundarbans, Bangladesh',
      qualityNote: 'Lab tested for purity. Collected by certified honey hunters.',
      categoryId: categories['honey'].id,
      isFeatured: true,
      isBestSeller: true,
      isNewArrival: false,
      tags: 'honey,sundarbans,wild,organic,pure',
      specifications: JSON.stringify({ weight: '1kg', type: 'Wild forest honey', storage: 'Room temperature', shelf_life: '24 months' }),
    },
    {
      name: 'লিচু ফুলের মধু (Litchi Flower Honey)',
      slug: 'litchi-flower-honey',
      shortDescription: 'Pure litchi flower honey from Dinajpur orchards.',
      description: 'Premium monofloral honey collected from litchi orchards in Dinajpur. This light golden honey has a delicate floral sweetness with hints of litchi flavor. Perfect for tea, desserts, or as a natural sweetener.',
      price: 700,
      discountPrice: null,
      unit: 'kg',
      stock: 90,
      origin: 'Dinajpur, Bangladesh',
      qualityNote: 'Pure monofloral honey. No sugar syrup added.',
      categoryId: categories['honey'].id,
      isFeatured: false,
      isBestSeller: false,
      isNewArrival: true,
      tags: 'honey,litchi,monofloral,organic',
      specifications: JSON.stringify({ weight: '1kg', type: 'Monofloral', storage: 'Room temperature', shelf_life: '18 months' }),
    },

    // Rice & Grains products
    {
      name: 'মিনিকেট চাল (Miniket Rice)',
      slug: 'miniket-rice',
      shortDescription: 'Premium quality Miniket rice - fine and aromatic.',
      description: 'Premium Miniket rice known for its fine grain and aromatic quality. This is the most popular rice variety in Bangladesh, perfect for daily meals. Our Miniket rice is aged for 6 months for better texture and flavor.',
      price: 85,
      discountPrice: null,
      unit: 'kg',
      stock: 500,
      origin: 'Dinajpur, Bangladesh',
      qualityNote: '6-month aged rice for superior cooking quality.',
      categoryId: categories['rice-grains'].id,
      isFeatured: false,
      isBestSeller: true,
      isNewArrival: false,
      tags: 'rice,miniket,premium,aged',
      specifications: JSON.stringify({ weight: '1kg', grain: 'Fine', aging: '6 months', storage: 'Cool dry place' }),
    },

    // Spices/Masala products
    {
      name: 'হালদি গুঁড়া (Turmeric Powder)',
      slug: 'turmeric-powder',
      shortDescription: 'Pure turmeric powder from Rangamati - no color added.',
      description: 'Our pure turmeric powder is made from handpicked turmeric roots from the hills of Rangamati. Stone-ground for maximum flavor and curcumin content. No artificial colors or fillers added. Essential for authentic Bangladeshi cooking.',
      price: 250,
      discountPrice: 219,
      unit: 'kg',
      stock: 200,
      origin: 'Rangamati, Bangladesh',
      qualityNote: 'Stone-ground. No artificial colors or preservatives.',
      categoryId: categories['spices-masala'].id,
      isFeatured: false,
      isBestSeller: true,
      isNewArrival: false,
      tags: 'turmeric,haldi,spice,pure,organic',
      specifications: JSON.stringify({ weight: '500g', type: 'Powder', storage: 'Cool dry place', shelf_life: '12 months' }),
    },
  ]

  const products: Record<string, Awaited<ReturnType<typeof prisma.product.create>>> = {}
  for (const prod of productsData) {
    products[prod.slug] = await prisma.product.create({
      data: {
        name: prod.name,
        slug: prod.slug,
        shortDescription: prod.shortDescription,
        description: prod.description,
        price: prod.price,
        discountPrice: prod.discountPrice,
        unit: prod.unit,
        stock: prod.stock,
        origin: prod.origin,
        qualityNote: prod.qualityNote,
        categoryId: prod.categoryId,
        isFeatured: prod.isFeatured,
        isBestSeller: prod.isBestSeller,
        isNewArrival: prod.isNewArrival,
        tags: prod.tags,
        specifications: prod.specifications,
        status: 'active',
        metaTitle: `${prod.name} - Khati Khadyo`,
        metaDescription: prod.shortDescription,
      },
    })

    // Add product image for each product
    await prisma.productImage.create({
      data: {
        productId: products[prod.slug].id,
        url: `/images/products/${prod.slug}.svg`,
        alt: prod.name,
        sortOrder: 0,
        isFeatured: true,
      },
    })

    // Add a second image for some products
    if (prod.isFeatured || prod.isBestSeller) {
      await prisma.productImage.create({
        data: {
          productId: products[prod.slug].id,
          url: `/images/products/${prod.slug}-2.svg`,
          alt: `${prod.name} - View 2`,
          sortOrder: 1,
          isFeatured: false,
        },
      })
    }
  }
  console.log(`  ✅ Created ${productsData.length} products with images`)

  // ─── Reviews ────────────────────────────────────────────────────────────
  console.log('⭐ Creating reviews...')
  const reviewsData = [
    { productSlug: 'pure-akher-gur', rating: 5, comment: 'Excellent quality gur! Tastes just like the one my grandmother used to make. Will order again.', isVerified: true, isApproved: true },
    { productSlug: 'pure-deshi-ghee', rating: 5, comment: 'This is the real deal. Pure ghee with amazing aroma. You can tell the difference from the first smell.', isVerified: true, isApproved: true },
    { productSlug: 'pure-deshi-ghee', rating: 4, comment: 'Good quality ghee. A bit pricey but worth it for the purity.', isVerified: true, isApproved: true },
    { productSlug: 'premium-khejurer-gur', rating: 5, comment: 'Winter in a jar! The taste is absolutely divine. Best khejurer gur I have had in years.', isVerified: true, isApproved: true },
    { productSlug: 'sundarbans-pure-honey', rating: 5, comment: 'Authentic Sundarbans honey. Thick, golden, and incredibly flavorful. This is the real thing!', isVerified: true, isApproved: true },
    { productSlug: 'himsagar-mango', rating: 5, comment: 'Sweetest mangoes I have ever tasted! Arrived perfectly ripe. Will definitely order more.', isVerified: true, isApproved: true },
    { productSlug: 'mishti-doi', rating: 4, comment: 'Reminded me of Bogra. The earthen pot makes all the difference. Very authentic taste.', isVerified: true, isApproved: true },
    { productSlug: 'miniket-rice', rating: 4, comment: 'Good quality rice. Cooks well and the grains remain separate. Best for daily use.', isVerified: true, isApproved: true },
    { productSlug: 'red-dragon-fruit', rating: 5, comment: 'Beautiful color and very fresh! Great for smoothie bowls. My kids love it.', isVerified: true, isApproved: true },
    { productSlug: 'turmeric-powder', rating: 4, comment: 'Rich golden color, no artificial additives. You can smell the purity.', isVerified: true, isApproved: true },
  ]

  for (const review of reviewsData) {
    await prisma.review.create({
      data: {
        userId: customer.id,
        productId: products[review.productSlug].id,
        rating: review.rating,
        comment: review.comment,
        isVerified: review.isVerified,
        isApproved: review.isApproved,
        isActive: true,
      },
    })
  }
  console.log(`  ✅ Created ${reviewsData.length} reviews`)

  // ─── Banners ────────────────────────────────────────────────────────────
  console.log('🖼️  Creating banners...')
  const bannersData = [
    {
      title: 'দেশি গুড়ের মৌসুম - Deshi Gur Season',
      subtitle: 'খাঁটি দেশি গুড়, সরাসরি কৃষক থেকে',
      description: 'Get pure, authentic Deshi Gur directly from the farmers. No middlemen, no adulteration. Just pure, traditional taste.',
      desktopImage: '/images/banners/deshi-gur-season.svg',
      mobileImage: '/images/banners/deshi-gur-season.svg',
      link: '/products?category=deshi-gur',
      ctaText: 'অর্ডার করুন - Order Now',
      ctaLink: '/products?category=deshi-gur',
      bgColor: '#8B4513',
      textColor: '#FFFFFF',
      sortOrder: 1,
      location: 'hero',
      startDate: null,
      endDate: null,
    },
    {
      title: 'আমের মৌসুম - Mango Season is Here!',
      subtitle: 'রাজশাহীর সেরা আম, ঘরে বসে অর্ডার করুন',
      description: 'The sweetest mangoes from Rajshahi are now available. Himsagar, Langra, Fazli - order your favorites before the season ends!',
      desktopImage: '/images/banners/mango-season.svg',
      mobileImage: '/images/banners/mango-season.svg',
      link: '/products?category=mango',
      ctaText: 'আম অর্ডার করুন',
      ctaLink: '/products?category=mango',
      bgColor: '#FF8C00',
      textColor: '#FFFFFF',
      sortOrder: 2,
      location: 'hero',
      startDate: null,
      endDate: null,
    },
    {
      title: 'সুন্দরবনের খাঁটি মধু - Sundarbans Pure Honey',
      subtitle: '১০০% খাঁটি, ল্যাব টেস্টেড',
      description: 'Direct from the Sundarbans - pure, wild honey collected by traditional honey hunters. Lab tested and certified.',
      desktopImage: '/images/banners/sundarbans-honey.svg',
      mobileImage: '/images/banners/sundarbans-honey.svg',
      link: '/products?category=honey',
      ctaText: 'মধু দেখুন - Shop Honey',
      ctaLink: '/products?category=honey',
      bgColor: '#DAA520',
      textColor: '#FFFFFF',
      sortOrder: 3,
      location: 'hero',
      startDate: null,
      endDate: null,
    },
    {
      title: 'Free Delivery on Orders Over ৳500',
      subtitle: 'ফ্রি ডেলিভারি ৫০০ টাকার উপরে অর্ডারে',
      description: '',
      desktopImage: '/images/banners/free-delivery.svg',
      mobileImage: null,
      link: '/products',
      ctaText: 'Shop Now',
      ctaLink: '/products',
      bgColor: '#2D6A4F',
      textColor: '#FFFFFF',
      sortOrder: 1,
      location: 'announcement',
      startDate: null,
      endDate: null,
    },
  ]

  for (const banner of bannersData) {
    await prisma.banner.create({ data: banner })
  }
  console.log(`  ✅ Created ${bannersData.length} banners`)

  // ─── Homepage Sections ──────────────────────────────────────────────────
  console.log('🏠 Creating homepage sections...')
  const homepageSectionsData = [
    {
      title: 'New Arrivals',
      type: 'product_grid',
      subtitle: 'নতুন পণ্যসমূহ - Fresh additions to our collection',
      sortOrder: 1,
      layout: 'carousel',
      limit: 8,
      isActive: true,
    },
    {
      title: 'Best Sellers',
      type: 'product_grid',
      subtitle: 'সর্বাধিক বিক্রিত - Our most popular products',
      sortOrder: 2,
      layout: 'grid',
      limit: 8,
      isActive: true,
    },
    {
      title: 'দেশি গুড় - Deshi Gur Collection',
      type: 'category',
      subtitle: 'খাঁটি দেশি গুড়, সরাসরি কৃষক থেকে',
      categoryId: categories['deshi-gur'].id,
      sortOrder: 3,
      layout: 'featured',
      limit: 4,
      isActive: true,
    },
    {
      title: 'Quality Promise',
      type: 'features',
      subtitle: 'আমাদের মানের প্রতিশ্রুতি - Why choose Khati Khadyo',
      content: JSON.stringify([
        { icon: 'shield-check', title: '100% Authentic', description: 'All products are verified for authenticity and purity' },
        { icon: 'truck', title: 'Fast Delivery', description: 'Quick delivery across Bangladesh with proper packaging' },
        { icon: 'leaf', title: 'Natural & Organic', description: 'Chemical-free, naturally processed food products' },
        { icon: 'award', title: 'Quality Tested', description: 'Lab tested for purity and safety standards' },
      ]),
      sortOrder: 4,
      layout: 'grid',
      limit: 4,
      isActive: true,
    },
    {
      title: 'Customer Reviews',
      type: 'testimonial',
      subtitle: 'আমাদের গ্রাহকদের মতামত - What our customers say',
      sortOrder: 5,
      layout: 'carousel',
      limit: 6,
      isActive: true,
    },
    {
      title: 'Special Offers',
      type: 'promo',
      subtitle: 'বিশেষ অফার - Limited time deals',
      content: JSON.stringify({
        title: 'Summer Special Sale!',
        description: 'Get up to 20% off on seasonal fruits and organic products',
        ctaText: 'Shop Offers',
        ctaLink: '/offers',
        bgColor: '#2D6A4F',
        textColor: '#FFFFFF',
      }),
      image: '/images/banners/special-offers.svg',
      bgColor: '#2D6A4F',
      sortOrder: 6,
      layout: 'featured',
      limit: 4,
      isActive: true,
    },
    {
      title: 'মধু কালেকশন - Honey Collection',
      type: 'category',
      subtitle: 'খাঁটি মধু, সুন্দরবন থেকে',
      categoryId: categories['honey'].id,
      sortOrder: 7,
      layout: 'grid',
      limit: 4,
      isActive: true,
    },
  ]

  for (const section of homepageSectionsData) {
    await prisma.homepageSection.create({ data: section })
  }
  console.log(`  ✅ Created ${homepageSectionsData.length} homepage sections`)

  // ─── Menu Items ─────────────────────────────────────────────────────────
  console.log('🧭 Creating menu items...')
  const menuItemsData = [
    { label: 'Home', url: '/', icon: 'home', sortOrder: 1, location: 'main' },
    { label: 'Products', url: '/products', icon: 'shopping-bag', sortOrder: 2, location: 'main' },
    { label: 'Categories', url: '/categories', icon: 'grid', sortOrder: 3, location: 'main' },
    { label: 'Offers', url: '/offers', icon: 'tag', sortOrder: 4, location: 'main' },
    { label: 'About Us', url: '/about', icon: 'info', sortOrder: 5, location: 'main' },
    { label: 'Quality Promise', url: '/quality-promise', icon: 'shield-check', sortOrder: 6, location: 'main' },
    { label: 'Contact', url: '/contact', icon: 'phone', sortOrder: 7, location: 'main' },
    // Footer menu items
    { label: 'Privacy Policy', url: '/privacy', sortOrder: 1, location: 'footer' },
    { label: 'Terms & Conditions', url: '/terms', sortOrder: 2, location: 'footer' },
    { label: 'Return Policy', url: '/return-policy', sortOrder: 3, location: 'footer' },
    { label: 'Delivery Policy', url: '/delivery-policy', sortOrder: 4, location: 'footer' },
    { label: 'FAQ', url: '/faq', sortOrder: 5, location: 'footer' },
  ]

  for (const item of menuItemsData) {
    await prisma.menuItem.create({ data: { ...item, isActive: true, openInNew: false } })
  }
  console.log(`  ✅ Created ${menuItemsData.length} menu items`)

  // ─── Policy Pages ───────────────────────────────────────────────────────
  console.log('📄 Creating policy pages...')
  const policyPagesData = [
    {
      slug: 'about',
      title: 'About Khati Khadyo - খাটি খাদ্য সম্পর্কে',
      content: `# About Khati Khadyo

## খাটি খাদ্য - Authentic Bangladeshi Food Products

Khati Khadyo was founded with a simple mission: to bring authentic, pure, and traditional Bangladeshi food products directly to your doorstep.

### Our Story

In a market flooded with adulterated and low-quality food products, we saw the need for a trusted platform that guarantees authenticity. Our journey began when we realized how difficult it was for urban consumers to access genuine deshi ghee, pure honey, and traditional gur without worrying about quality.

### What We Do

We partner directly with farmers, artisans, and traditional food makers across Bangladesh to bring you:

- **Pure Deshi Ghee** - Made using traditional bilona method
- **Sundarbans Honey** - Collected by traditional honey hunters
- **Deshi Gur** - From the best jaggery makers in Rajshahi and Faridpur
- **Seasonal Fruits** - Fresh from the orchards of Rajshahi and Dinajpur
- **Traditional Sweets** - From renowned sweet makers
- **Authentic Spices** - Stone-ground and pure

### Our Mission

To preserve and promote Bangladeshi culinary heritage by ensuring that traditional, pure food products remain accessible to everyone. We believe that food is not just sustenance - it is culture, tradition, and identity.

### Our Values

1. **Authenticity** - Every product is verified for purity
2. **Fair Trade** - Farmers and artisans get fair prices
3. **Quality** - No compromise on product quality
4. **Sustainability** - Supporting sustainable farming practices
5. **Transparency** - Full traceability from farm to table`,
      metaTitle: 'About Khati Khadyo - Our Story & Mission',
      metaDescription: 'Learn about Khati Khadyo - our mission to bring authentic Bangladeshi food products directly from farmers to your doorstep.',
    },
    {
      slug: 'quality-promise',
      title: 'Quality Promise - মানের প্রতিশ্রুতি',
      content: `# Quality Promise - মানের প্রতিশ্রুতি

At Khati Khadyo, quality is not just a promise - it is our foundation.

## Our Quality Standards

### 1. Source Verification
Every product is sourced directly from verified farmers and artisans. We visit the production facilities, meet the makers, and ensure that traditional methods are followed.

### 2. Lab Testing
Key products like honey, ghee, and gur undergo laboratory testing to check for:
- Purity and authenticity
- Absence of adulterants
- Compliance with food safety standards

### 3. Freshness Guarantee
We maintain a strict inventory system to ensure that:
- Products are shipped within their peak freshness period
- Proper storage conditions are maintained
- Expiry dates are clearly mentioned

### 4. Packaging Standards
- Food-grade packaging materials
- Proper sealing to prevent contamination
- Temperature-controlled packaging for perishable items

### 5. No Additives Policy
We do not sell products that contain:
- Artificial preservatives
- Synthetic food colors
- Chemical additives
- Added sugar in natural products

## Our Promise to You

If you are not satisfied with the quality of any product, we offer:
- Full refund or replacement
- No questions asked return policy
- Direct communication with our quality team`,
      metaTitle: 'Quality Promise - Khati Khadyo Quality Standards',
      metaDescription: 'Our quality promise: lab-tested, authentic, and pure Bangladeshi food products with full traceability from farm to table.',
    },
    {
      slug: 'delivery-policy',
      title: 'Delivery Policy - ডেলিভারি নীতি',
      content: `# Delivery Policy - ডেলিভারি নীতি

## Delivery Areas

We currently deliver across Bangladesh including:
- All divisional cities (Dhaka, Chittagong, Rajshahi, Khulna, Sylhet, Barisal, Rangpur, Mymensingh)
- Major district towns
- Select upazila areas

## Delivery Timelines

| Area | Estimated Delivery Time |
|------|----------------------|
| Dhaka City | 1-2 business days |
| Chittagong City | 2-3 business days |
| Other Divisional Cities | 3-4 business days |
| District Towns | 4-5 business days |
| Remote Areas | 5-7 business days |

## Delivery Charges

- Standard delivery charge: **৳60**
- **FREE delivery** on orders over **৳500**
- Express delivery (Dhaka only): ৳120

## Important Notes

1. Delivery times may vary during holidays and natural calamities
2. Perishable items are shipped with special packaging
3. Someone must be available to receive the delivery
4. We use trusted courier partners for safe delivery`,
      metaTitle: 'Delivery Policy - Khati Khadyo Shipping Information',
      metaDescription: 'Learn about Khati Khadyo delivery policy: delivery areas, timelines, charges, and free delivery on orders over ৳500.',
    },
    {
      slug: 'return-policy',
      title: 'Return Policy - রিটার্ন নীতি',
      content: `# Return Policy - রিটার্ন নীতি

We want you to be completely satisfied with your purchase. If you are not happy with any product, we are here to help.

## Return Eligibility

Products can be returned within **48 hours** of delivery if:

1. The product is damaged during delivery
2. The product is different from what was ordered
3. The product quality does not match the description
4. The product is expired or near expiry upon delivery

## Non-Returnable Items

- Perishable items (fruits, dairy products) once opened
- Products with broken seals (unless damaged)
- Items returned after 48 hours of delivery

## How to Return

1. Contact our customer support within 48 hours
2. Provide your order number and photos of the issue
3. Our team will review and approve the return
4. We will arrange pickup or ask you to ship the item back
5. Refund or replacement will be processed within 3-5 business days

## Refund Process

- Refunds are processed to the original payment method
- For COD orders, bank transfer or mobile banking refund
- Processing time: 3-5 business days after receiving the return`,
      metaTitle: 'Return Policy - Khati Khadyo Returns & Refunds',
      metaDescription: 'Khati Khadyo return policy: easy returns within 48 hours, full refunds, and hassle-free replacement for quality issues.',
    },
    {
      slug: 'terms',
      title: 'Terms & Conditions - শর্তাবলী',
      content: `# Terms & Conditions - শর্তাবলী

By using the Khati Khadyo website and services, you agree to the following terms:

## General Terms

1. You must be at least 18 years old to place orders
2. All prices are in Bangladeshi Taka (BDT)
3. Prices may change without prior notice
4. Product images are for reference and may vary slightly

## Ordering

1. An order is confirmed only after payment verification
2. We reserve the right to cancel orders due to stock unavailability
3. Bulk orders may require advance payment
4. Order modifications must be requested before shipping

## Payment

1. We accept: Cash on Delivery (COD), bKash, Nagad, Rocket, and Card payments
2. Online payments are processed through secure gateways
3. COD orders above ৳5,000 may require partial advance payment

## Intellectual Property

All content on this website including text, images, logos, and designs are property of Khati Khadyo and protected by copyright laws.

## Limitation of Liability

Khati Khadyo is not liable for any indirect, incidental, or consequential damages arising from the use of our products or services.

## Changes to Terms

We reserve the right to modify these terms at any time. Continued use of our services constitutes acceptance of the updated terms.`,
      metaTitle: 'Terms & Conditions - Khati Khadyo',
      metaDescription: 'Read the terms and conditions for using Khati Khadyo services, including ordering, payment, and general policies.',
    },
    {
      slug: 'privacy',
      title: 'Privacy Policy - গোপনীয়তা নীতি',
      content: `# Privacy Policy - গোপনীয়তা নীতি

At Khati Khadyo, we take your privacy seriously.

## Information We Collect

1. **Personal Information**: Name, email, phone number, delivery address
2. **Payment Information**: Processed through secure payment gateways (we do not store card details)
3. **Usage Data**: Browsing patterns, pages visited, search queries
4. **Device Information**: Browser type, IP address, device type

## How We Use Your Information

- Process and deliver orders
- Send order updates and notifications
- Improve our services and user experience
- Send promotional offers (with your consent)
- Comply with legal requirements

## Data Protection

1. All personal data is encrypted and stored securely
2. We never sell your personal information to third parties
3. Access to customer data is restricted to authorized personnel only
4. Regular security audits are conducted

## Cookies

We use cookies to:
- Remember your preferences
- Analyze website traffic
- Improve user experience
- Enable shopping cart functionality

## Your Rights

You can:
- Access your personal data
- Request data modification
- Delete your account and data
- Opt out of marketing communications
- Request a copy of your data

## Contact

For privacy-related queries: privacy@khatikhadyo.com`,
      metaTitle: 'Privacy Policy - Khati Khadyo Data Protection',
      metaDescription: 'Learn how Khati Khadyo protects your personal information and data privacy. Read our complete privacy policy.',
    },
    {
      slug: 'faq',
      title: 'Frequently Asked Questions - সাধারণ জিজ্ঞাসা',
      content: `# Frequently Asked Questions - সাধারণ জিজ্ঞাসা

## Ordering

**How do I place an order?**
Browse our products, add items to your cart, and proceed to checkout. You can pay using COD, bKash, Nagad, Rocket, or card payment.

**Can I modify my order after placing it?**
Contact our support team immediately. We can modify orders that have not yet been shipped.

## Delivery

**What are the delivery charges?**
Standard delivery is ৳60. Free delivery on orders over ৳500.

**How long does delivery take?**
1-2 days in Dhaka, 3-5 days in other cities, and 5-7 days in remote areas.

## Quality

**How do you ensure product quality?**
All products are sourced directly from verified farmers and artisans. Key products undergo lab testing for purity and safety.

**Are your products organic?**
Most of our products are naturally produced without chemicals. We clearly label certified organic products.

## Returns

**What is your return policy?**
You can return products within 48 hours if there are quality issues or delivery damage. See our Return Policy page for details.

## Payment

**What payment methods do you accept?**
Cash on Delivery (COD), bKash, Nagad, Rocket, and debit/credit cards.`,
      metaTitle: 'FAQ - Frequently Asked Questions | Khati Khadyo',
      metaDescription: 'Find answers to common questions about ordering, delivery, quality, returns, and payment at Khati Khadyo.',
    },
  ]

  for (const page of policyPagesData) {
    await prisma.policyPage.create({ data: page })
  }
  console.log(`  ✅ Created ${policyPagesData.length} policy pages`)

  // ─── Testimonials ───────────────────────────────────────────────────────
  console.log('💬 Creating testimonials...')
  const testimonialsData = [
    {
      name: 'Fatima Begum',
      role: 'Home Chef',
      content: 'I have been ordering from Khati Khadyo for 6 months now. The quality of their ghee and honey is unmatched. As a home chef, I need authentic ingredients, and Khati Khadyo never disappoints. Their Sundarbans honey has become a staple in my kitchen!',
      rating: 5,
      image: '/images/testimonials/fatima.svg',
      sortOrder: 1,
    },
    {
      name: 'Rafiq Ahmed',
      role: 'Restaurant Owner',
      content: 'As a restaurant owner, finding authentic Bangladeshi ingredients was always a challenge. Khati Khadyo has solved that problem. Their spices are incredibly fresh, and the ghee adds an authentic flavor to our dishes. My customers can taste the difference!',
      rating: 5,
      image: '/images/testimonials/rafiq.svg',
      sortOrder: 2,
    },
    {
      name: 'Nusrat Jahan',
      role: 'Working Mother',
      content: 'Khati Khadyo has made it so easy to get pure, authentic food products delivered to my door. My children love their Mishti Doi, and I trust the quality completely. The free delivery on orders over ৳500 is a great bonus!',
      rating: 4,
      image: '/images/testimonials/nusrat.svg',
      sortOrder: 3,
    },
    {
      name: 'Dr. Kamal Hossain',
      role: 'Nutritionist',
      content: 'I recommend Khati Khadyo to my patients because of their commitment to purity. Their lab-tested honey and chemical-free spices are exactly what health-conscious consumers need. The transparency in sourcing is commendable.',
      rating: 5,
      image: '/images/testimonials/kamal.svg',
      sortOrder: 4,
    },
  ]

  for (const testimonial of testimonialsData) {
    await prisma.testimonial.create({ data: testimonial })
  }
  console.log(`  ✅ Created ${testimonialsData.length} testimonials`)

  // ─── FAQ Items ──────────────────────────────────────────────────────────
  console.log('❓ Creating FAQ items...')
  const faqItemsData = [
    {
      question: 'আপনাদের পণ্য কি খাঁটি? - Are your products authentic?',
      answer: 'Yes, absolutely! All our products are sourced directly from verified farmers and traditional artisans across Bangladesh. Key products like honey, ghee, and gur undergo laboratory testing for purity and safety. We provide certificates of authenticity for tested products.',
      category: 'Quality',
      sortOrder: 1,
    },
    {
      question: 'ডেলিভারি কতদিনে হয়? - How long does delivery take?',
      answer: 'Delivery times vary by location: Dhaka City (1-2 business days), Chittagong City (2-3 business days), Other Divisional Cities (3-4 business days), District Towns (4-5 business days), and Remote Areas (5-7 business days). Express delivery is available in Dhaka for ৳120.',
      category: 'Delivery',
      sortOrder: 2,
    },
    {
      question: 'কি পেমেন্ট মেথড আছে? - What payment methods do you accept?',
      answer: 'We accept multiple payment methods: Cash on Delivery (COD), bKash, Nagad, Rocket, and debit/credit cards. For COD orders above ৳5,000, we may require partial advance payment. Online payments are processed through secure SSL-encrypted gateways.',
      category: 'Payment',
      sortOrder: 3,
    },
    {
      question: 'রিটার্ন পলিসি কি? - What is the return policy?',
      answer: 'You can return products within 48 hours of delivery if there are quality issues, delivery damage, wrong items, or expired products. Simply contact our customer support with your order number and photos of the issue. We offer full refund or replacement. Perishable items once opened are non-returnable.',
      category: 'Returns',
      sortOrder: 4,
    },
    {
      question: 'বালক পণ্য কি আলাদাভাবে প্যাক করা হয়? - Are perishable items packaged separately?',
      answer: 'Yes! Perishable items like dairy products, fresh fruits, and meat are packaged using temperature-controlled packaging with ice packs. We use insulated boxes and ensure proper sealing to maintain freshness during transit. Special handling instructions are included with each order.',
      category: 'Delivery',
      sortOrder: 5,
    },
    {
      question: 'কুপন কোড কিভাবে ব্যবহার করব? - How do I use a coupon code?',
      answer: 'Add products to your cart and proceed to checkout. On the checkout page, you will find a "Coupon Code" field. Enter your coupon code and click "Apply". The discount will be reflected in your order total immediately. Only one coupon can be used per order.',
      category: 'Payment',
      sortOrder: 6,
    },
    {
      question: 'পাইকারি অর্ডার কি সম্ভব? - Can I place bulk/wholesale orders?',
      answer: 'Yes, we accept bulk and wholesale orders! For orders above ৳10,000, please contact us at info@khatikhadyo.com or call +8801712345678. We offer special discounts for bulk orders and can arrange custom packaging for corporate gifting.',
      category: 'Ordering',
      sortOrder: 7,
    },
  ]

  for (const faq of faqItemsData) {
    await prisma.fAQItem.create({ data: faq })
  }
  console.log(`  ✅ Created ${faqItemsData.length} FAQ items`)

  // ─── Team Members ───────────────────────────────────────────────────────
  console.log('👥 Creating team members...')
  const teamMembersData = [
    {
      name: 'Karim Uddin',
      role: 'Founder & CEO',
      bio: 'With over 15 years of experience in the food industry, Karim founded Khati Khadyo with a vision to bring authentic Bangladeshi food products to every household. His passion for quality and tradition drives the company forward.',
      image: '/images/team/karim.svg',
      email: 'karim@khatikhadyo.com',
      phone: '+8801711111111',
      sortOrder: 1,
    },
    {
      name: 'Salma Akter',
      role: 'Head of Quality Assurance',
      bio: 'Salma brings 10 years of food safety expertise to Khati Khadyo. She oversees our lab testing program and ensures every product meets our strict quality standards before reaching customers.',
      image: '/images/team/salma.svg',
      email: 'salma@khatikhadyo.com',
      phone: '+8801722222222',
      sortOrder: 2,
    },
    {
      name: 'Imran Hossain',
      role: 'Supply Chain Manager',
      bio: 'Imran manages our network of over 200 farmers and artisans across Bangladesh. His deep connections in rural Bangladesh ensure we source the best products directly from the producers.',
      image: '/images/team/imran.svg',
      email: 'imran@khatikhadyo.com',
      phone: '+8801733333333',
      sortOrder: 3,
    },
  ]

  for (const member of teamMembersData) {
    await prisma.teamMember.create({ data: member })
  }
  console.log(`  ✅ Created ${teamMembersData.length} team members`)

  // ─── Partners ───────────────────────────────────────────────────────────
  console.log('🤝 Creating partners...')
  const partnersData = [
    {
      name: 'Bangladesh Agricultural Research Institute',
      logo: '/images/partners/bari.svg',
      url: 'https://www.bari.gov.bd',
      sortOrder: 1,
    },
    {
      name: 'Sundarbans Honey Collectors Association',
      logo: '/images/partners/sundarbans-honey.svg',
      url: null,
      sortOrder: 2,
    },
    {
      name: 'Dinajpur Organic Farmers Cooperative',
      logo: '/images/partners/dinajpur-organic.svg',
      url: null,
      sortOrder: 3,
    },
    {
      name: 'Rajshahi Mango Growers Association',
      logo: '/images/partners/rajshahi-mango.svg',
      url: null,
      sortOrder: 4,
    },
  ]

  for (const partner of partnersData) {
    await prisma.partner.create({ data: partner })
  }
  console.log(`  ✅ Created ${partnersData.length} partners`)

  // ─── Coupons ────────────────────────────────────────────────────────────
  console.log('🎫 Creating coupons...')
  const couponsData = [
    {
      code: 'WELCOME10',
      type: 'percentage',
      value: 10,
      minOrder: 300,
      maxDiscount: 200,
      usageLimit: 1000,
      usedCount: 0,
      validFrom: new Date('2024-01-01'),
      validTo: new Date('2025-12-31'),
      isActive: true,
    },
    {
      code: 'SUMMER20',
      type: 'percentage',
      value: 20,
      minOrder: 500,
      maxDiscount: 500,
      usageLimit: 500,
      usedCount: 0,
      validFrom: new Date('2024-06-01'),
      validTo: new Date('2024-08-31'),
      isActive: true,
    },
  ]

  for (const coupon of couponsData) {
    await prisma.coupon.create({ data: coupon })
  }
  console.log(`  ✅ Created ${couponsData.length} coupons`)

  console.log('\n🎉 Seeding completed successfully!')
  console.log('\n📋 Summary:')
  console.log(`  Users: 2`)
  console.log(`  Site Config: ${siteConfigs.length}`)
  console.log(`  Categories: ${categoriesData.length}`)
  console.log(`  Subcategories: ${subcategoriesData.length}`)
  console.log(`  Products: ${productsData.length}`)
  console.log(`  Reviews: ${reviewsData.length}`)
  console.log(`  Banners: ${bannersData.length}`)
  console.log(`  Homepage Sections: ${homepageSectionsData.length}`)
  console.log(`  Menu Items: ${menuItemsData.length}`)
  console.log(`  Policy Pages: ${policyPagesData.length}`)
  console.log(`  Testimonials: ${testimonialsData.length}`)
  console.log(`  FAQ Items: ${faqItemsData.length}`)
  console.log(`  Team Members: ${teamMembersData.length}`)
  console.log(`  Partners: ${partnersData.length}`)
  console.log(`  Coupons: ${couponsData.length}`)
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
