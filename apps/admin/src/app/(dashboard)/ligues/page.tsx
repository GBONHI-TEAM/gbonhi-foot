'use client';
import { useEffect, useState } from 'react';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  CalendarPlus,
  Pause,
  Archive,
  Unlock,
  Lock,
  Play,
  Flag,
} from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { apiFetch } from '../../../lib/api';
import { createSupabaseBrowserClient } from '../../../lib/supabase/client';

type LeagueStatus =
  | 'BROUILLON'
  | 'INSCRIPTIONS_OUVERTES'
  | 'INSCRIPTIONS_CLOSES'
  | 'EN_COURS'
  | 'SUSPENDUE'
  | 'TERMINÉE'
  | 'ARCHIVÉE';

interface ApiLeague {
  id: string;
  name: string;
  status: LeagueStatus;
  max_teams: number;
  start_date: string;
  end_date: string;
  prize_info?: string | null;
  format?: string | null;
  level?: string | null;
  _count?: { teams: number; matches: number };
}

interface League {
  id: string;
  name: string;
  level: string | null;
  status: LeagueStatus;
  teams: number;
  max_teams: number;
  prize: string;
  dates: string;
}

/** Badge Statut — mappe le statut interne vers le libellé/couleur de la maquette. */
const STATUS_META: Record<LeagueStatus, { label: string; bg: string; color: string }> = {
  BROUILLON: { label: 'À VENIR', bg: '#FEF3C7', color: '#B45309' },
  INSCRIPTIONS_OUVERTES: { label: 'ACTIVE', bg: '#DCFCE7', color: '#15803D' },
  INSCRIPTIONS_CLOSES: { label: 'ACTIVE', bg: '#DCFCE7', color: '#15803D' },
  EN_COURS: { label: 'ACTIVE', bg: '#DCFCE7', color: '#15803D' },
  SUSPENDUE: { label: 'SUSPENDUE', bg: '#FEE2E2', color: '#B91C1C' },
  TERMINÉE: { label: 'TERMINÉE', bg: '#F3F4F6', color: '#6B7280' },
  ARCHIVÉE: { label: 'ARCHIVÉE', bg: '#F3F4F6', color: '#9CA3AF' },
};

const LEVEL_META: Record<string, { bg: string; color: string }> = {
  Loisir: { bg: '#F3F4F6', color: '#6B7280' },
  Confirmé: { bg: '#DBEAFE', color: '#1D4ED8' },
  Élite: { bg: '#FEF3C7', color: '#B45309' },
};

const TAB_FILTERS = ['Toutes', 'Actives', 'À venir', 'Terminées', 'Suspendues'];

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return '—';
  }
}

function mapLeague(l: ApiLeague): League {
  return {
    id: l.id,
    name: l.name,
    level: l.level ?? null,
    status: l.status,
    teams: l._count?.teams ?? 0,
    max_teams: l.max_teams,
    prize: l.prize_info?.trim() ? l.prize_info : '—',
    dates: `${fmtDate(l.start_date)} – ${fmtDate(l.end_date)}`,
  };
}

function StatusBadge({ status }: { status: LeagueStatus }) {
  const { label, bg, color } = STATUS_META[status];
  return (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide" style={{ backgroundColor: bg, color }}>
      {label}
    </span>
  );
}

function LevelBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-gray-400">—</span>;
  const meta = LEVEL_META[level] ?? { bg: '#F3F4F6', color: '#6B7280' };
  return (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: meta.bg, color: meta.color }}>
      {level}
    </span>
  );
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  BROUILLON: ['INSCRIPTIONS_OUVERTES'],
  INSCRIPTIONS_OUVERTES: ['INSCRIPTIONS_CLOSES', 'SUSPENDUE'],
  INSCRIPTIONS_CLOSES: ['EN_COURS', 'SUSPENDUE'],
  EN_COURS: ['SUSPENDUE', 'TERMINÉE'],
  SUSPENDUE: ['EN_COURS', 'ARCHIVÉE'],
  TERMINÉE: ['ARCHIVÉE'],
  ARCHIVÉE: [],
};

