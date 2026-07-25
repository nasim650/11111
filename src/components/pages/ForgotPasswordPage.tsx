'use client'

import { useState } from 'react'
import { Mail, ArrowLeft, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
  const { navigate, siteConfig } = useAppStore()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() && !phone.trim()) {
      toast.error('Please enter your email or phone number')
      return
    }
    setLoading(true)
    // Placeholder: no actual reset endpoint
    setTimeout(() => {
      setSent(true)
      setLoading(false)
      toast.success('If an account exists with this info, a reset link will be sent.')
    }, 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src={siteConfig?.logo || '/all_logo.png'}
              alt="Khati Khadyo"
              className="h-10 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
          <CardDescription>
            {sent
              ? 'Check your email/phone for reset instructions'
              : 'Enter your email or phone to reset your password'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <p className="text-muted-foreground">
                If an account exists with the information you provided, you will receive password reset instructions.
              </p>
              <Button variant="outline" onClick={() => navigate('login')} className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="fp-email">Email</Label>
                <Input
                  id="fp-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="text-center text-sm text-muted-foreground">or</div>
              <div>
                <Label htmlFor="fp-phone">Phone</Label>
                <Input
                  id="fp-phone"
                  type="tel"
                  placeholder="01XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Reset Link
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate('login')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
