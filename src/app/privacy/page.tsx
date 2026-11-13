import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Privacy Policy | Khati Khadyo',
  alternates: {
    canonical: '/privacy-policy',
  },
}

export default function Page() {
  redirect('/privacy-policy')
}
