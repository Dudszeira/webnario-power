import { redirect } from 'next/navigation';
import { verifyAdminSession } from '@/lib/auth';
import AdminImport from '@/components/AdminImport';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) redirect('/admin/login');
  return <AdminImport />;
}
