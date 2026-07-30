'use client';
import { Bell } from 'lucide-react';
import { useCurrentUser } from '../../lib/use-user';
import { displayName, initials } from '../../lib/domain';

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
      {/* Fin liseré doré/orange — motif GBONHI FOOT */}
      <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#F7921E 0%,#FFB830 100%)' }} />
      <div className="h-[59px] bg-white border-b border-gray-100 flex items-center justify-between px-8">
        <div className="leading-tight">
          <h1 className="text-[15px] font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-[12px] text-gray-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
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
