'use client';

import { CalendarRange, RotateCcw } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

export function GlobalPeriodFilter() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => { setFrom(params.get('from') ?? ''); setTo(params.get('to') ?? ''); }, [params]);
  if (pathname === '/roles' || pathname.startsWith('/roles/')) return null;

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

  return <form onSubmit={apply} className="hidden xl:flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-700">
    <CalendarRange size={14} className="text-[#1A3D2B]" />
    <input aria-label="Date de début" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="h-7 w-[112px] bg-transparent text-[11px] outline-none" />
    <span className="text-[11px] text-gray-400">au</span>
    <input aria-label="Date de fin" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="h-7 w-[112px] bg-transparent text-[11px] outline-none" />
    <button type="submit" className="rounded bg-[#1A3D2B] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#0F3D1E]">Filtrer</button>
    {(from || to) ? <button type="button" onClick={reset} title="Réinitialiser la période" className="p-1 text-gray-500 hover:text-gray-900"><RotateCcw size={13} /></button> : null}
  </form>;
}
