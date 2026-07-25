'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/lib/store'

interface PolicyData {
  id: string
  title: string
  content: string
}

const defaultContent: Record<string, { title: string; content: string }> = {
  'quality-promise': {
    title: 'Our Quality Promise',
    content: `
      <h2>100% Authentic Products</h2>
      <p>At Khati Khadyo, we guarantee the authenticity of every product we sell. Each item is sourced directly from trusted farmers, producers, and manufacturers across Bangladesh.</p>
      
      <h2>Quality Control</h2>
      <p>Every product goes through our rigorous quality control process before it reaches your doorstep. We check for freshness, purity, and compliance with food safety standards.</p>
      
      <h2>Freshness Guarantee</h2>
      <p>We ensure that all perishable items are stored and transported under optimal conditions to maintain their freshness and nutritional value.</p>
      
      <h2>Direct Sourcing</h2>
      <p>By sourcing directly from farmers and producers, we eliminate middlemen and ensure that you receive the freshest products at fair prices.</p>
      
      <h2>Our Commitment</h2>
      <p>If you are not satisfied with the quality of any product, we offer a hassle-free return and refund policy. Your trust is our most valuable asset.</p>
    `,
  },
  'delivery-policy': {
    title: 'Delivery Policy',
    content: `
      <h2>Delivery Areas</h2>
      <p>We currently deliver across major cities in Bangladesh including Dhaka, Chittagong, Sylhet, Rajshahi, and Khulna.</p>
      
      <h2>Delivery Time</h2>
      <p>Standard delivery takes 2-5 business days depending on your location. Dhaka city deliveries are typically completed within 1-2 business days.</p>
      
      <h2>Delivery Charges</h2>
      <p>Delivery charges are calculated based on your location. Orders above ৳1,500 qualify for free delivery within Dhaka city.</p>
      
      <h2>Order Tracking</h2>
      <p>Once your order is shipped, you will receive a tracking number via SMS/email. You can track your order status on our website.</p>
      
      <h2>Special Delivery</h2>
      <p>For perishable items, we use cold chain logistics to ensure freshness. These items are delivered with priority handling.</p>
    `,
  },
  'return-policy': {
    title: 'Return & Refund Policy',
    content: `
      <h2>Return Window</h2>
      <p>You can request a return within 7 days of receiving your order. The product must be in its original condition and packaging.</p>
      
      <h2>Eligible Items</h2>
      <p>Most products are eligible for return. However, perishable items like fresh produce, dairy, and prepared foods may have different return conditions.</p>
      
      <h2>How to Return</h2>
      <p>Contact our customer support team to initiate a return. We will arrange a pickup from your location at no additional charge.</p>
      
      <h2>Refund Process</h2>
      <p>Refunds are processed within 5-7 business days after we receive the returned product. The refund will be credited to your original payment method.</p>
      
      <h2>Damaged or Wrong Items</h2>
      <p>If you receive a damaged or incorrect item, please contact us immediately. We will replace the item or provide a full refund without requiring a return.</p>
    `,
  },
  terms: {
    title: 'Terms & Conditions',
    content: `
      <h2>General Terms</h2>
      <p>By using the Khati Khadyo website and services, you agree to these terms and conditions. Please read them carefully before making any purchase.</p>
      
      <h2>Account Registration</h2>
      <p>You may need to create an account to access certain features. You are responsible for maintaining the confidentiality of your account credentials.</p>
      
      <h2>Pricing</h2>
      <p>All prices are displayed in Bangladeshi Taka (BDT) and include applicable taxes. We reserve the right to change prices without prior notice.</p>
      
      <h2>Orders</h2>
      <p>Placing an order constitutes an offer to purchase. We reserve the right to accept or decline any order. An order is confirmed only when you receive a confirmation notification.</p>
      
      <h2>Intellectual Property</h2>
      <p>All content on this website, including text, images, and logos, is the property of Khati Khadyo and is protected by intellectual property laws.</p>
      
      <h2>Limitation of Liability</h2>
      <p>Khati Khadyo shall not be liable for any indirect, incidental, or consequential damages arising from the use of our services.</p>
    `,
  },
  privacy: {
    title: 'Privacy Policy',
    content: `
      <h2>Information We Collect</h2>
      <p>We collect personal information such as your name, email, phone number, and delivery address when you create an account or place an order.</p>
      
      <h2>How We Use Your Information</h2>
      <p>Your information is used to process orders, provide customer support, improve our services, and send relevant promotional communications (with your consent).</p>
      
      <h2>Data Protection</h2>
      <p>We implement industry-standard security measures to protect your personal information from unauthorized access, disclosure, or alteration.</p>
      
      <h2>Cookies</h2>
      <p>We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. You can control cookie settings through your browser.</p>
      
      <h2>Third-Party Sharing</h2>
      <p>We do not sell your personal information. We may share data with trusted partners only as necessary to provide our services (e.g., delivery partners).</p>
      
      <h2>Your Rights</h2>
      <p>You have the right to access, modify, or delete your personal data. Contact us at any time to exercise these rights.</p>
    `,
  },
}

export default function PolicyPage({ slug: slugProp }: { slug?: string }) {
  const [policy, setPolicy] = useState<PolicyData | null>(null)
  const [loading, setLoading] = useState(() => true)
  const pageParams = useAppStore((s) => s.pageParams)
  // Resolve slug from prop (used by wrapper pages like TermsPage) or fall back
  // to store pageParams (used when rendered via the generic 'policy' route).
  const slug = slugProp || (typeof pageParams?.slug === 'string' ? pageParams.slug : '')
  const defaults = defaultContent[slug] || { title: 'Page', content: '<p>Content not available.</p>' }

  const fetchPolicy = useCallback(async (s: string) => {
    try {
      const r = await fetch(`/api/policy-pages/slug/${s}`)
      if (!r.ok) throw new Error('Not found')
      const data = await r.json()
      setPolicy(data)
    } catch {
      setPolicy(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPolicy(slug)
  }, [slug, fetchPolicy])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="bg-primary text-primary-foreground py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold">
            {policy?.title || defaults.title}
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: policy?.content || defaults.content }}
        />

        {slug === 'quality-promise' && (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '🛡️', title: '100% Authentic', desc: 'Sourced directly from trusted producers' },
              { icon: '✅', title: 'Quality Tested', desc: 'Rigorous quality control checks' },
              { icon: '🚚', title: 'Fresh Delivery', desc: 'Cold chain logistics for freshness' },
              { icon: '↩️', title: 'Easy Returns', desc: '7-day hassle-free return policy' },
            ].map((item) => (
              <Card key={item.title} className="text-center">
                <CardContent className="p-4">
                  <div className="text-3xl mb-2">{item.icon}</div>
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
