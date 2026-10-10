import { redirect } from 'next/navigation';
import { verifyAdminSession } from '@/lib/auth';
import MarketingDashboard from '@/components/marketing/MarketingDashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Marketing — Admin' };

export default async function MarketingPage() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) redirect('/admin/login');
  return <MarketingDashboard />;
}
