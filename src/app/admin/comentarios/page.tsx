import { redirect } from 'next/navigation';
import { verifyAdminSession } from '@/lib/auth';
import AdminComments from '@/components/AdminComments';

export const dynamic = 'force-dynamic';

export default async function CommentsPage() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) redirect('/admin/login');
  return <AdminComments />;
}
