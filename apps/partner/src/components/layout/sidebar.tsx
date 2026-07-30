'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MapPin,
  CalendarDays,
  ClipboardList,
  Radio,
  Star,
  Wallet,
  LifeBuoy,
  Users,
  LogOut,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { useCurrentUser } from '../../lib/use-user';
import { displayName, initials, ROLE_FR } from '../../lib/domain';
import partnerLogo from '../../assets/logo.png';
import frisoMotif from '../../assets/friso.png';

const asUrl = (a: unknown) => (typeof a === 'string' ? a : (a as { src: string }).src);

const NAV_ITEMS = [
  { label: 'Tableau de bord', icon: LayoutDashboard, href: '/tableau-de-bord' },
  { label: 'Mon terrain', icon: MapPin, href: '/mon-terrain' },
  { label: 'Créneaux', icon: CalendarDays, href: '/creneaux' },
  { label: 'Réservations', icon: ClipboardList, href: '/reservations' },
  { label: 'Live', icon: Radio, href: '/live', live: true },
  { label: 'Avis', icon: Star, href: '/avis' },
  { label: 'Revenus', icon: Wallet, href: '/revenus' },
  { label: 'Support', icon: LifeBuoy, href: '/support' },
  { label: 'Rôles', icon: Users, href: '/roles' },
];

// Frise verticale décorative — motif ivoirien officiel extrait de la maquette
// (contours orange, fond transparent). Répétée sur toute la hauteur du bord gauche.
function SidebarMotifs() {
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 h-full w-[20px]"
      style={{
        backgroundImage: `url(${asUrl(frisoMotif)})`,
        backgroundRepeat: 'repeat-y',
        backgroundPosition: 'top left',
        backgroundSize: '20px auto',
      }}
      aria-hidden
    />
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const user = useCurrentUser();
  const nom = displayName(user);
  const inits = nom ? initials(nom) : '';
  const roleLabel = user ? ROLE_FR[user.role] ?? 'Propriétaire' : '';

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/connexion');
  }

  return (
    <aside
      className="fixed top-0 left-0 h-full w-60 flex flex-col z-30 overflow-hidden"
      style={{ backgroundColor: '#1A3D2B' }}
    >
      <SidebarMotifs />

      {/* Logo GBONHI FOOT · Espace Partenaire */}
      <div className="relative pl-[26px] pr-4 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asUrl(partnerLogo)}
            alt="GBONHI FOOT"
            className="h-10 w-10 flex-shrink-0 select-none object-contain"
            draggable={false}
          />
          <div className="leading-tight">
            <div>
              <span className="text-white font-black text-sm tracking-wide">GBONHI </span>
              <span className="font-black text-sm tracking-wide" style={{ color: '#F7921E' }}>FOOT</span>
            </div>
            <p className="text-white/45 text-[10px] tracking-widest uppercase">Espace Partenaire</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="relative flex-1 py-4 pl-[18px] pr-3 overflow-y-auto">
        {NAV_ITEMS.map(({ label, icon: Icon, href, live }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-colors text-[13px] font-medium"
              style={{
                backgroundColor: isActive ? 'rgba(247,146,30,0.15)' : 'transparent',
                color: isActive ? '#F7921E' : 'rgba(255,255,255,0.72)',
                borderLeft: isActive ? '3px solid #F7921E' : '3px solid transparent',
              }}
            >
              <span className="relative flex-shrink-0">
                <Icon size={17} strokeWidth={2} color={live ? '#EF4444' : undefined} />
                {live && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
                )}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer user */}
      <div className="relative pl-[26px] pr-4 py-4 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
            style={{ backgroundColor: '#F7921E' }}
          >
            {inits}
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-white text-[13px] font-semibold truncate">{nom || '—'}</p>
            <p className="text-white/45 text-[11px]">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-white/50 hover:text-white text-[12px] transition-colors"
        >
          <LogOut size={13} />
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}
