'use client'

import { useState, useEffect } from 'react'
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
  CreditCard,
  Smartphone,
  Banknote,
  ShieldCheck,
  Truck,
  RotateCcw,
  Lock,
  Clock,
  QrCode,
  Apple,
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
  const { siteConfig, navigate, language } = useAppStore()

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

  const quickLinks: { label: string; page: PageName }[] = [
    { label: 'Home', page: 'home' },
    { label: 'Products', page: 'products' },
    { label: 'Offers', page: 'products' },
    { label: 'Contact', page: 'contact' },
  ]

  const policyLinks: { label: string; page: PageName }[] = [
    { label: 'Delivery Policy', page: 'delivery-policy' },
    { label: 'Return Policy', page: 'return-policy' },
    { label: 'Terms & Conditions', page: 'terms' },
    { label: 'Privacy Policy', page: 'privacy' },
  ]

  // Trust badges data
  const trustBadges = [
    { icon: ShieldCheck, title: '100% Authentic', subtitle: 'Genuine Products', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { icon: Truck, title: 'Free Delivery', subtitle: 'Over ৳1,500', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    { icon: RotateCcw, title: 'Easy Returns', subtitle: '7-Day Policy', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
    { icon: Lock, title: 'Secure Payment', subtitle: 'SSL Encrypted', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  ]

  // Payment methods
  const paymentMethods = [
    { name: 'SSLCommerz', icon: Lock, color: 'text-emerald-400' },
    { name: 'bKash', icon: Smartphone, color: 'text-pink-400' },
    { name: 'Nagad', icon: Smartphone, color: 'text-orange-400' },
    { name: 'Rocket', icon: Smartphone, color: 'text-purple-400' },
    { name: 'Visa', icon: CreditCard, color: 'text-blue-400' },
    { name: 'Mastercard', icon: CreditCard, color: 'text-red-400' },
    { name: 'COD', icon: Banknote, color: 'text-amber-400' },
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
        <div className="container mx-auto px-4 py-6 relative z-10">
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

        <div className="container mx-auto px-4 py-16 relative z-10">
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
                {language === 'bn' ? 'খাঁটি খাদ্য, খাঁটি স্বাদ' : 'খাঁটি খাদ্য, খাঁটি স্বাদ'}
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
                      className={`group relative size-10 rounded-full bg-white/10 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg hover:ring-4 ${social.hoverRing} ${social.hoverColor}`}
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
                  {language === 'bn' ? 'দ্রুত লিঙ্ক' : 'Quick Links'}
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
                  : quickLinks.map((link, idx) => (
                      <li key={link.label}>
                        <button
                          onClick={() => navigate(link.page)}
                          className="text-white/60 hover:text-white text-sm transition-all duration-200 flex items-center gap-2 group py-1.5 w-full"
                        >
                          <ChevronRight className="h-3 w-3 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200 text-amber-400" />
                          <span className="relative">
                            {link.label}
                            <span className="absolute bottom-0 left-0 w-0 h-px bg-amber-400/50 group-hover:w-full transition-all duration-300" />
                          </span>
                        </button>
                      </li>
                    ))}
              </ul>
            </div>

            {/* ── Column 3: Categories ── */}
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-base text-white flex items-center gap-2.5 mb-1">
                  <div className="h-[3px] w-7 bg-amber-400 rounded-full" />
                  {language === 'bn' ? 'ক্যাটাগরি' : 'Categories'}
                </h4>
                <div className="h-px bg-gradient-to-r from-amber-400/30 via-amber-400/10 to-transparent" />
              </div>
              <ul className="space-y-1">
                {categories.length > 0
                  ? categories.slice(0, 8).map((cat) => (
                      <li key={cat.id}>
                        <button
                          onClick={() =>
                            navigate('products', { category: cat.slug })
                          }
                          className="text-white/60 hover:text-white text-sm transition-all duration-200 flex items-center gap-2 group py-1.5 w-full"
                        >
                          <ChevronRight className="h-3 w-3 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200 text-amber-400" />
                          <span className="relative">
                            {cat.name}
                            <span className="absolute bottom-0 left-0 w-0 h-px bg-amber-400/50 group-hover:w-full transition-all duration-300" />
                          </span>
                        </button>
                      </li>
                    ))
                  : defaultCategories.map((cat) => (
                      <li key={cat.slug}>
                        <button
                          onClick={() =>
                            navigate('products', { category: cat.slug })
                          }
                          className="text-white/60 hover:text-white text-sm transition-all duration-200 flex items-center gap-2 group py-1.5 w-full"
                        >
                          <ChevronRight className="h-3 w-3 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200 text-amber-400" />
                          <span className="relative">
                            {cat.name}
                            <span className="absolute bottom-0 left-0 w-0 h-px bg-amber-400/50 group-hover:w-full transition-all duration-300" />
                          </span>
                        </button>
                      </li>
                    ))}
              </ul>
            </div>

            {/* ── Column 4: Contact ── */}
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-base text-white flex items-center gap-2.5 mb-1">
                  <div className="h-[3px] w-7 bg-amber-400 rounded-full" />
                  {language === 'bn' ? 'যোগাযোগ' : 'Contact Us'}
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
                    <p className="text-white/80 text-sm font-medium">{language === 'bn' ? 'ব্যবসায়িক সময়' : 'Business Hours'}</p>
                    <p className="text-white/50 text-xs mt-0.5">Sat–Thu: 9AM – 9PM</p>
                    <p className="text-white/50 text-xs">Friday: Closed</p>
                  </div>
                </li>
              </ul>

              {/* Map placeholder */}
              <div className="mt-4 rounded-xl overflow-hidden border border-white/10 bg-white/5 h-28 relative group cursor-pointer hover:border-amber-400/30 transition-colors">
                <div className="absolute inset-0 flex items-center justify-center flex-col gap-1.5">
                  <MapPin className="size-6 text-amber-400/60 group-hover:text-amber-400 transition-colors" />
                  <span className="text-white/40 text-[11px] group-hover:text-white/60 transition-colors">
                    {language === 'bn' ? 'মানচিত্রে দেখুন' : 'View on Map'}
                  </span>
                </div>
                {/* Decorative grid lines for map look */}
                <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="map-grid" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
                      <path d="M30 0H0v30" fill="none" stroke="white" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#map-grid)" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Separator ── */}
      <div className="bg-emerald-950">
        <div className="container mx-auto px-4">
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      </div>

      {/* ── Payment Methods & App Download Row ── */}
      <div className="bg-emerald-950">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Payment Methods */}
            <div className="flex flex-col items-center lg:items-start gap-3">
              <span className="text-white/40 text-xs font-medium uppercase tracking-wider">
                {language === 'bn' ? 'পেমেন্ট পদ্ধতি' : 'Payment Methods'}
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {paymentMethods.map((method) => (
                  <div
                    key={method.name}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs text-white/70 font-medium hover:bg-white/[0.1] hover:border-white/[0.15] hover:text-white transition-all duration-200 cursor-default group`}
                  >
                    <method.icon className={`h-3.5 w-3.5 ${method.color} group-hover:scale-110 transition-transform`} />
                    {method.name}
                  </div>
                ))}
              </div>
            </div>

            {/* App Download Section - Desktop Only */}
            <div className="hidden lg:flex items-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <span className="text-white/40 text-xs font-medium uppercase tracking-wider">
                  {language === 'bn' ? 'অ্যাপ ডাউনলোড করুন' : 'Download Our App'}
                </span>
                <div className="flex items-center gap-3">
                  {/* QR Code Placeholder */}
                  <div className="size-20 rounded-lg bg-white/[0.08] border border-white/10 flex items-center justify-center hover:border-amber-400/20 transition-colors">
                    <div className="flex flex-col items-center gap-1">
                      <QrCode className="size-8 text-white/30" />
                      <span className="text-[8px] text-white/30">Scan Me</span>
                    </div>
                  </div>
                  {/* App Store Badges */}
                  <div className="flex flex-col gap-2">
                    <a
                      href="#"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.08] border border-white/10 text-white/70 hover:bg-white/[0.12] hover:text-white transition-all duration-200 group"
                    >
                      <Apple className="size-5 text-white/60 group-hover:text-white transition-colors" />
                      <div className="flex flex-col leading-none">
                        <span className="text-[9px] text-white/40">Download on the</span>
                        <span className="text-xs font-semibold">App Store</span>
                      </div>
                    </a>
                    <a
                      href="#"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.08] border border-white/10 text-white/70 hover:bg-white/[0.12] hover:text-white transition-all duration-200 group"
                    >
                      <svg className="size-5 text-white/60 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.302 2.302a1 1 0 010 1.38l-2.302 2.302L15.396 13l2.302-2.491zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z" />
                      </svg>
                      <div className="flex flex-col leading-none">
                        <span className="text-[9px] text-white/40">Get it on</span>
                        <span className="text-xs font-semibold">Google Play</span>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Separator ── */}
      <div className="bg-emerald-950">
        <div className="container mx-auto px-4">
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      </div>

      {/* ── Copyright Bar ── */}
      <div className="bg-emerald-950/80">
        <div className="container mx-auto px-4 py-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Copyright */}
            <p className="text-white/40 text-xs">
              &copy; {currentYear} {siteName}. {language === 'bn' ? 'সর্বস্বত্ব সংরক্ষিত।' : 'All rights reserved.'}
            </p>

            {/* Policy Links */}
            <div className="flex items-center gap-2 text-xs">
              {policyLinks.slice(0, 3).map((link, idx) => (
                <span key={link.page} className="flex items-center gap-2">
                  {idx > 0 && <span className="text-white/20">•</span>}
                  <button
                    onClick={() => navigate(link.page)}
                    className="text-white/40 hover:text-white/70 transition-colors hover:underline"
                  >
                    {link.label}
                  </button>
                </span>
              ))}
            </div>

            {/* Made in Bangladesh */}
            <p className="flex items-center gap-1.5 text-xs text-white/40">
              {language === 'bn' ? 'বাংলাদেশে তৈরি' : 'Made with'}{' '}
              <Heart className="size-3 text-red-400 fill-red-400 inline animate-pulse" />{' '}
              {language === 'bn' ? '' : 'in Bangladesh'}
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
