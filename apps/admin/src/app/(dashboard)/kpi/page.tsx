'use client';
import { useEffect, useMemo, useState } from 'react';
import { Header } from '../../../components/layout/header';
import { apiFetch } from '../../../lib/api';

/* ---------- types ---------- */
type Tab = 'acquisition' | 'ligues' | 'reservations';

interface AdminUser { id: string; role?: string | null; position?: string | null; created_at?: string | null }
interface League { id: string; status: string; created_at?: string | null; _count?: { teams: number; matches: number } }
interface Team { id: string }
interface Terrain { id: string; is_active?: boolean }
interface Match { id: string; status: string; scheduled_at?: string | null }
interface Reservation { id: string; status?: string | null; reservation_date?: string | null; total_price?: number | null; platform_fee?: number | null; partner_amount?: number | null }

const FILTERS = ["Aujourd'hui", '7 jours', '30 jours', 'Ce mois', 'Tout'];
const ACTIVE_LEAGUE = ['INSCRIPTIONS_OUVERTES', 'INSCRIPTIONS_CLOSES', 'EN_COURS'];

function periodStart(filter: string): Date | null {
  const now = new Date();
  switch (filter) {
    case "Aujourd'hui": return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case '7 jours': return new Date(Date.now() - 7 * 864e5);
    case '30 jours': return new Date(Date.now() - 30 * 864e5);
    case 'Ce mois': return new Date(now.getFullYear(), now.getMonth(), 1);
    default: return null; // Tout
  }
}
function inPeriod(iso: string | null | undefined, start: Date | null): boolean {
  if (!start) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t >= start.getTime();
}
const up = (s?: string | null) => (s ?? '').toUpperCase();
const isConfirmed = (s?: string | null) => /CONFIRM|VALID/.test(up(s));
const isCancelled = (s?: string | null) => /CANCEL|ANNUL|REFUS/.test(up(s));
const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} F`;

/* ---------- UI ---------- */
function KpiCard({ label, value, accent, soon }: { label: string; value: string; accent?: boolean; soon?: boolean }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <p className="text-gray-500 text-sm">{label}</p>
      <p className="text-3xl font-black mt-1" style={{ color: soon ? '#9CA3AF' : accent ? '#F7921E' : '#111827' }}>{value}</p>
      {soon ? <p className="text-[11px] text-gray-400 mt-1">Bientôt disponible</p> : null}
    </div>
  );
}

export default function KpiPage() {
  const [tab, setTab] = useState<Tab>('acquisition');
  const [filter, setFilter] = useState('30 jours');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [u, l, t, te, m, r] = await Promise.all([
        apiFetch<AdminUser[]>('/users').catch(() => []),
        apiFetch<League[]>('/leagues').catch(() => []),
        apiFetch<Team[]>('/teams').catch(() => []),
        apiFetch<Terrain[]>('/terrains').catch(() => []),
        apiFetch<Match[]>('/matches').catch(() => []),
        apiFetch<Reservation[]>('/reservations/all').catch(() => []),
      ]);
      if (cancelled) return;
      setUsers(u); setLeagues(l); setTeams(t); setTerrains(te); setMatches(m); setReservations(r);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const start = useMemo(() => periodStart(filter), [filter]);

  const k = useMemo(() => {
    const newUsers = users.filter((x) => inPeriod(x.created_at, start)).length;
    const fiches = users.filter((x) => !!x.position).length;
    const leaguesActive = leagues.filter((l) => ACTIVE_LEAGUE.includes(l.status)).length;
    const matchsJoues = matches.filter((mm) => ['TERMINÉ', 'VALIDÉ'].includes(up(mm.status))).length;
    const resP = reservations.filter((x) => inPeriod(x.reservation_date, start));
    const confirmed = resP.filter((x) => isConfirmed(x.status)).length;
    const cancelled = resP.filter((x) => isCancelled(x.status)).length;
    const montant = resP.reduce((s, x) => s + (x.total_price ?? 0), 0);
    const commission = resP.reduce((s, x) => s + (x.platform_fee ?? 0), 0);
    return {
      totalUsers: users.length, newUsers, fiches,
      leaguesActive, totalLeagues: leagues.length, teams: teams.length, matchsJoues,
      terrains: terrains.filter((x) => x.is_active !== false).length,
      resTotal: resP.length, confirmed, cancelled, montant, commission,
    };
  }, [users, leagues, teams, terrains, matches, reservations, start]);

  const nb = (v: number) => (loaded ? v.toLocaleString('fr-FR') : '—');

  return (
    <>
      <Header title="KPI & Analytics" />

      {/* Sous-onglets */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {([['acquisition', 'Acquisition & Fidélisation'], ['ligues', 'Ligues'], ['reservations', 'Réservations']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="px-4 py-2 rounded-lg text-sm font-semibold border transition"
            style={{ backgroundColor: tab === id ? '#1E7A3A' : 'white', color: tab === id ? 'white' : '#374151', borderColor: tab === id ? '#1E7A3A' : '#E5E7EB' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Filtre période */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {FILTERS.map((label) => {
          const active = filter === label;
          return (
            <button key={label} onClick={() => setFilter(label)}
              className="px-4 py-1.5 rounded-full text-sm font-medium border transition"
              style={{ backgroundColor: active ? '#F7921E' : 'white', color: active ? 'white' : '#374151', borderColor: active ? '#F7921E' : '#E5E7EB' }}>
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'acquisition' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Nouveaux inscrits (période)" value={nb(k.newUsers)} accent />
          <KpiCard label="Utilisateurs (total)" value={nb(k.totalUsers)} />
          <KpiCard label="Fiches joueurs créées" value={nb(k.fiches)} />
          <KpiCard label="Taux de conversion" value="—" soon />
          <KpiCard label="Sessions totales" value="—" soon />
          <KpiCard label="Sessions Leagues" value="—" soon />
          <KpiCard label="Sessions Réservation" value="—" soon />
        </div>
      )}

      {tab === 'ligues' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Ligues actives" value={nb(k.leaguesActive)} accent />
          <KpiCard label="Ligues (total)" value={nb(k.totalLeagues)} />
          <KpiCard label="Équipes inscrites" value={nb(k.teams)} />
          <KpiCard label="Matchs joués" value={nb(k.matchsJoues)} />
          <KpiCard label="Fiches joueurs créées" value={nb(k.fiches)} />
          <KpiCard label="Taux de remplissage" value="—" soon />
        </div>
      )}

      {tab === 'reservations' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Réservations (période)" value={nb(k.resTotal)} accent />
          <KpiCard label="Confirmées" value={nb(k.confirmed)} />
          <KpiCard label="Annulées" value={nb(k.cancelled)} />
          <KpiCard label="Montant total" value={loaded ? fcfa(k.montant) : '—'} />
          <KpiCard label="Commission GBONHI" value={loaded ? fcfa(k.commission) : '—'} />
          <KpiCard label="Terrains actifs" value={nb(k.terrains)} />
          <KpiCard label="Taux d'occupation" value="—" soon />
        </div>
      )}
    </>
  );
}
