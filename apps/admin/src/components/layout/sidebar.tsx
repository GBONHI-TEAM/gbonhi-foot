'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import adminLogo from '../../assets/logo.png';
import frisoMotif from '../../assets/friso.png';
import {
  LayoutGrid,
  BarChart3,
  DollarSign,
  Trophy,
  Target,
  Calendar,
  ListOrdered,
  Users,
  Shield,
  AlertTriangle,
  MapPin,
  CalendarCheck,
  Star,
  LifeBuoy,
  Bell,
  KeyRound,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutGrid, href: '/tableau-de-bord' },
  { label: 'KPI', icon: BarChart3, href: '/kpi' },
  { label: 'Finance', icon: DollarSign, href: '/finance' },
  { label: 'Ligues', icon: Trophy, href: '/ligues' },
  { label: 'Matchs', icon: Target, href: '/matchs' },
  { label: 'Calendriers', icon: Calendar, href: '/calendriers' },
  { label: 'Classements', icon: ListOrdered, href: '/classements' },
  { label: 'Utilisateurs', icon: Users, href: '/utilisateurs' },
  { label: 'Équipes', icon: Shield, href: '/equipes' },
  { label: 'Incidents', icon: AlertTriangle, href: '/incidents' },
  { label: 'Terrains', icon: MapPin, href: '/terrains' },
  { label: 'Réservations', icon: CalendarCheck, href: '/reservations' },
  { label: 'Avis', icon: Star, href: '/avis' },
  { label: 'Support', icon: LifeBuoy, href: '/support' },
  { label: 'Notifications', icon: Bell, href: '/notifications' },
  { label: 'Rôles & Accès', icon: KeyRound, href: '/roles' },
];

/** Frise verticale décorative — motif ivoirien officiel extrait de la maquette
    (contours orange, remplissage = vert de la sidebar). Répétée sur toute la hauteur. */
function MotifBand() {
  const src = typeof frisoMotif === 'string' ? frisoMotif : (frisoMotif as { src: string }).src;
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 h-full w-[20px]"
      style={{
        backgroundImage: `url(${src})`,
        backgroundRepeat: 'repeat-y',
        backgroundPosition: 'top left',
        backgroundSize: '20px auto',
      }}
      aria-hidden
    />
  );
}

/** Emblème GBONHI FOOT — logo officiel (asset LOGO.png). */
function LogoEmblem() {
  const src = typeof adminLogo === 'string' ? adminLogo : (adminLogo as { src: string }).src;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="GBONHI FOOT"
      className="h-11 w-11 flex-shrink-0 select-none object-contain"
      draggable={false}
    />
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed top-0 left-0 h-full w-60 flex flex-col z-30 overflow-hidden"
      style={{
        background:
          'radial-gradient(120% 60% at 20% 0%, #14522A 0%, #0F3D1E 45%, #0B2E16 100%)',
      }}
    >
      <MotifBand />

      {/* Logo GBONHI FOOT · Back-Office Admin */}
      <div className="pl-[26px] pr-4 py-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <LogoEmblem />
          <div className="leading-tight">
            <div className="text-white font-extrabold text-[15px] tracking-wide leading-tight">
              GBONHI<br />FOOT
            </div>
            <p className="text-[9px] font-semibold tracking-[0.15em] uppercase mt-0.5" style={{ color: '#FFB830' }}>
              Back-Office Admin
            </p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 pl-[18px] pr-3 pt-2 overflow-y-auto">
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-lg mb-0.5 transition-colors text-[14px] font-medium"
              style={{
                backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: isActive ? '#F7921E' : 'rgba(255,255,255,0.72)',
                borderLeft: isActive ? '3px solid #F7921E' : '3px solid transparent',
              }}
            >
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
