'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  Send,
  ChevronRight,
  ArrowUp,
  ShieldCheck,
  Truck,
  RotateCcw,
  Lock,
  Clock,
  CheckCircle2,
  Heart,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useAppStore, type PageName } from '@/lib/store'
import { extractItems } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FooterMenuItem {
  id: string
  label: string
  url: string
  children?: { id: string; label: string; url: string }[]
}

interface CategoryItem {
  id: string
  name: string
  slug: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Footer() {
  const { siteConfig, navigate } = useAppStore()

  const [footerMenuItems, setFooterMenuItems] = useState<FooterMenuItem[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [showBackToTop, setShowBackToTop] = useState(false)

  // ── Scroll listener for back to top button ──
  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 600)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // ── Footer menu items (menu management feature removed; use quickLinks fallback) ──

  // ── Load categories ──
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/categories?isActive=true&showInMenu=true&limit=20')
        if (res.ok) {
          const json = await res.json()
          const cats = extractItems<CategoryItem>(json)
          setCategories(cats)
        }
      } catch {
        // Use defaults
      }
    }
    fetchCategories()
  }, [])

  const handleNavClick = (url: string) => {
    const clean = url.replace(/^\/#?/, '').replace(/\/$/, '')
    const pageMap: Record<string, PageName> = {
      '': 'home',
      home: 'home',
      products: 'products',
      offers: 'products',
      about: 'home',
      contact: 'contact',
      faq: 'contact',
      'quality-promise': 'home',
      'delivery-policy': 'delivery-policy',
      'return-policy': 'return-policy',
      terms: 'terms',
      privacy: 'privacy',
    }
    const page = pageMap[clean] || 'home'
    navigate(page)
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const siteName = siteConfig?.siteName || 'Khati Khadyo'
  const tagline = siteConfig?.tagline || 'Authentic Bangladeshi Food Products'
  const description =
    siteConfig?.description ||
    'Premium authentic Bangladeshi food products delivered fresh to your doorstep.'
  const phone = siteConfig?.phone || '+880 1XXX-XXXXXX'
  const email = siteConfig?.email || 'info@khatikhadyo.com'
  const address = siteConfig?.address || 'Dhaka, Bangladesh'
  const socialLinks = siteConfig?.socialLinks || {}
  const currentYear = new Date().getFullYear()

  const quickLinks: { label: string; href: string }[] = [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products' },
    { label: 'Offers', href: '/products' },
    { label: 'Contact', href: '/contact' },
  ]

  const policyLinks: { label: string; href: string }[] = [
    { label: 'Delivery Policy', href: '/delivery-policy' },
    { label: 'Return Policy', href: '/return-policy' },
    { label: 'Terms & Conditions', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy-policy' },
  ]

  // Trust badges data
  const trustBadges = [
    { icon: ShieldCheck, title: '100% Authentic', subtitle: 'Genuine Products', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { icon: Truck, title: 'Free Delivery', subtitle: 'Over ৳1,500', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    { icon: RotateCcw, title: 'Easy Returns', subtitle: '7-Day Policy', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
    { icon: Lock, title: 'Secure Payment', subtitle: 'SSL Encrypted', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  ]

  // Social links config
  const socialButtons = [
    { key: 'facebook', href: socialLinks.facebook || '#', icon: Facebook, label: 'Facebook', alwaysShow: true, hoverColor: 'hover:bg-blue-600 hover:text-white', hoverRing: 'group-hover:ring-blue-600/30' },
    { key: 'instagram', href: socialLinks.instagram, icon: Instagram, label: 'Instagram', alwaysShow: false, hoverColor: 'hover:bg-gradient-to-br hover:from-purple-600 hover:to-pink-500 hover:text-white', hoverRing: 'group-hover:ring-pink-500/30' },
    { key: 'twitter', href: socialLinks.twitter, icon: Twitter, label: 'Twitter', alwaysShow: false, hoverColor: 'hover:bg-sky-500 hover:text-white', hoverRing: 'group-hover:ring-sky-500/30' },
    { key: 'youtube', href: socialLinks.youtube, icon: Youtube, label: 'YouTube', alwaysShow: false, hoverColor: 'hover:bg-red-600 hover:text-white', hoverRing: 'group-hover:ring-red-600/30' },
    { key: 'whatsapp', href: `https://wa.me/${phone.replace(/[^0-9]/g, '')}`, icon: MessageCircle, label: 'WhatsApp', alwaysShow: true, hoverColor: 'hover:bg-emerald-500 hover:text-white', hoverRing: 'group-hover:ring-emerald-500/30' },
  ]

  return (
    <footer className="mt-auto relative overflow-hidden">
      {/* ── Trust Badges Row ── */}
      <div className="relative bg-gradient-to-r from-emerald-800 via-emerald-900 to-emerald-800 border-t border-white/5">
        <div className="absolute inset-0 opacity-[0.04]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="trust-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M0 20h40M20 0v40" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#trust-pattern)" />
          </svg>
        </div>
        <div className="w-full max-w-[1600px] mx-auto px-4 py-6 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {trustBadges.map((badge, idx) => (
              <motion.div
                key={badge.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.4 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl ${badge.bg} border ${badge.border} backdrop-blur-sm group hover:scale-[1.02] transition-transform duration-200`}
              >
                <div className={`size-10 rounded-lg ${badge.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200`}>
                  <badge.icon className={`h-5 w-5 ${badge.color}`} />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-tight">{badge.title}</p>
                  <p className="text-white/50 text-[11px] leading-tight">{badge.subtitle}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Footer Content ── */}
      <div className="relative bg-gradient-to-b from-emerald-900 to-emerald-950">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="footer-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="0.8" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#footer-pattern)" />
          </svg>
        </div>

        <div className="w-full max-w-[1600px] mx-auto px-4 py-16 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
            {/* ── Column 1: About ── */}
            <div className="space-y-6">
              {/* Logo */}
              <div className="flex items-center gap-2.5">
                {siteConfig?.logo ? (
                  <img
                    src={siteConfig.logo}
                    alt={siteName}
                    className="h-10 w-auto object-contain brightness-0 invert"
                  />
                ) : (
                  <img
                    src="/all_logo.png"
                    alt={siteName}
                    className="h-10 w-auto object-contain brightness-0 invert"
                  />
                )}
                <span className="font-bold text-xl text-white tracking-tight">{siteName}</span>
              </div>
              {/* Description */}
              <p className="text-white/60 text-sm leading-relaxed">
                {description}
              </p>
              {/* Tagline in Bengali */}
              <p className="text-amber-400/80 font-medium text-sm italic border-l-2 border-amber-400/30 pl-3 py-0.5">
                &ldquo;{tagline}&rdquo;
              </p>
              <p className="text-white/40 text-xs">
                খাঁটি খাদ্য, খাঁটি স্বাদ
              </p>

              {/* Social Links with Circle Backgrounds */}
              <div className="flex items-center gap-3">
                {socialButtons.map((social) => {
                  if (!social.alwaysShow && !socialLinks[social.key as keyof typeof socialLinks]) return null
                  return (
                    <a
                      key={social.key}
                      href={social.href || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group relative size-10 rounded-full bg-white/10 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg hover:ring-4 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none ${social.hoverRing} ${social.hoverColor}`}
                      aria-label={social.label}
                    >
                      <social.icon className="size-[18px] transition-transform duration-200 group-hover:scale-110" />
                    </a>
                  )
                })}
              </div>
            </div>

            {/* ── Column 2: Quick Links ── */}
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-base text-white flex items-center gap-2.5 mb-1">
                  <div className="h-[3px] w-7 bg-amber-400 rounded-full" />
                  Quick Links
                </h4>
                <div className="h-px bg-gradient-to-r from-amber-400/30 via-amber-400/10 to-transparent" />
              </div>
              <ul className="space-y-1">
                {footerMenuItems.length > 0
                  ? footerMenuItems.map((item, idx) => (
                      <li key={item.id}>
                        <button
                          onClick={() => handleNavClick(item.url)}
                          className="text-white/60 hover:text-white text-sm transition-all duration-200 flex items-center gap-2 group py-1.5 w-full"
                        >
                          <ChevronRight className="h-3 w-3 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200 text-amber-400" />
                          <span className="relative">
                            {item.label}
                            <span className="absolute bottom-0 left-0 w-0 h-px bg-amber-400/50 group-hover:w-full transition-all duration-300" />
                          </span>
                        </button>
                      </li>
                    ))
                  : quickLinks.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="text-white/60 hover:text-white text-sm transition-all duration-200 flex items-center gap-2 group py-1.5 w-full"
                        >
                          <ChevronRight className="h-3 w-3 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200 text-amber-400" />
                          <span className="relative">
                            {link.label}
                            <span className="absolute bottom-0 left-0 w-0 h-px bg-amber-400/50 group-hover:w-full transition-all duration-300" />
                          </span>
                        </Link>
                      </li>
                    ))}
              </ul>
            </div>

            {/* ── Column 3: Categories ── */}
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-base text-white flex items-center gap-2.5 mb-1">
                  <div className="h-[3px] w-7 bg-amber-400 rounded-full" />
                  Categories
                </h4>
                <div className="h-px bg-gradient-to-r from-amber-400/30 via-amber-400/10 to-transparent" />
              </div>
              <ul className="space-y-1">
                {categories.length > 0
                  ? categories.slice(0, 8).map((cat) => (
                      <li key={cat.id}>
                        <Link
                          href={`/categories/${cat.slug}`}
                          className="text-white/60 hover:text-white text-sm transition-all duration-200 flex items-center gap-2 group py-1.5 w-full"
                        >
                          <ChevronRight className="h-3 w-3 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200 text-amber-400" />
                          <span className="relative">
                            {cat.name}
                            <span className="absolute bottom-0 left-0 w-0 h-px bg-amber-400/50 group-hover:w-full transition-all duration-300" />
                          </span>
                        </Link>
                      </li>
                    ))
                  : defaultCategories.map((cat) => (
                      <li key={cat.slug}>
                        <Link
                          href={`/categories/${cat.slug}`}
                          className="text-white/60 hover:text-white text-sm transition-all duration-200 flex items-center gap-2 group py-1.5 w-full"
                        >
                          <ChevronRight className="h-3 w-3 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200 text-amber-400" />
                          <span className="relative">
                            {cat.name}
                            <span className="absolute bottom-0 left-0 w-0 h-px bg-amber-400/50 group-hover:w-full transition-all duration-300" />
                          </span>
                        </Link>
                      </li>
                    ))}
              </ul>
            </div>

            {/* ── Column 4: Contact ── */}
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-base text-white flex items-center gap-2.5 mb-1">
                  <div className="h-[3px] w-7 bg-amber-400 rounded-full" />
                  Contact Us
                </h4>
                <div className="h-px bg-gradient-to-r from-amber-400/30 via-amber-400/10 to-transparent" />
              </div>
              <ul className="space-y-3.5">
                {/* Address */}
                <li className="flex items-start gap-3 text-sm text-white/60 group">
                  <div className="size-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-400/20 transition-colors">
                    <MapPin className="size-4 text-amber-400" />
                  </div>
                  <span className="group-hover:text-white/80 transition-colors">{address}</span>
                </li>
                {/* Phone */}
                <li>
                  <a
                    href={`tel:${phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-3 text-sm text-white/60 hover:text-white transition-colors group"
                  >
                    <div className="size-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-amber-400/20 transition-colors">
                      <Phone className="size-4 text-amber-400" />
                    </div>
                    <span>{phone}</span>
                    <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </li>
                {/* Email */}
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-3 text-sm text-white/60 hover:text-white transition-colors group"
                  >
                    <div className="size-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-amber-400/20 transition-colors">
                      <Mail className="size-4 text-amber-400" />
                    </div>
                    <span>{email}</span>
                    <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </li>
                {/* Business Hours */}
                <li className="flex items-start gap-3 text-sm text-white/60 group">
                  <div className="size-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-400/20 transition-colors">
                    <Clock className="size-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm font-medium">Business Hours</p>
                    <p className="text-white/50 text-xs mt-0.5">Sat–Thu: 9AM – 9PM</p>
                    <p className="text-white/50 text-xs">Friday: Closed</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── Separator ── */}
      <div className="bg-emerald-950">
        <div className="w-full max-w-[1600px] mx-auto px-4">
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      </div>

      {/* ── Copyright Bar ── */}
      <div className="bg-emerald-950/80">
        <div className="w-full max-w-[1600px] mx-auto px-4 py-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Copyright */}
            <p className="text-white/40 text-xs">
              &copy; {currentYear} {siteName}. All rights reserved.
            </p>

            {/* Policy Links */}
            <div className="flex items-center gap-2 text-xs">
              {policyLinks.map((link, idx) => (
                <span key={link.href} className="flex items-center gap-2">
                  {idx > 0 && <span className="text-white/20">•</span>}
                  <Link
                    href={link.href}
                    className="text-white/40 hover:text-white/70 transition-colors hover:underline"
                  >
                    {link.label}
                  </Link>
                </span>
              ))}
            </div>

            {/* Made in Bangladesh */}
            <p className="flex items-center gap-1.5 text-xs text-white/40">
              Made with{' '}
              <Heart className="size-3 text-red-400 fill-red-400 inline animate-pulse" />{' '}
              in Bangladesh
            </p>
          </div>
        </div>
      </div>

      {/* ── Back to Top Button ── */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-900/40 flex items-center justify-center hover:from-emerald-500 hover:to-emerald-600 hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 border border-emerald-400/20"
            aria-label="Back to top"
          >
            <ArrowUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </footer>
  )
}

// ─── Default Data ─────────────────────────────────────────────────────────────

const defaultCategories = [
  { name: 'Honey & Jaggery', slug: 'honey-jaggery' },
  { name: 'Ghee & Oils', slug: 'ghee-oils' },
  { name: 'Rice & Grains', slug: 'rice-grains' },
  { name: 'Spices & Masala', slug: 'spices-masala' },
  { name: 'Sweets & Snacks', slug: 'sweets-snacks' },
  { name: 'Tea & Beverages', slug: 'tea-beverages' },
  { name: 'Pickles & Chutney', slug: 'pickles-chutney' },
  { name: 'Dry Fruits & Nuts', slug: 'dry-fruits-nuts' },
]