function ActionMenu({
  onClose,
  onEdit,
  onGenerate,
  onStatus,
  status,
}: {
  onClose: () => void;
  onEdit: () => void;
  onGenerate: () => void;
  onStatus: (status: string) => void;
  status: string;
}) {
  const allowed = STATUS_TRANSITIONS[status] ?? [];
  const can = (s: string) => allowed.includes(s);
  const hasStatusActions = can('INSCRIPTIONS_OUVERTES') || can('INSCRIPTIONS_CLOSES') || can('EN_COURS') || can('TERMINÉE');
  const hasCritical = can('SUSPENDUE') || can('ARCHIVÉE');

  return (
    <div
      className="absolute right-0 top-8 z-50 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2"
      onMouseLeave={onClose}
    >
      <p className="px-4 pt-1 pb-1.5 text-[10px] font-bold tracking-widest text-gray-400 uppercase">Gérer</p>
      <MenuItem icon={<Pencil size={15} />} label="Modifier" onClick={() => { onEdit(); onClose(); }} />
      <MenuItem icon={<CalendarPlus size={15} />} label="Générer le calendrier" onClick={() => { onGenerate(); onClose(); }} />

      {hasStatusActions && (
        <>
          <div className="my-1.5 border-t border-gray-100" />
          <p className="px-4 pt-1 pb-1.5 text-[10px] font-bold tracking-widest text-gray-400 uppercase">Statut</p>
          {can('INSCRIPTIONS_OUVERTES') && <MenuItem icon={<Unlock size={15} />} label="Ouvrir les inscriptions" onClick={() => { onStatus('INSCRIPTIONS_OUVERTES'); onClose(); }} />}
          {can('INSCRIPTIONS_CLOSES') && <MenuItem icon={<Lock size={15} />} label="Fermer les inscriptions" onClick={() => { onStatus('INSCRIPTIONS_CLOSES'); onClose(); }} />}
          {can('EN_COURS') && <MenuItem icon={<Play size={15} />} label="Démarrer la ligue" onClick={() => { onStatus('EN_COURS'); onClose(); }} />}
          {can('TERMINÉE') && <MenuItem icon={<Flag size={15} />} label="Terminer la ligue" onClick={() => { onStatus('TERMINÉE'); onClose(); }} />}
        </>
      )}

      {hasCritical && (
        <>
          <div className="my-1.5 border-t border-gray-100" />
          <p className="px-4 pt-1 pb-1.5 text-[10px] font-bold tracking-widest uppercase" style={{ color: '#DC2626' }}>Actions critiques</p>
          {can('SUSPENDUE') && <MenuItem icon={<Pause size={15} />} label="Suspendre" danger onClick={() => { onStatus('SUSPENDUE'); onClose(); }} />}
          {can('ARCHIVÉE') && <MenuItem icon={<Archive size={15} />} label="Archiver" danger onClick={() => { onStatus('ARCHIVÉE'); onClose(); }} />}
        </>
      )}
    </div>
  );
}

function MenuItem({ icon, label, danger, onClick }: { icon: React.ReactNode; label: string; danger?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-gray-50 transition"
      style={{ color: danger ? '#DC2626' : '#374151' }}
    >
      <span style={{ color: danger ? '#DC2626' : '#6B7280' }}>{icon}</span>
      {label}
    </button>
  );
}

const NIVEAUX = ['Loisir', 'Confirmé', 'Élite'];

/** Champ label + input — reproduit la maquette Écran 9 (labels au-dessus des champs). */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-800 mb-2">{label}</label>
      {children}
    </div>
  );
}

const INPUT_CLS =
  'w-full h-11 px-4 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition';

const FORMATS: { value: string; label: string }[] = [
  { value: 'round_robin', label: 'Championnat (round-robin)' },
  { value: 'single_elimination', label: 'Coupe (élimination directe)' },
  { value: 'double_elimination', label: 'Coupe (double élimination)' },
  { value: 'league', label: 'Championnat + Play-offs' },
];

