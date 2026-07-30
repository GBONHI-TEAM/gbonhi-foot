'use client';
import { useEffect, useMemo, useState } from 'react';
import { Header } from '../../../components/layout/header';
import { Ban, Info, X, CalendarDays } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { ApiBlock, ApiReservation, ApiTerrain, ApiSlot } from '../../../lib/domain';

type SlotStatut = 'dispo' | 'reserve' | 'attente' | 'bloque' | 'ferme';
type Cell = { statut: SlotStatut; label?: string; sub?: string };

const LEGEND = [
  { label: 'Disponible', color: '#1E7A3A' },
  { label: 'Réservé', color: '#EF4444' },
  { label: 'En attente', color: '#F59E0B' },
  { label: 'Bloqué', color: '#9CA3AF' },
];

const STATUT_STYLE: Record<SlotStatut, React.CSSProperties> = {
  dispo: { backgroundColor: '#F0FDF4', border: '1px solid #A7F3D0' },
  reserve: { backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' },
  attente: { backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' },
  bloque: { backgroundColor: '#F3F4F6', border: '1px solid #9CA3AF' },
  ferme: { backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' },
};

const JOURS_COURT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Lundi de la semaine courante. */
function mondayOfWeek(base = new Date()): Date {
  const d = new Date(base);
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function CreneauxPage() {
  const [vue, setVue] = useState<'semaine' | 'jour'>('semaine');
  const [modal, setModal] = useState(false);
  const [terrain, setTerrain] = useState<ApiTerrain | null>(null);
  const [blocks, setBlocks] = useState<ApiBlock[]>([]);
  const [reservations, setReservations] = useState<ApiReservation[]>([]);

  const monday = useMemo(() => mondayOfWeek(), []);
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    }),
    [monday]
  );

  async function loadBlocks(terrainId: string) {
    try {
      const b = await apiFetch<ApiBlock[]>(`/terrains/${terrainId}/blocks`);
      if (Array.isArray(b)) setBlocks(b);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const terrains = await apiFetch<ApiTerrain[]>('/terrains/mine');
        if (cancelled || !Array.isArray(terrains) || terrains.length === 0) return;
        const t = terrains[0];
        setTerrain(t);
        const [b, resas] = await Promise.all([
          apiFetch<ApiBlock[]>(`/terrains/${t.id}/blocks`).catch(() => [] as ApiBlock[]),
          apiFetch<ApiReservation[]>('/reservations').catch(() => [] as ApiReservation[]),
        ]);
        if (cancelled) return;
        if (Array.isArray(b)) setBlocks(b);
        if (Array.isArray(resas)) setReservations(resas);
      } catch {
        /* état vide */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const slots: ApiSlot[] = terrain?.slots ?? [];

  // Plage horaire dérivée des créneaux (min start → max end).
  const { hourStart, hourEnd } = useMemo(() => {
    const active = slots.filter((s) => s.is_active);
    if (active.length === 0) return { hourStart: 6, hourEnd: 22 };
    return {
      hourStart: Math.min(...active.map((s) => s.start_hour)),
      hourEnd: Math.max(...active.map((s) => s.end_hour)),
    };
  }, [slots]);

  const hours = useMemo(
    () => Array.from({ length: Math.max(hourEnd - hourStart, 0) }, (_, i) => hourStart + i),
    [hourStart, hourEnd]
  );

  function cellFor(dayIdx: number, hour: number): Cell {
    const date = isoDate(weekDates[dayIdx]);
    // Bloc ?
    const block = blocks.find((b) => {
      if (b.blocked_date.slice(0, 10) !== date) return false;
      if (b.start_hour == null || b.end_hour == null) return true; // journée entière
      return b.start_hour <= hour && hour < b.end_hour;
    });
    if (block) return { statut: 'bloque', label: 'Bloqué', sub: block.reason ?? undefined };

    // Réservation ?
    const resa = reservations.find(
      (r) =>
        r.reservation_date.slice(0, 10) === date &&
        r.start_hour <= hour &&
        hour < r.end_hour &&
        r.status !== 'cancelled'
    );
    if (resa) {
      const statut: SlotStatut = resa.status === 'pending' ? 'attente' : 'reserve';
      return {
        statut,
        label: resa.status === 'pending' ? 'En attente' : 'Réservation',
        sub: resa.user?.full_name,
      };
    }

    // Créneau ouvert ?
    const open = slots.some(
      (s) => s.day_of_week === dayIdx && s.is_active && s.start_hour <= hour && hour < s.end_hour
    );
    return open ? { statut: 'dispo' } : { statut: 'ferme' };
  }

  const semaineLabel = `${weekDates[0].getDate()} – ${weekDates[6].getDate()} ${MOIS_COURT[weekDates[6].getMonth()]} ${weekDates[6].getFullYear()}`;

  return (
    <>
      <Header title="Créneaux" subtitle={`Semaine du ${semaineLabel}`} />

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            {(['semaine', 'jour'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVue(v)}
                className="px-3.5 py-1.5 text-[13px] font-medium transition-colors"
                style={{
                  backgroundColor: vue === v ? '#1A3D2B' : 'white',
                  color: vue === v ? 'white' : '#6B7280',
                }}
              >
                Vue {v === 'semaine' ? 'Semaine' : 'Jour'}
              </button>
            ))}
          </div>
          <span className="text-[13px] font-semibold text-gray-700">{semaineLabel}</span>
        </div>
        <button
          onClick={() => setModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border"
          style={{ color: '#F7921E', borderColor: '#F7921E' }}
        >
          <Ban size={14} /> Bloquer un créneau
        </button>
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 mb-4">
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
            <span className="text-[12px] text-gray-500">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Grille calendrier */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <div className="min-w-[900px]">
          {/* En-têtes jours */}
          <div className="grid" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
            <div className="border-b border-gray-100" />
            {weekDates.map((d, i) => {
              const dayOpen = slots.some((s) => s.day_of_week === i && s.is_active);
              return (
                <div key={i} className="border-b border-l border-gray-100 px-2 py-2.5 text-center text-[12px] font-semibold text-gray-600">
                  {JOURS_COURT[i]} {d.getDate()}
                  {!dayOpen && <span className="block text-[10px] font-normal text-gray-400">Fermé</span>}
                </div>
              );
            })}
          </div>

          {/* Lignes heures */}
          {hours.map((h) => (
            <div key={h} className="grid" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
              <div className="border-b border-gray-100 px-1 py-1 text-[10px] text-gray-400 text-right pr-2">{h}h</div>
              {weekDates.map((_, dayIdx) => {
                const cell = cellFor(dayIdx, h);
                const style = STATUT_STYLE[cell.statut];
                return (
                  <div key={dayIdx} className="border-b border-l border-gray-100 p-1">
                    <div className="rounded-md px-1.5 py-1 h-11 flex flex-col justify-center" style={style}>
                      {cell.label && (
                        <>
                          <p className="text-[9px] font-semibold leading-tight text-gray-700 truncate">{cell.label}</p>
                          {cell.sub && <p className="text-[8px] text-gray-500 leading-tight truncate">{cell.sub}</p>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Blocs existants */}
      {blocks.length > 0 && (
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-[14px] mb-3">Créneaux bloqués</h2>
          <div className="divide-y divide-gray-100">
            {blocks.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-[13px] font-medium text-gray-900">
                    {b.blocked_date.slice(0, 10)}
                    {b.start_hour != null && b.end_hour != null ? ` · ${b.start_hour}h – ${b.end_hour}h` : ' · Journée entière'}
                  </p>
                  {b.reason && <p className="text-[12px] text-gray-400">{b.reason}</p>}
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                  Bloqué
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Bloquer un créneau */}
      {modal && terrain && (
        <BlockModal
          terrainId={terrain.id}
          defaultDate={isoDate(new Date())}
          hourRange={hours}
          onClose={() => setModal(false)}
          onDone={async () => {
            setModal(false);
            await loadBlocks(terrain.id);
          }}
        />
      )}
    </>
  );
}

function BlockModal({
  terrainId,
  defaultDate,
  hourRange,
  onClose,
  onDone,
}: {
  terrainId: string;
  defaultDate: string;
  hourRange: number[];
  onClose: () => void;
  onDone: () => void;
}) {
  const options = hourRange.length > 0 ? hourRange : Array.from({ length: 16 }, (_, i) => i + 6);
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState(options[0]);
  const [end, setEnd] = useState(options[Math.min(1, options.length - 1)] + 1);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/terrains/${terrainId}/blocks`, {
        method: 'POST',
        body: JSON.stringify({
          blocked_date: date,
          start_hour: start,
          end_hour: end,
          reason: reason || undefined,
        }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du blocage.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <h3 className="font-bold text-gray-900 text-[15px]">Bloquer un créneau</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">Le créneau sera retiré des disponibilités affichées aux joueurs.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 space-y-3">
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-11 px-3 pr-9 rounded-lg border border-gray-200 text-[13px] text-gray-900 focus:outline-none focus:border-[#1E7A3A]"
            />
            <CalendarDays size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
              className="h-11 px-3 rounded-lg border border-gray-200 text-[13px] text-gray-900 focus:outline-none focus:border-[#1E7A3A]"
            >
              {options.map((h) => (
                <option key={h} value={h}>{h}h00</option>
              ))}
            </select>
            <select
              value={end}
              onChange={(e) => setEnd(Number(e.target.value))}
              className="h-11 px-3 rounded-lg border border-gray-200 text-[13px] text-gray-900 focus:outline-none focus:border-[#1E7A3A]"
            >
              {options.map((h) => (
                <option key={h} value={h + 1}>{h + 1}h00</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Raison (facultatif) — Ex : Entretien du terrain, Réservé hors application…"
            className="w-full h-11 px-3 rounded-lg border border-gray-200 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1E7A3A]"
          />
          {error && <p className="text-[12px] text-red-600">{error}</p>}
          <div className="flex items-start gap-2 rounded-lg p-3" style={{ backgroundColor: '#EFF6FF' }}>
            <Info size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#1D4ED8' }} />
            <p className="text-[12px]" style={{ color: '#1D4ED8' }}>
              Ce créneau sera automatiquement marqué comme indisponible dans l&apos;application mobile GBONHI FOOT. Les joueurs ne pourront pas le réserver pendant toute la durée du blocage.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5">
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:text-gray-900">
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: '#1E7A3A' }}
          >
            {saving ? 'Blocage…' : 'Bloquer le créneau'}
          </button>
        </div>
      </div>
    </div>
  );
}
