'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';

export type PartnerAccessRole = 'OWNER' | 'MANAGER';

interface CurrentPartnerAccess {
  id: string;
  partner_id: string;
  role: PartnerAccessRole;
  partner: { id: string; full_name: string | null; username: string | null };
}

interface PartnerAccessContextValue {
  access: CurrentPartnerAccess | null;
  loading: boolean;
  isOwner: boolean;
}

const PartnerAccessContext = createContext<PartnerAccessContextValue>({ access: null, loading: true, isOwner: false });

export function usePartnerAccess() {
  return useContext(PartnerAccessContext);
}

/** Charge l'accès métier une fois pour tout le portail, puis expulse un compte
 * suspendu/révoqué avant qu'il ne puisse accéder à une section partenaire. */
export function PartnerAccessProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [access, setAccess] = useState<CurrentPartnerAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<CurrentPartnerAccess>('/partner-accesses/me')
      .then((result) => { if (!cancelled) setAccess(result); })
      .catch(async () => {
        if (cancelled) return;
        await createSupabaseBrowserClient().auth.signOut();
        router.replace('/connexion?access=denied');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [router]);

  const value = useMemo(() => ({ access, loading, isOwner: access?.role === 'OWNER' }), [access, loading]);
  return <PartnerAccessContext.Provider value={value}>{children}</PartnerAccessContext.Provider>;
}
