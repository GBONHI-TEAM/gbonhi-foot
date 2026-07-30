'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/finance', label: 'Dashboard' },
  { href: '/finance/partenaires', label: 'Partenaires à payer' },
  { href: '/finance/couts', label: 'Déclarer des coûts' },
];

export function FinanceTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className="px-4 py-2 rounded-lg text-sm font-semibold border transition"
            style={{
              backgroundColor: active ? '#1E7A3A' : 'white',
              color: active ? 'white' : '#374151',
              borderColor: active ? '#1E7A3A' : '#E5E7EB',
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