/** Modal création / édition d'une ligue — tous les champs configurables. */
function LeagueFormModal({ leagueId, onClose, onSaved }: { leagueId?: string | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!leagueId;
  const [name, setName] = useState('');
  const [level, setLevel] = useState('Loisir');
  const [format, setFormat] = useState('round_robin');
  const [maxTeams, setMaxTeams] = useState('10');
  const [matchesPerTeam, setMatchesPerTeam] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fee, setFee] = useState('');
  const [prize, setPrize] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [rewards, setRewards] = useState('');
  const [banner, setBanner] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-remplissage en édition.
  useEffect(() => {
    if (!leagueId) return;
    (async () => {
      try {
        const l = await apiFetch<Record<string, unknown>>(`/leagues/${leagueId}`);
        setName((l.name as string) ?? '');
        setLevel((l.level as string) ?? 'Loisir');
        setFormat((l.format as string) ?? 'Championnat');
        setMaxTeams(String((l.max_teams as number) ?? 10));
        setMatchesPerTeam(l.matches_per_team != null ? String(l.matches_per_team) : '');
        setStartDate(l.start_date ? String(l.start_date).slice(0, 10) : '');
        setEndDate(l.end_date ? String(l.end_date).slice(0, 10) : '');
        setFee(l.registration_fee != null ? String(l.registration_fee) : '');
        setPrize((l.prize_info as string) ?? '');
        setLocation((l.location as string) ?? '');
        setDescription((l.description as string) ?? '');
        setRules((l.rules as string) ?? '');
        setRewards((l.rewards as string) ?? '');
        setBanner((l.banner_url as string) ?? '');
      } catch {
        setError('Impossible de charger la ligue.');
      }
    })();
  }, [leagueId]);

  async function uploadBanner(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('leagues').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
      if (upErr) { setError(`Échec de l'envoi de la bannière : ${upErr.message}`); return; }
      const { data } = supabase.storage.from('leagues').getPublicUrl(path);
      if (data?.publicUrl) setBanner(data.publicUrl);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setError(null);
    if (name.trim().length < 3) { setError('Le nom doit contenir au moins 3 caractères.'); return; }
    if (!startDate || !endDate) { setError('Renseigne les dates de début et de fin.'); return; }
    const maxN = parseInt(maxTeams, 10);
    if (!Number.isFinite(maxN) || maxN < 4) { setError('Le nombre max d\'équipes doit être ≥ 4.'); return; }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      level,
      format,
      max_teams: maxN,
      start_date: startDate,
      end_date: endDate,
      registration_fee: Number((fee || '0').replace(/\s/g, '')) || 0,
      prize_info: prize.trim() || undefined,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      rules: rules.trim() || undefined,
      rewards: rewards.trim() || undefined,
      banner_url: banner || undefined,
    };
    const mpt = parseInt(matchesPerTeam, 10);
    if (Number.isFinite(mpt) && mpt > 0) payload.matches_per_team = mpt;

    setSaving(true);
    try {
      await apiFetch(isEdit ? `/leagues/${leagueId}` : '/leagues', {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      onSaved();
    } catch (e) {
      setError(`Échec de l'enregistrement. ${e instanceof Error ? e.message : ''}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-black text-gray-900 mb-6">{isEdit ? 'Modifier la ligue' : 'Créer une nouvelle ligue'}</h2>

        <div className="space-y-5">
          <Field label="Nom de la ligue">
            <input className={INPUT_CLS} placeholder="Ex : Ligue Élite Cocody" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-6">
            <Field label="Niveau">
              <div className="flex gap-2">
                {NIVEAUX.map((n) => {
                  const active = level === n;
                  return (
                    <button key={n} type="button" onClick={() => setLevel(n)}
                      className="px-5 h-11 rounded-lg text-sm font-semibold border transition"
                      style={{ backgroundColor: active ? '#F0FDF4' : 'white', borderColor: active ? '#1E7A3A' : '#E5E7EB', color: active ? '#1E7A3A' : '#9CA3AF' }}>
                      {n}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Format">
              <select value={format} onChange={(e) => setFormat(e.target.value)} className={`${INPUT_CLS} bg-white`}>
                {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Field label="Max équipes"><input className={INPUT_CLS} type="number" min={4} value={maxTeams} onChange={(e) => setMaxTeams(e.target.value)} /></Field>
            <Field label="Matchs par équipe"><input className={INPUT_CLS} type="number" min={1} placeholder="Ex : 6" value={matchesPerTeam} onChange={(e) => setMatchesPerTeam(e.target.value)} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Field label="Date de début"><input className={INPUT_CLS} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="Date de fin"><input className={INPUT_CLS} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Field label="Coût inscription (FCFA)"><input className={INPUT_CLS} placeholder="Ex : 25000" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
            <Field label="Dotation (texte)"><input className={INPUT_CLS} placeholder="Ex : 2 000 000 FCFA" value={prize} onChange={(e) => setPrize(e.target.value)} /></Field>
          </div>

          <Field label="Lieu / zone"><input className={INPUT_CLS} placeholder="Ex : Cocody, Abidjan" value={location} onChange={(e) => setLocation(e.target.value)} /></Field>

          <Field label="Description"><textarea className={`${INPUT_CLS.replace('h-11', 'min-h-[80px] py-3')}`} placeholder="Présentation de la ligue…" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>

          <Field label="Règlement"><textarea className={`${INPUT_CLS.replace('h-11', 'min-h-[110px] py-3')}`} placeholder="Règlement intérieur de la ligue…" value={rules} onChange={(e) => setRules(e.target.value)} /></Field>

          <Field label="Récompenses"><textarea className={`${INPUT_CLS.replace('h-11', 'min-h-[90px] py-3')}`} placeholder="1er : trophée + 150 000 F&#10;2e : 75 000 F&#10;Meilleur buteur : …" value={rewards} onChange={(e) => setRewards(e.target.value)} /></Field>

          {/* Bannière */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-800 mb-2">Bannière de la ligue</label>
            <div className="flex items-center gap-4">
              <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50" style={{ width: 160, height: 90 }}>
                {banner ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={banner} alt="Bannière" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Aucune</div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="px-4 h-10 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center">
                  {uploading ? 'Envoi…' : 'Choisir une image'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => uploadBanner(e.target.files?.[0] ?? null)} />
                </label>
                {banner ? <button type="button" onClick={() => setBanner('')} className="text-xs text-red-600 text-left">Retirer</button> : null}
              </div>
            </div>
          </div>
        </div>

        {error && <p className="mt-6 text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>}

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="px-6 h-11 rounded-lg text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-6 h-11 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: '#1E7A3A' }}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer les modifications' : 'Créer la ligue'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LiguesPage() {
  const [activeTab, setActiveTab] = useState('Toutes');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function reload() {
    try {
      const data = await apiFetch<ApiLeague[]>('/leagues');
      setLeagues(Array.isArray(data) ? data.map(mapLeague) : []);
    } catch {
      setLeagues([]);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { reload(); }, []);

  async function changeStatus(id: string, status: string) {
    const body: { status: string; reason?: string } = { status };
    if (status === 'SUSPENDUE') {
      const reason = window.prompt('Raison de la suspension ?') ?? '';
      if (!reason.trim()) return;
      body.reason = reason.trim();
    }
    try {
      await apiFetch(`/leagues/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) });
      reload();
    } catch (e) {
      alert(`Action impossible. ${e instanceof Error ? e.message : ''}`);
    }
  }
  async function generateCal(id: string) {
    try {
      await apiFetch(`/leagues/${id}/calendar/generate`, { method: 'POST' });
      alert('Calendrier généré.');
    } catch {
      alert('Génération impossible.');
    }
  }

  const filtered = leagues.filter((l) => {
    if (activeTab === 'Toutes') return true;
    if (activeTab === 'Actives') return ['INSCRIPTIONS_OUVERTES', 'EN_COURS', 'INSCRIPTIONS_CLOSES'].includes(l.status);
    if (activeTab === 'À venir') return l.status === 'BROUILLON';
    if (activeTab === 'Terminées') return l.status === 'TERMINÉE';
    if (activeTab === 'Suspendues') return l.status === 'SUSPENDUE';
    return true;
  });

  return (
    <>
      <Header title="Gestion des Ligues" />

      <div className="flex items-center justify-between mb-6">
        {/* Chips filtre — pill actif vert plein, inactifs blancs bordés */}
        <div className="flex gap-2.5">
          {TAB_FILTERS.map((t) => {
            const active = activeTab === t;
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className="px-4 py-1.5 rounded-full text-sm font-medium border transition"
                style={{
                  backgroundColor: active ? '#1E7A3A' : 'white',
                  color: active ? 'white' : '#374151',
                  borderColor: active ? '#1E7A3A' : '#E5E7EB',
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        {/* CTA orange — SANS glow */}
        <button
          onClick={() => { setEditId(null); setFormOpen(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: '#F7921E' }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Créer une ligue
        </button>
      </div>

      {formOpen && (
        <LeagueFormModal
          leagueId={editId}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); reload(); }}
        />
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500">Nom</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500">Niveau</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500">Équipes</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500">Récompense 1er</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500">Dates</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500">Statut</th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((league) => (
              <tr key={league.id} className="hover:bg-gray-50 transition">
                <td className="px-5 py-4 font-semibold text-gray-900">{league.name}</td>
                <td className="px-5 py-4"><LevelBadge level={league.level} /></td>
                <td className="px-5 py-4 text-gray-700">{league.teams}/{league.max_teams}</td>
                <td className="px-5 py-4 text-gray-700">{league.prize}</td>
                <td className="px-5 py-4 text-gray-500">{league.dates}</td>
                <td className="px-5 py-4"><StatusBadge status={league.status} /></td>
                <td className="px-5 py-4">
                  <div className="relative flex justify-end">
                    <button
                      onClick={() => setOpenMenu(openMenu === league.id ? null : league.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {openMenu === league.id && (
                      <ActionMenu
                        status={league.status}
                        onClose={() => setOpenMenu(null)}
                        onEdit={() => { setEditId(league.id); setFormOpen(true); }}
                        onGenerate={() => generateCal(league.id)}
                        onStatus={(status) => changeStatus(league.id, status)}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center text-gray-400 text-sm">
                  {!loaded
                    ? 'Chargement…'
                    : leagues.length === 0
                    ? 'Aucune ligue pour le moment. Créez votre première ligue.'
                    : 'Aucune ligue dans cette catégorie.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
