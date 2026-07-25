'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone, Mail, MapPin, Send, Clock, Facebook, Instagram,
  Twitter, Youtube, MessageCircle, ChevronDown, Globe, HeadphonesIcon,
  HelpCircle, ArrowRight, Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

const faqs = [
  {
    q: 'What are your delivery hours?',
    a: 'We deliver between 9 AM and 9 PM every day, including weekends and holidays. Same-day delivery is available for orders placed before 2 PM within Dhaka city.',
  },
  {
    q: 'How can I track my order?',
    a: 'Once your order is shipped, you will receive an SMS and email with a tracking number. You can also track your order from the "My Orders" section in your account.',
  },
  {
    q: 'What is your return policy?',
    a: 'We offer a 7-day return policy for all products. If you receive a damaged or incorrect item, contact us within 48 hours for an immediate replacement or refund.',
  },
  {
    q: 'Do you deliver outside Dhaka?',
    a: 'Yes! We deliver across all 64 districts of Bangladesh. Delivery times vary from 2-5 business days depending on your location. Delivery charges apply based on distance.',
  },
  {
    q: 'How can I become a supplier or partner?',
    a: 'We are always looking for quality suppliers and partners. Please email us at partnerships@khatikhadyo.com with your business details and product catalog.',
  },
]

const timeSlots = [
  { day: 'Saturday - Thursday', hours: '9:00 AM - 9:00 PM' },
  { day: 'Friday', hours: '2:00 PM - 9:00 PM' },
]

const subjectOptions = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'order', label: 'Order Issue' },
  { value: 'delivery', label: 'Delivery Question' },
  { value: 'return', label: 'Return / Refund' },
  { value: 'product', label: 'Product Information' },
  { value: 'partnership', label: 'Business Partnership' },
  { value: 'feedback', label: 'Feedback / Suggestion' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'other', label: 'Other' },
]

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.08 }
  }
}

const staggerItem = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } }
}

