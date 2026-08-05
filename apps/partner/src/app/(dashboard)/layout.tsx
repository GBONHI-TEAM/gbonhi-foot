import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { Sidebar } from '../../components/layout/sidebar';
import { PartnerAccessProvider } from '../../components/auth/partner-access-provider';
import { PeriodRefreshBoundary } from '../../components/layout/period-refresh-boundary';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/connexion');

  return (
    <PartnerAccessProvider>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className="ml-60 pt-16">
          <main className="p-8"><PeriodRefreshBoundary>{children}</PeriodRefreshBoundary></main>
        </div>
      </div>
    </PartnerAccessProvider>
  );
}
