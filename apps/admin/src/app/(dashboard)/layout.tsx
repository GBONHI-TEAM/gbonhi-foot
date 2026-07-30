import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { Sidebar } from '../../components/layout/sidebar';

/** Bandeau décoratif or/orange en dents de scie — motifs ivoiriens officiels GBONHI FOOT. */
function GoldSawtooth() {
  return (
    <div
      className="fixed left-60 right-0 z-10 pointer-events-none"
      style={{ top: '64px', height: '8px' }}
    >
      <svg width="100%" height="8" preserveAspectRatio="none" aria-hidden>
        <defs>
          <pattern id="sawtooth" x="0" y="0" width="14" height="8" patternUnits="userSpaceOnUse">
            <rect width="14" height="8" fill="#0F3D1E" />
            <path d="M0 8 L7 1 L14 8 Z" fill="none" stroke="#FFB830" strokeWidth="1.2" />
          </pattern>
        </defs>
        <rect width="100%" height="8" fill="url(#sawtooth)" />
      </svg>
    </div>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F9FAFB' }}>
      <Sidebar />
      <GoldSawtooth />
      <div className="ml-60" style={{ paddingTop: '72px' }}>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