export default function ContactPage() {
  const { siteConfig, navigate } = useAppStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (!email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email format'
    if (!message.trim()) errs.message = 'Message is required'
    else if (message.trim().length < 10) errs.message = 'Message must be at least 10 characters'
    if (phone && !/^[\d+\-\s()]{7,15}$/.test(phone)) errs.phone = 'Invalid phone number'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, subject, message }),
      })
      if (!res.ok) throw new Error('Failed to send message')
      toast.success('Message sent successfully! We will get back to you soon.')
      setName('')
      setEmail('')
      setPhone('')
      setSubject('')
      setMessage('')
      setErrors({})
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 5000)
    } catch {
      toast.error('Failed to send message. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const socialLinks = [
    { icon: Facebook, href: siteConfig?.socialLinks?.facebook, label: 'Facebook', color: 'hover:bg-[#1877F2] hover:text-white', bg: 'bg-blue-50' },
    { icon: Instagram, href: siteConfig?.socialLinks?.instagram, label: 'Instagram', color: 'hover:bg-gradient-to-br hover:from-purple-500 hover:to-pink-500 hover:text-white', bg: 'bg-pink-50' },
    { icon: Twitter, href: siteConfig?.socialLinks?.twitter, label: 'Twitter', color: 'hover:bg-sky-500 hover:text-white', bg: 'bg-sky-50' },
    { icon: Youtube, href: siteConfig?.socialLinks?.youtube, label: 'YouTube', color: 'hover:bg-red-600 hover:text-white', bg: 'bg-red-50' },
  ].filter((s) => s.href)

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary via-primary/95 to-emerald-800 text-primary-foreground py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-10 right-20 w-60 h-60 rounded-full bg-secondary/30 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        {/* Floating decorative circles */}
        <div className="absolute top-20 right-1/4 w-4 h-4 rounded-full bg-white/20 animate-bounce" style={{ animationDuration: '3s' }} />
        <div className="absolute bottom-16 left-1/4 w-3 h-3 rounded-full bg-secondary/40 animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />

        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <HeadphonesIcon className="h-4 w-4" />
              <span className="text-sm font-medium">We&apos;re Here to Help</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold mb-3">Get in Touch</h1>
            {/* Bengali subtitle */}
            <p className="text-lg md:text-2xl font-medium opacity-80 mb-4" style={{ fontFamily: 'system-ui' }}>
              আমাদের সাথে যোগাযোগ করুন
            </p>
            <p className="text-base md:text-lg opacity-90 max-w-2xl mx-auto mb-8">
              Have a question, suggestion, or just want to say hello? We&apos;d love to hear from you.
              Our team is always ready to assist.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                variant="secondary"
                className="rounded-full px-6 shadow-lg"
                onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Send className="h-4 w-4 mr-2" />
                Send a Message
              </Button>
              <Button
                variant="outline"
                className="rounded-full px-6 border-white/30 text-white hover:bg-white/10"
                onClick={() => document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Browse FAQs
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="container mx-auto px-4 -mt-8 relative z-20 mb-8">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            {
              icon: Phone,
              title: 'Call Us',
              info: siteConfig?.phone || '+880 1XXX-XXXXXX',
              sub: 'Mon-Sat 9AM-9PM',
              color: 'from-emerald-500 to-primary',
              iconBg: 'bg-emerald-100',
            },
            {
              icon: Mail,
              title: 'Email Us',
              info: siteConfig?.email || 'info@khatikhadyo.com',
              sub: 'We reply within 24 hours',
              color: 'from-secondary to-amber-600',
              iconBg: 'bg-amber-100',
            },
            {
              icon: MapPin,
              title: 'Visit Us',
              info: siteConfig?.address || 'Dhaka, Bangladesh',
              sub: 'Our main office',
              color: 'from-teal-500 to-emerald-700',
              iconBg: 'bg-teal-100',
            },
            {
              icon: Clock,
              title: 'Business Hours',
              info: '9 AM - 9 PM',
              sub: 'Fri: 2 PM - 9 PM',
              color: 'from-orange-500 to-amber-600',
              iconBg: 'bg-orange-100',
            },
          ].map((card, idx) => (
            <motion.div key={idx} variants={staggerItem}>
              <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0 shadow-md h-full">
                <CardContent className="p-6">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                    <card.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold mb-1">{card.title}</h3>
                  <p className="text-sm text-foreground font-medium">{card.info}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Contact Form + Map */}
      <section id="contact-form" className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-3"
          >
            <Card className="shadow-lg border-0 rounded-2xl overflow-hidden">
              {/* Card header with gradient accent */}
              <div className="h-1.5 bg-gradient-to-r from-primary via-emerald-500 to-secondary" />
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="h-4 w-4 text-primary" />
                  </div>
                  Send us a Message
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Fill out the form below and we&apos;ll get back to you as soon as possible.
                </p>
              </CardHeader>
              <CardContent>
                <AnimatePresence mode="wait">
                  {submitted ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="text-center py-12"
                    >
                      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                        <Zap className="h-10 w-10 text-emerald-500" />
                      </div>
                      <h3 className="text-lg font-bold text-emerald-700 mb-2">Message Sent!</h3>
                      <p className="text-muted-foreground text-sm">We&apos;ll get back to you within 24 hours</p>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleSubmit}
                      className="space-y-5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">
                            Name <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            value={name}
                            onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })) }}
                            placeholder="Your full name"
                            className={`mt-1.5 h-11 rounded-xl ${errors.name ? 'border-red-400 focus-visible:ring-red-200' : ''}`}
                          />
                          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                        </div>
                        <div>
                          <Label className="text-sm font-medium">
                            Email <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })) }}
                            placeholder="your@email.com"
                            className={`mt-1.5 h-11 rounded-xl ${errors.email ? 'border-red-400 focus-visible:ring-red-200' : ''}`}
                          />
                          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Phone</Label>
                          <Input
                            value={phone}
                            onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: '' })) }}
                            placeholder="01XXXXXXXXX"
                            className={`mt-1.5 h-11 rounded-xl ${errors.phone ? 'border-red-400 focus-visible:ring-red-200' : ''}`}
                          />
                          {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Subject</Label>
                          <Select value={subject} onValueChange={setSubject}>
                            <SelectTrigger className="mt-1.5 h-11 rounded-xl">
                              <SelectValue placeholder="Select a subject" />
                            </SelectTrigger>
                            <SelectContent>
                              {subjectOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">
                          Message <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          value={message}
                          onChange={(e) => { setMessage(e.target.value); setErrors((p) => ({ ...p, message: '' })) }}
                          placeholder="Tell us how we can help you..."
                          rows={5}
                          className={`mt-1.5 resize-none rounded-xl ${errors.message ? 'border-red-400 focus-visible:ring-red-200' : ''}`}
                        />
                        {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
                        <p className="text-xs text-muted-foreground mt-1 text-right">{message.length}/500</p>
                      </div>
                      <Button type="submit" className="w-full h-12 rounded-xl text-base shadow-md" disabled={loading}>
                        {loading ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send Message
                          </>
                        )}
                      </Button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          {/* Map + Info Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="lg:col-span-2 space-y-5"
          >
            {/* Map */}
            <Card className="shadow-lg border-0 rounded-2xl overflow-hidden">
              <div className="relative h-64 bg-gradient-to-br from-primary/5 via-primary/10 to-secondary/5 flex items-center justify-center">
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle, #2D6A4F 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }} />
                </div>
                {/* Grid lines */}
                <div className="absolute inset-0 opacity-10">
                  <svg className="w-full h-full">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <line key={`h${i}`} x1="0" y1={`${(i + 1) * 10}%`} x2="100%" y2={`${(i + 1) * 10}%`} stroke="#2D6A4F" strokeWidth="0.5" />
                    ))}
                    {Array.from({ length: 10 }).map((_, i) => (
                      <line key={`v${i}`} x1={`${(i + 1) * 10}%`} y1="0" x2={`${(i + 1) * 10}%`} y2="100%" stroke="#2D6A4F" strokeWidth="0.5" />
                    ))}
                  </svg>
                </div>
                <div className="text-center relative z-10">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <MapPin className="h-8 w-8 text-primary" />
                  </div>
                  {/* Location pin animation */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-2 border-primary/20 animate-ping" style={{ animationDuration: '3s' }} />
                  <p className="font-semibold text-primary mb-1">Our Location</p>
                  <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
                    {siteConfig?.address || 'Dhaka, Bangladesh'}
                  </p>
                </div>
                {/* Corner decorations */}
                <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-primary/30 rounded-tl-lg" />
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-primary/30 rounded-br-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary/20 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary/20 rounded-bl-lg" />
              </div>
            </Card>

            {/* Business Hours Card */}
            <Card className="shadow-lg border-0 rounded-2xl">
              <CardContent className="p-6">
                <h3 className="font-semibold flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-orange-600" />
                  </div>
                  Business Hours
                </h3>
                <div className="space-y-3">
                  {timeSlots.map((slot, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{slot.day}</span>
                      <span className="font-medium bg-primary/10 text-primary px-3 py-1 rounded-full text-xs">
                        {slot.hours}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Social Links */}
            <Card className="shadow-lg border-0 rounded-2xl">
              <CardContent className="p-6">
                <h3 className="font-semibold flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-primary" />
                  </div>
                  Follow Us
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {socialLinks.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2.5 p-3 rounded-xl border bg-muted/30 transition-all duration-300 ${social.color}`}
                    >
                      <div className={`h-8 w-8 rounded-lg ${social.bg} flex items-center justify-center`}>
                        <social.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">{social.label}</span>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq-section" className="bg-gradient-to-b from-muted/30 to-muted/50 py-12 mt-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-1.5 mb-4">
              <HelpCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Quick Answers</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">Find quick answers to common questions</p>
          </motion.div>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, idx) => (
              <AccordionItem
                key={idx}
                value={`faq-${idx}`}
                className="bg-white rounded-xl shadow-sm border-0 px-6 data-[state=open]:shadow-md transition-shadow"
              >
                <AccordionTrigger className="text-left hover:no-underline py-4 text-sm font-medium">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          {/* FAQ link to full page */}
          <div className="text-center mt-6">
            <Button
              variant="outline"
              className="rounded-full px-6"
              onClick={() => navigate('contact')}
            >
              <HelpCircle className="h-4 w-4 mr-2" />
              Check our FAQ for more answers
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-primary via-emerald-700 to-primary text-primary-foreground py-12">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-xl md:text-2xl font-bold mb-3">Still Have Questions?</h3>
            <p className="opacity-90 mb-6 max-w-lg mx-auto">
              Don&apos;t hesitate to reach out. Our support team is available to help you with anything you need.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                variant="secondary"
                className="rounded-full px-8 shadow-lg"
                onClick={() => navigate('products')}
              >
                Browse Products
              </Button>
              <Button
                variant="outline"
                className="rounded-full px-8 border-white/30 text-white hover:bg-white/10"
                onClick={() => navigate('contact')}
              >
                View All FAQs
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
