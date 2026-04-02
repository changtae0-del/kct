export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { getRoleFromCookies } from '@/lib/auth'

export default async function RootPage() {
  const role = await getRoleFromCookies()
  if (role === 'admin') redirect('/admin/dashboard')
  if (role === 'student') redirect('/student/today')
  redirect('/login')
}
