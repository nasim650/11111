import type { Metadata } from 'next'
import AdminRoutePage from '@/components/pages/AdminRoutePage'

export const metadata: Metadata = {
  title: 'Admin Dashboard - Khati Khadyo',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminRoute({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug = [] } = await params
  return <AdminRoutePage route={slug.join('/')} />
}
