'use client';

import { CalendarRange, RotateCcw } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

// Le dashboard possède déjà son filtre Période complet dans son propre contenu.
const EXCLUDED_ROUTES = ['/tableau-de-bord', '/notifications', '/roles', '/acces-partenaires'];

export function GlobalPeriodFilter() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => { setFrom(params.get('from') ?? ''); setTo(params.get('to') ?? ''); }, [params]);
  if (EXCLUDED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return null;

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (from && to && from > to) return;
    const next = new URLSearchParams(params.toString());
    from ? next.set('from', from) : next.delete('from');
    to ? next.set('to', to) : next.delete('to');
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`);
    router.refresh();
  }

  function reset() {
    setFrom(''); setTo('');
    const next = new URLSearchParams(params.toString());
    next.delete('from'); next.delete('to');
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`);
    router.refresh();
  }

  return <form onSubmit={apply} className="hidden xl:flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-white">
    <CalendarRange size={14} className="text-white/70" />
    <input aria-label="Date de début" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="h-7 w-[118px] bg-transparent text-[11px] text-white [color-scheme:dark] outline-none" />
    <span className="text-[11px] text-white/60">au</span>
    <input aria-label="Date de fin" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="h-7 w-[118px] bg-transparent text-[11px] text-white [color-scheme:dark] outline-none" />
    <button type="submit" className="rounded bg-white/15 px-2 py-1 text-[11px] font-semibold hover:bg-white/25">Filtrer</button>
    {(from || to) ? <button type="button" onClick={reset} title="Réinitialiser la période" className="p-1 text-white/70 hover:text-white"><RotateCcw size={13} /></button> : null}
  </form>;
}
