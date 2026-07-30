import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { Sidebar } from '../../components/layout/sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/connexion');

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-60 pt-16">
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
