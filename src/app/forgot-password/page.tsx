import type { Metadata } from 'next'
import CustomerShell from '@/components/layout/CustomerShell'
import ForgotPasswordPage from '@/components/pages/ForgotPasswordPage'

export const metadata: Metadata = {
  title: 'Forgot Password - Khati Khadyo',
  description: 'Reset your password on Khati Khadyo.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ForgotPasswordRoute() {
  return (
    <CustomerShell>
      <ForgotPasswordPage />
    </CustomerShell>
  )
}
