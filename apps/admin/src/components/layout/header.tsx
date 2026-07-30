'use client';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Search, Bell } from 'lucide-react';
import { useCurrentUser } from '../../lib/use-current-user';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { displayName, initials } = useCurrentUser();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <header
      className="fixed top-0 left-60 right-0 h-16 z-20 flex items-center justify-between pl-8 pr-6"
      style={{ backgroundColor: '#0F3D1E' }}
    >
      <h1 className="text-[19px] font-bold text-white">{title}</h1>
      <div className="flex items-center gap-4">
        {/* Recherche */}
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Rechercher…"
            className="h-9 w-64 pl-9 pr-4 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}
          />
        </div>

        {/* Cloche */}
        <button className="relative p-1.5 text-white/70 hover:text-white transition">
          <Bell size={20} strokeWidth={1.9} />
          <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#EF4444' }} />
        </button>

        {/* Nom de l'utilisateur connecté */}
        {displayName && (
          <span className="hidden lg:block text-sm font-semibold text-white/90 max-w-[180px] truncate">
            {displayName}
          </span>
        )}

        {/* Avatar (initiales du connecté) — déconnexion */}
        <button
          onClick={handleSignOut}
          title={displayName ? `${displayName} · Se déconnecter` : 'Se déconnecter'}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold transition hover:opacity-80 flex-shrink-0"
          style={{ backgroundColor: '#1E7A3A', border: '2px solid #FFB830' }}
        >
          {initials ?? '…'}
        </button>
      </div>
    </header>
  );
}
