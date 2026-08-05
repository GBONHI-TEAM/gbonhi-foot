'use client';
import { Bell } from 'lucide-react';
import { useCurrentUser } from '../../lib/use-user';
import { displayName, initials } from '../../lib/domain';
import { GlobalPeriodFilter } from '../ui/global-period-filter';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const user = useCurrentUser();
  const nom = displayName(user);
  const inits = nom ? initials(nom) : '';

  return (
    <header className="fixed top-0 left-60 right-0 z-20">
      {/* Frise triangulaire ivoirienne : même motif que les exports partenaire. */}
      <svg className="block h-2 w-full" viewBox="0 0 14 8" preserveAspectRatio="none" aria-hidden>
        <defs>
          <pattern id="partner-sawtooth" x="0" y="0" width="14" height="8" patternUnits="userSpaceOnUse">
            <rect width="14" height="8" fill="#FFFFFF" />
            <path d="M0 8 L7 1 L14 8 Z" fill="none" stroke="#F7921E" strokeWidth="1.1" />
          </pattern>
        </defs>
        <rect width="100%" height="8" fill="url(#partner-sawtooth)" />
      </svg>
      <div className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-8">
        <div className="leading-tight">
          <h1 className="text-[15px] font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-[12px] text-gray-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          <GlobalPeriodFilter />
          <button className="relative p-1.5 text-gray-400 hover:text-gray-700 transition-colors">
            <Bell size={18} />
            <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#F7921E' }} />
          </button>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
            style={{ backgroundColor: '#1A3D2B' }}
            title={nom || undefined}
          >
            {inits}
          </div>
        </div>
      </div>
    </header>
  );
}
