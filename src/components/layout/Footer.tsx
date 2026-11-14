'use client'

import Link from 'next/link'
import { Phone, Mail, ShieldCheck } from 'lucide-react'
import { useAppStore } from '@/lib/store'

export default function Footer() {
  const { siteConfig } = useAppStore()

  const siteName = siteConfig?.siteName || 'Khati Khadyo'
  const logoUrl = siteConfig?.logo || '/all_logo.png'
  const currentYear = new Date().getFullYear()

  // Real configured contact info only (filter out placeholder defaults)
  const phone = siteConfig?.phone && !siteConfig.phone.includes('XXX') ? siteConfig.phone.trim() : null
  const email = siteConfig?.email && !siteConfig.email.includes('example') ? siteConfig.email.trim() : null

  const policyLinks = [
    { label: 'Delivery Policy', href: '/delivery-policy' },
    { label: 'Return Policy', href: '/return-policy' },
    { label: 'Terms & Conditions', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy-policy' },
  ]

  return (
    <footer className="mt-auto border-t border-stone-200/80 bg-stone-50 dark:bg-stone-950 dark:border-stone-800 text-stone-700 dark:text-stone-300">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-stone-200/60 dark:border-stone-800">
          {/* ── Brand Logo & Tagline ── */}
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <Link
              href="/"
              className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-lg p-1"
              aria-label="Khati Khadyo - Go to homepage"
            >
              <img
                src={logoUrl}
                alt="Khati Khadyo"
                className="h-8 md:h-9 w-auto object-contain transition-transform group-hover:scale-105"
                onError={(e) => {
                  const target = e.currentTarget
                  if (!target.src.includes('all_logo.png')) {
                    target.src = '/all_logo.png'
                  }
                }}
              />
              <span className="font-extrabold text-base md:text-lg text-stone-900 dark:text-white tracking-tight">
                {siteName}
              </span>
            </Link>
            <span className="hidden sm:inline text-stone-300 dark:text-stone-700">|</span>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
              ১০০% খাঁটি ও নিরাপদ খাদ্য পণ্য
            </p>
          </div>

          {/* ── Optional Real Contact Info ── */}
          {(phone || email) && (
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
              {phone && (
                <a
                  href={`tel:${phone.replace(/\s+/g, '')}`}
                  className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded px-1.5 py-0.5"
                >
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-medium">{phone}</span>
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded px-1.5 py-0.5"
                >
                  <Mail className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-medium">{email}</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom Bar: Policies & Copyright ── */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-stone-500 dark:text-stone-400">
          {/* Policy Links */}
          <nav aria-label="Footer policy navigation" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {policyLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded py-0.5"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Copyright */}
          <p className="text-center md:text-right">
            &copy; {currentYear} {siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
