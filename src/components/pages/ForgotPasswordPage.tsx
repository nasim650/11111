'use client'

import { useState } from 'react'
import { ArrowLeft, KeyRound, Send, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
  const { navigate, siteConfig } = useAppStore()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const requestCode = async () => {
    if (!phone.trim()) {
      toast.error('আপনার মোবাইল নম্বর দিন')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'কোড পাঠানো যায়নি')

      setSent(true)
      toast.success('মোবাইল নম্বরে ৬ সংখ্যার কোড পাঠানো হয়েছে')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'কোড পাঠানো যায়নি')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestCode = async (event: React.FormEvent) => {
    event.preventDefault()
    await requestCode()
  }

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password.length < 6) {
      toast.error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে')
      return
    }
    if (password !== confirmPassword) {
      toast.error('দুটি পাসওয়ার্ড এক নয়')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, password }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'পাসওয়ার্ড পরিবর্তন করা যায়নি')

      toast.success('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে। এখন লগইন করুন।')
      navigate('login')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'পাসওয়ার্ড পরিবর্তন করা যায়নি')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={siteConfig?.logo || '/all_logo.png'} alt="Khati Khadyo" className="h-10 w-auto object-contain" />
          </div>
          <CardTitle className="text-2xl">পাসওয়ার্ড রিসেট</CardTitle>
          <CardDescription>
            {sent
              ? 'SMS-এ পাঠানো ৬ সংখ্যার কোড দিয়ে নতুন পাসওয়ার্ড দিন।'
              : 'আপনার নিবন্ধিত বাংলাদেশি মোবাইল নম্বরটি দিন।'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sent ? (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <Label htmlFor="fp-phone">মোবাইল নম্বর</Label>
                <Input id="fp-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1" />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <><Send className="h-4 w-4 mr-2" />কোড পাঠান</>}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => navigate('login')}>
                <ArrowLeft className="h-4 w-4 mr-2" />লগইনে ফিরে যান
              </Button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 flex gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
                <span>{phone} নম্বরে পাঠানো কোডটি ৫ মিনিটের মধ্যে ব্যবহার করুন।</span>
              </div>
              <div>
                <Label htmlFor="fp-code">৬ সংখ্যার কোড</Label>
                <Input id="fp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} className="mt-1 text-center tracking-[0.45em] font-semibold" />
              </div>
              <div>
                <Label htmlFor="fp-password">নতুন পাসওয়ার্ড</Label>
                <Input id="fp-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="fp-confirm-password">পাসওয়ার্ড আবার দিন</Label>
                <Input id="fp-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1" />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <><KeyRound className="h-4 w-4 mr-2" />পাসওয়ার্ড পরিবর্তন করুন</>}
              </Button>
              <Button type="button" variant="ghost" className="w-full" disabled={loading} onClick={() => void requestCode()}>
                কোড আবার পাঠান
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
