import { redirect } from 'next/navigation';
import { verifyAdminSession } from '@/lib/auth';
import AdminNavigation from '@/components/AdminNavigation';

export const dynamic = 'force-dynamic';

export default async function NavigationPage() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) redirect('/admin/login');
  return <AdminNavigation />;
}
