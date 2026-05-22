import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin — Webnario Power',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
