'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, X } from 'lucide-react';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';

interface ReservationRow {
  id: string;
  terrain_id?: string | null;
  user_id?: string | null;
  total_price?: number | null;
  reservation_date?: string | null;
  start_hour?: number | null;
  end_hour?: number | null;
  status?: string | null;
}

interface AlertItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  kind: 'reservation' | 'payment';
}

interface IntentRow {
  id: string;
  amount?: number | null;
  status?: string | null;
  mode?: string | null;
}

const SOUND_KEY = 'gbonhi_admin_sound_on';

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
function fmtHour(n: number | null | undefined): string {
  if (n == null) return '';
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return `${String(h).padStart(2, '0')}h${m ? String(m).padStart(2, '0') : ''}`;
}

/**
 * Alerte temps réel des nouvelles réservations : notification visuelle + alarme
 * sonore répétée jusqu'à acquittement (« J'ai vu »). Le son nécessite une
 * activation initiale (politique navigateur) via le bouton dédié.
 */
export function ReservationAlerts() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [soundOn, setSoundOn] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Alarme Web Audio (bi-tonale, forte) ──
  const beep = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.35].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = i === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.32);
    });
  }, []);

  const startLoop = useCallback(() => {
    if (loopRef.current || !soundOn) return;
    beep();
    loopRef.current = setInterval(beep, 1600);
  }, [beep, soundOn]);

  const stopLoop = useCallback(() => {
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
  }, []);

  const enableSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioRef.current = new Ctx();
      }
      void audioRef.current.resume();
      setSoundOn(true);
      window.localStorage.setItem(SOUND_KEY, '1');
    } catch { /* audio indisponible */ }
  }, []);

  // Préférence mémorisée (le contexte audio se débloque au 1er clic sur « activer »).
  useEffect(() => {
    if (window.localStorage.getItem(SOUND_KEY) === '1') {
      // On ne relance pas l'AudioContext sans geste : on affiche le bouton pour réarmer.
      setSoundOn(false);
    }
  }, []);

  // Démarre / stoppe l'alarme selon la file d'alertes.
  useEffect(() => {
    if (alerts.length > 0 && soundOn) startLoop();
    else stopLoop();
    return () => stopLoop();
  }, [alerts.length, soundOn, startLoop, stopLoop]);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  useEffect(() => {
    const suffix = Math.random().toString(36).slice(2);
    const push = (item: AlertItem) => setAlerts((prev) => [item, ...prev.filter((a) => a.id !== item.id)].slice(0, 25));

    const reservations = supabase
      .channel(`admin-resv-alerts-${suffix}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reservations' }, (payload) => {
        const row = payload.new as ReservationRow;
        push({
          id: `r-${row.id}`,
          kind: 'reservation',
          href: '/reservations',
          title: row.total_price != null ? `Réservation — ${row.total_price.toLocaleString('fr-FR')} FCFA` : 'Nouvelle réservation',
          subtitle: [fmtDate(row.reservation_date ?? null), `${fmtHour(row.start_hour)}${row.end_hour != null ? ` – ${fmtHour(row.end_hour)}` : ''}`].filter(Boolean).join(' · '),
        });
      })
      .subscribe();

    // Actions importantes : paiement en attente de validation (intervention admin).
    const payments = supabase
      .channel(`admin-pay-alerts-${suffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_intents' }, (payload) => {
        const row = payload.new as IntentRow;
        if (!row || row.status !== 'pending') return;
        push({
          id: `p-${row.id}`,
          kind: 'payment',
          href: '/etat-paiement',
          title: 'Paiement en attente de validation',
          subtitle: [row.amount != null ? `${row.amount.toLocaleString('fr-FR')} FCFA` : '', row.mode === 'leagues' ? 'Ligue' : 'Réservation'].filter(Boolean).join(' · '),
        });
      })
      .subscribe();

    return () => { void supabase.removeChannel(reservations); void supabase.removeChannel(payments); };
  }, [supabase]);

  const dismiss = (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id));
  const dismissAll = () => setAlerts([]);

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2">
      {!soundOn && (
        <button
          onClick={enableSound}
          className="inline-flex items-center gap-2 rounded-full bg-[#0F3D1E] px-4 py-2 text-sm font-bold text-white shadow-lg"
        >
          <BellRing size={16} /> Activer les alertes sonores
        </button>
      )}

      {alerts.length > 0 && (
        <div className="w-80 overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-red-600 px-4 py-2.5 text-white">
            <span className="flex items-center gap-2 text-sm font-black"><BellRing size={16} className="animate-pulse" /> Alertes ({alerts.length})</span>
            <button onClick={dismissAll} className="text-white/80 hover:text-white text-xs font-bold">Tout acquitter</button>
          </div>
          <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.kind === 'payment' ? '#B45309' : '#DC2626' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-500">{a.subtitle}</p>
                </div>
                <button onClick={() => { router.push(a.href); dismiss(a.id); }} className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:border-[#1E7A3A]">Voir</button>
                <button onClick={() => dismiss(a.id)} className="text-gray-400 hover:text-gray-600" aria-label="Acquitter"><X size={16} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
