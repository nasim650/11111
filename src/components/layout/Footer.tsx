'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Facebook,
  Instagram,
  MessageCircle,
  MapPin,
  Phone,
  Mail,
  ArrowUp,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useAppStore, type PageName } from '@/lib/store'

// ─── Component ────────────────────────────────────────────────────────────────

export default function Footer() {
  const { siteConfig, navigate } = useAppStore()
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 500)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const siteName = siteConfig?.siteName || 'Khati Khadyo'
  const tagline = siteConfig?.tagline || 'Authentic Bangladeshi Food'
  const phone = siteConfig?.phone
  const email = siteConfig?.email
  const address = siteConfig?.address
  const socialLinks = siteConfig?.socialLinks || {}
  const currentYear = new Date().getFullYear()

  const handleNavClick = (page: PageName) => navigate(page)

  const policyLinks: { label: string; page: PageName }[] = [
    { label: 'Delivery Policy', page: 'delivery-policy' },
    { label: 'Return Policy', page: 'return-policy' },
    { label: 'Terms & Conditions', page: 'terms' },
    { label: 'Privacy Policy', page: 'privacy' },
  ]

  const quickLinks: { label: string; page: PageName }[] = [
    { label: 'Home', page: 'home' },
    { label: 'Products', page: 'products' },
    { label: 'Contact Us', page: 'contact' },
  ]

  return (
    <footer className="mt-auto bg-emerald-950 text-emerald-50/90" aria-label="Site footer">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">

          {/* Brand Column */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => navigate('home')}
              aria-label={`${siteName} — Go to homepage`}
              className="inline-block"
            >
              {siteConfig?.logo ? (
                <img
                  src={siteConfig.logo}
                  alt={siteName}
                  className="h-10 w-auto object-contain rounded-md"
                />
              ) : (
                <span className="text-xl font-bold text-white">{siteName}</span>
              )}
            </button>
            <p className="text-sm text-emerald-200/70 leading-relaxed max-w-xs">
              {tagline}
            </p>

            {/* Social Links — only show configured ones */}
            <div className="flex items-center gap-2 flex-wrap" aria-label="Social media links">
              {socialLinks.facebook && (
                <a
                  href={socialLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="h-8 w-8 rounded-lg bg-white/10 hover:bg-blue-600 flex items-center justify-center transition-colors"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              )}
              {socialLinks.instagram && (
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="h-8 w-8 rounded-lg bg-white/10 hover:bg-pink-600 flex items-center justify-center transition-colors"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {phone && (
                <a
                  href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="h-8 w-8 rounded-lg bg-white/10 hover:bg-emerald-500 flex items-center justify-center transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.page}>
                  <button
                    type="button"
                    onClick={() => handleNavClick(link.page)}
                    className="text-sm text-emerald-200/70 hover:text-white transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Policy Links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-4">
              Policies
            </h3>
            <ul className="space-y-2.5">
              {policyLinks.map((link) => (
                <li key={link.page}>
                  <button
                    type="button"
                    onClick={() => handleNavClick(link.page)}
                    className="text-sm text-emerald-200/70 hover:text-white transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-4">
              Contact
            </h3>
            <ul className="space-y-3">
              {phone && (
                <li>
                  <a
                    href={`tel:${phone.replace(/\s/g, '')}`}
                    className="flex items-start gap-2 text-sm text-emerald-200/70 hover:text-white transition-colors"
                  >
                    <Phone className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                    {phone}
                  </a>
                </li>
              )}
              {email && (
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="flex items-start gap-2 text-sm text-emerald-200/70 hover:text-white transition-colors"
                  >
                    <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                    {email}
                  </a>
                </li>
              )}
              {address && (
                <li className="flex items-start gap-2 text-sm text-emerald-200/70">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  {address}
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Copyright bar */}
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-xs text-emerald-200/50">
          © {currentYear} {siteName}. All rights reserved.
        </p>
        <p className="text-xs text-emerald-200/40">
          Authentic food from Bangladesh 🇧🇩
        </p>
      </div>

      {/* Back to top */}
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          className="fixed bottom-20 right-4 z-50 h-10 w-10 rounded-full bg-emerald-700 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg transition-all lg:bottom-6"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </footer>
  )
}
