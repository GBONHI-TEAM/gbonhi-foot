'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

/** Cloche de notifications : badge du nombre de non-lues, lien vers la page. */
export function NotificationsBell() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let on = true;
    const load = () =>
      apiFetch<{ count: number }>('/notifications/unread-count')
        .then((d) => { if (on) setCount(d?.count ?? 0); })
        .catch(() => {});
    load();
    const timer = setInterval(load, 30_000);
    return () => { on = false; clearInterval(timer); };
  }, []);

  return (
    <Link href="/notifications" className="relative p-1.5 text-gray-400 hover:text-gray-700 transition-colors" aria-label="Notifications">
      <Bell size={18} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white" style={{ backgroundColor: '#F7921E' }}>
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
