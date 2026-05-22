import { redirect } from 'next/navigation';
import { verifyAdminSession } from '@/lib/auth';
import AdminConfig from '@/components/AdminConfig';

export const dynamic = 'force-dynamic';

export default async function ConfigPage() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) redirect('/admin/login');
  return <AdminConfig />;
}
