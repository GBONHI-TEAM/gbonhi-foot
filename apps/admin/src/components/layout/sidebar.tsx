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
  Building2,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';
import { type AdminRole } from '../../lib/admin-access';

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  roles: AdminRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutGrid, href: '/tableau-de-bord', roles: ['SUPER_ADMIN', 'ADMIN', 'CONTROLEUR', 'SUPPORT', 'OPERATEUR'] },
  { label: 'KPI', icon: BarChart3, href: '/kpi', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Finance', icon: DollarSign, href: '/finance', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Ligues', icon: Trophy, href: '/ligues', roles: ['SUPER_ADMIN', 'ADMIN', 'OPERATEUR'] },
  { label: 'Matchs', icon: Target, href: '/matchs', roles: ['SUPER_ADMIN', 'ADMIN', 'CONTROLEUR', 'OPERATEUR'] },
  { label: 'Calendriers', icon: Calendar, href: '/calendriers', roles: ['SUPER_ADMIN', 'ADMIN', 'OPERATEUR'] },
  { label: 'Classements', icon: ListOrdered, href: '/classements', roles: ['SUPER_ADMIN', 'ADMIN', 'CONTROLEUR', 'OPERATEUR'] },
  { label: 'Utilisateurs', icon: Users, href: '/utilisateurs', roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
  { label: 'Équipes', icon: Shield, href: '/equipes', roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'OPERATEUR'] },
  { label: 'Incidents', icon: AlertTriangle, href: '/incidents', roles: ['SUPER_ADMIN', 'ADMIN', 'CONTROLEUR', 'SUPPORT'] },
  { label: 'Terrains', icon: MapPin, href: '/terrains', roles: ['SUPER_ADMIN', 'ADMIN', 'OPERATEUR'] },
  { label: 'Réservations', icon: CalendarCheck, href: '/reservations', roles: ['SUPER_ADMIN', 'ADMIN', 'OPERATEUR'] },
  { label: 'Paiements', icon: CreditCard, href: '/paiements', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Avis', icon: Star, href: '/avis', roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
  { label: 'Support', icon: LifeBuoy, href: '/support', roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
  { label: 'Notifications', icon: Bell, href: '/notifications', roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
  { label: 'Rôles & Accès', icon: KeyRound, href: '/roles', roles: ['SUPER_ADMIN'] },
  { label: 'Accès partenaires', icon: Building2, href: '/acces-partenaires', roles: ['SUPER_ADMIN', 'ADMIN'] },
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

export function Sidebar({ role }: { role: AdminRole }) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed top-0 left-0 h-full w-60 flex flex-col z-30 overflow-hidden"
      style={{ backgroundColor: '#1E7A3A' }}
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
        {NAV_ITEMS.filter((item) => item.roles.includes(role)).map(({ label, icon: Icon, href }) => {
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
