'use client';
import { useEffect, useRef, useState } from 'react';
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
  Trash2,
  RotateCcw,
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
  { value: 'groups', label: 'Poules + phase finale' },
  { value: 'double_elimination', label: 'Coupe (double élimination)' },
  { value: 'league', label: 'Championnat + Play-offs' },
];

/** Ajoute des jours à une date ISO (yyyy-mm-dd). */
function addDaysIso(iso: string, days: number): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Génère intelligemment le nombre de journées et de matchs par équipe selon
 * le format, le nombre d'équipes et le type de matchs (aller / aller-retour).
 */
function computeSchedule(opts: {
  format: string; teams: number; legs: number; poolCount: number; qualifiersPerPool: number;
}): { journees: number; matchesPerTeam: number } {
  const n = Math.max(2, opts.teams || 0);
  const L = opts.legs === 2 ? 2 : 1;
  const log2 = (x: number) => Math.ceil(Math.log2(Math.max(2, x)));
  switch (opts.format) {
    case 'round_robin': {
      const j = (n - 1) * L;
      return { journees: j, matchesPerTeam: j };
    }
    case 'league': {
      // Championnat aller(-retour) + play-offs (demi + finale ≈ 2 tours).
      const rr = (n - 1) * L;
      return { journees: rr + 2, matchesPerTeam: rr + 1 };
    }
    case 'groups': {
      const pools = Math.max(2, opts.poolCount || 2);
      const perPool = Math.ceil(n / pools);
      const groupJ = (perPool - 1) * L;
      const qualifs = pools * Math.max(1, opts.qualifiersPerPool || 1);
      const finals = qualifs >= 2 ? log2(qualifs) : 0;
      return { journees: groupJ + finals, matchesPerTeam: groupJ + 1 };
    }
    case 'single_elimination': {
      const r = log2(n);
      return { journees: r, matchesPerTeam: r };
    }
    case 'double_elimination': {
      const r = log2(n);
      return { journees: 2 * r - 1, matchesPerTeam: r + 1 };
    }
    default:
      return { journees: (n - 1) * L, matchesPerTeam: (n - 1) * L };
  }
}

/**
 * Section « Classement » du règlement, adaptée au format de la compétition.
 * C'est la principale différence de règles d'un format à l'autre.
 */
function classementRubrique(format: string): string {
  switch (format) {
    case 'single_elimination':
      return `4. CLASSEMENT & QUALIFICATION
- Compétition à élimination directe : le perdant est éliminé.
- En cas d'égalité à la fin du temps réglementaire : prolongation, puis tirs au but.
- Le vainqueur de la finale est déclaré champion.`;
    case 'double_elimination':
      return `4. CLASSEMENT & QUALIFICATION
- Double élimination : une équipe n'est éliminée qu'après deux défaites.
- Tableau principal (winners) et tableau de repêchage (losers).
- En cas d'égalité : prolongation, puis tirs au but.`;
    case 'groups':
      return `4. CLASSEMENT & QUALIFICATION
- Phase de poules au classement par points : victoire 3, match nul 1, défaite 0.
- Départage : différence de buts, puis buts marqués, puis confrontation directe.
- Les qualifiés de chaque poule accèdent à la phase finale (élimination directe).
- Phase finale : en cas d'égalité, prolongation puis tirs au but.`;
    case 'league':
      return `4. CLASSEMENT & QUALIFICATION
- Saison régulière au classement par points : victoire 3, match nul 1, défaite 0.
- Départage : différence de buts, puis buts marqués, puis confrontation directe.
- Les mieux classés disputent les play-offs (élimination directe) pour le titre.`;
    default: // round_robin
      return `4. CLASSEMENT
- Classement au point : victoire 3, match nul 1, défaite 0.
- Départage : différence de buts, puis buts marqués, puis confrontation directe.
- L'équipe en tête à l'issue de toutes les journées est déclarée championne.`;
  }
}

/**
 * Règlement intérieur type, organisé en rubriques et adapté au format.
 * Entièrement modifiable par l'organisateur après pré-remplissage.
 */
function reglementFor(format: string): string {
  return `RÈGLEMENT INTÉRIEUR

1. ÉLIGIBILITÉ
- Chaque équipe doit être inscrite et à jour de ses frais d'engagement.
- Seuls les joueurs figurant sur la liste officielle déposée peuvent participer.
- Un joueur ne peut représenter qu'une seule équipe sur toute la compétition.

2. FEUILLE DE MATCH
- La composition doit être communiquée avant le coup d'envoi.
- Une pièce d'identité peut être exigée pour vérifier l'identité des joueurs.
- Le nombre de remplaçants autorisés est fixé par l'organisation.

3. RETARDS & FORFAITS
- 15 minutes de retard après l'heure officielle = forfait.
- Un forfait est sanctionné par une défaite 3-0.
- Deux forfaits peuvent entraîner l'exclusion de l'équipe.

${classementRubrique(format)}

5. DISCIPLINE
- 2 cartons jaunes cumulés = 1 match de suspension.
- Carton rouge = exclusion du match en cours + suspension automatique.
- Tout comportement antisportif peut entraîner des sanctions, jusqu'à l'exclusion.

6. REPORTS & LITIGES
- Toute demande de report doit parvenir à l'organisation au moins 48 h à l'avance.
- Un match reporté est rejoué dans le délai fixé par l'organisation.
- Toute réclamation se fait par écrit auprès de l'organisation sous 24 h.`;
}

// ── Récompenses structurées ──
type RewardType = 'money' | 'trophy' | 'equipment' | 'other';

const REWARD_TYPE_OPTIONS: { value: RewardType; label: string }[] = [
  { value: 'money', label: 'Argent' },
  { value: 'trophy', label: 'Trophée' },
  { value: 'equipment', label: 'Équipement' },
  { value: 'other', label: 'Autre' },
];

interface RewardRow {
  key: string;
  label: string;
  type: RewardType;
  amount: string; // saisie brute, convertie en nombre à l'enregistrement
  description: string;
  preset: boolean; // ligne pré-définie (intitulé verrouillé) ou personnalisée
}

/** Intitulés pré-définis, tous optionnels. */
const PRESET_REWARD_LABELS = ['Champion', 'Finaliste (2e)', '3e place', 'Meilleur buteur', 'Meilleur joueur'];

let rewardKeySeq = 0;
const nextRewardKey = () => `rw-${++rewardKeySeq}`;

function makePresetRows(): RewardRow[] {
  return PRESET_REWARD_LABELS.map((label) => ({
    key: nextRewardKey(),
    label,
    type: 'money' as RewardType,
    amount: '',
    description: '',
    preset: true,
  }));
}

/** Une ligne est « renseignée » dès qu'un montant ou une description est saisi. */
function isRewardFilled(r: RewardRow): boolean {
  return r.amount.trim().length > 0 || r.description.trim().length > 0;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[\s.]/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

const fmtFcfa = new Intl.NumberFormat('fr-FR');

/** Hydrate les lignes du formulaire depuis le rewards_json de l'API. */
function rowsFromApi(json: unknown): RewardRow[] {
  const rows = makePresetRows();
  if (!Array.isArray(json)) return rows;
  const byLabel = new Map(rows.map((r) => [r.label.toLowerCase(), r]));
  for (const item of json as Array<Record<string, unknown>>) {
    const label = String(item?.label ?? '').trim();
    if (!label) continue;
    const type = (['money', 'trophy', 'equipment', 'other'].includes(String(item?.type)) ? item.type : 'other') as RewardType;
    const amount = item?.amount != null ? String(item.amount) : '';
    const description = item?.description != null ? String(item.description) : '';
    const preset = byLabel.get(label.toLowerCase());
    if (preset) {
      preset.type = type;
      preset.amount = amount;
      preset.description = description;
    } else {
      rows.push({ key: nextRewardKey(), label, type, amount, description, preset: false });
    }
  }
  return rows;
}

/** Modal création / édition d'une ligue — tous les champs configurables. */
function LeagueFormModal({ leagueId, onClose, onSaved }: { leagueId?: string | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!leagueId;
  const [name, setName] = useState('');
  const [level, setLevel] = useState('Loisir');
  const [format, setFormat] = useState('round_robin');
  const [maxTeams, setMaxTeams] = useState('10');
  const [matchesPerTeam, setMatchesPerTeam] = useState('');
  const [legs, setLegs] = useState('1'); // 1 = aller simple, 2 = aller-retour
  const [matchDuration, setMatchDuration] = useState('60');
  const [roundInterval, setRoundInterval] = useState('7');
  const [poolCount, setPoolCount] = useState('2');
  const [qualifiersPerPool, setQualifiersPerPool] = useState('2');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fee, setFee] = useState('');
  const [prize, setPrize] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  // Récompenses en lignes structurées (intitulé, type, montant, description).
  const [rewardRows, setRewardRows] = useState<RewardRow[]>(() => makePresetRows());
  // Dernier modèle de règlement appliqué automatiquement (détecte une personnalisation).
  const lastTemplateRef = useRef<string>('');
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
        setLegs(String((l.legs as number) ?? 1));
        setMatchDuration(String((l.match_duration_min as number) ?? 60));
        setRoundInterval(String((l.round_interval_days as number) ?? 7));
        setPoolCount(String((l.pool_count as number) ?? 2));
        setQualifiersPerPool(String((l.qualifiers_per_pool as number) ?? 2));
        setStartDate(l.start_date ? String(l.start_date).slice(0, 10) : '');
        setEndDate(l.end_date ? String(l.end_date).slice(0, 10) : '');
        setFee(l.registration_fee != null ? String(l.registration_fee) : '');
        setPrize((l.prize_info as string) ?? '');
        setLocation((l.location as string) ?? '');
        setDescription((l.description as string) ?? '');
        const loadedRules = (l.rules as string) ?? '';
        setRules(loadedRules);
        lastTemplateRef.current = loadedRules; // en édition, on respecte le texte existant
        setRewardRows(rowsFromApi(l.rewards_json));
        setBanner((l.banner_url as string) ?? '');
      } catch {
        setError('Impossible de charger la ligue.');
      }
    })();
  }, [leagueId]);

  // Création : pré-remplit un règlement type adapté au format (modifiable).
  useEffect(() => {
    if (leagueId) return;
    const tpl = reglementFor(format);
    setRules(tpl);
    lastTemplateRef.current = tpl;
    // Uniquement au montage en mode création.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Changement de format : régénère la partie basse du calendrier et propose de
   * mettre à jour le règlement. Si l'organisateur a déjà personnalisé le texte,
   * on demande confirmation avant de l'écraser.
   */
  function handleFormatChange(next: string) {
    setFormat(next);
    const tpl = reglementFor(next);
    const customized = rules.trim() !== '' && rules !== lastTemplateRef.current;
    if (!customized || window.confirm('Le format a changé. Remplacer le règlement actuel par le modèle adapté au nouveau format ? Vos modifications seront perdues.')) {
      setRules(tpl);
      lastTemplateRef.current = tpl;
    }
  }

  function restoreReglement() {
    const tpl = reglementFor(format);
    if (rules === tpl || window.confirm('Restaurer le modèle de règlement ? Vos modifications seront perdues.')) {
      setRules(tpl);
      lastTemplateRef.current = tpl;
    }
  }

  // Résumé des récompenses : nombre de prix renseignés + dotation totale (argent).
  const filledRewards = rewardRows.filter(isRewardFilled);
  const totalDotation = filledRewards.reduce((sum, r) => {
    if (r.type !== 'money') return sum;
    const n = parseAmount(r.amount);
    return sum + (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);

  function updateRow(key: string, patch: Partial<RewardRow>) {
    setRewardRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addCustomRow() {
    setRewardRows((rows) => [...rows, { key: nextRewardKey(), label: '', type: 'money', amount: '', description: '', preset: false }]);
  }
  function removeRow(key: string) {
    setRewardRows((rows) => rows.filter((r) => r.key !== key));
  }

  // Génération intelligente : matchs/équipe + date de fin déduits du format,
  // du nombre d'équipes, du type de matchs et de l'écart entre journées.
  const schedule = computeSchedule({
    format,
    teams: parseInt(maxTeams, 10) || 0,
    legs: parseInt(legs, 10) || 1,
    poolCount: parseInt(poolCount, 10) || 2,
    qualifiersPerPool: parseInt(qualifiersPerPool, 10) || 2,
  });
  useEffect(() => {
    setMatchesPerTeam(String(schedule.matchesPerTeam));
    const interval = Math.max(1, parseInt(roundInterval, 10) || 7);
    if (startDate && schedule.journees > 0) {
      setEndDate(addDaysIso(startDate, (schedule.journees - 1) * interval));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, maxTeams, legs, poolCount, qualifiersPerPool, roundInterval, startDate]);

  async function uploadBanner(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) { setError('Session expirée. Reconnecte-toi puis réessaie.'); return; }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      // Chemin préfixé par l'UID (les policies Storage restreignent l'écriture à `<uid>/…`).
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
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
    // La date de fin ne peut pas être antérieure (ni égale) à la date de début.
    if (new Date(`${endDate}T00:00:00`) <= new Date(`${startDate}T00:00:00`)) {
      setError('La date de fin doit être postérieure à la date de début.');
      return;
    }
    const maxN = parseInt(maxTeams, 10);
    if (!Number.isFinite(maxN) || maxN < 4) { setError('Le nombre max d\'équipes doit être ≥ 4.'); return; }

    // ── Validation & assemblage des récompenses (toutes optionnelles) ──
    const rewardsJson: { label: string; type: RewardType; amount: number | null; description: string | null }[] = [];
    for (const r of rewardRows) {
      const touched = isRewardFilled(r);
      const labelOk = r.label.trim().length > 0;
      // Une ligne personnalisée renseignée doit avoir un intitulé.
      if (touched && !labelOk) { setError('Chaque récompense renseignée doit avoir un intitulé.'); return; }
      if (!touched || !labelOk) continue; // ligne vide → ignorée

      const amountNum = parseAmount(r.amount);
      if (amountNum !== null && Number.isNaN(amountNum)) { setError(`Montant invalide pour « ${r.label.trim()} ».`); return; }
      if (typeof amountNum === 'number' && amountNum < 0) { setError('Un montant ne peut pas être négatif.'); return; }
      if (r.type === 'money' && !(typeof amountNum === 'number' && amountNum > 0)) {
        setError(`Renseigne un montant pour la récompense en argent « ${r.label.trim()} ».`);
        return;
      }
      rewardsJson.push({
        label: r.label.trim(),
        type: r.type,
        amount: r.type === 'money' ? (amountNum as number) : null,
        description: r.description.trim() || null,
      });
    }

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
      rewards_json: rewardsJson.length > 0 ? rewardsJson : [],
      banner_url: banner || undefined,
    };
    const mpt = parseInt(matchesPerTeam, 10);
    if (Number.isFinite(mpt) && mpt > 0) payload.matches_per_team = mpt;
    payload.legs = parseInt(legs, 10) === 2 ? 2 : 1;
    const dur = parseInt(matchDuration, 10);
    if (Number.isFinite(dur) && dur >= 30) payload.match_duration_min = dur;
    const interval = parseInt(roundInterval, 10);
    if (Number.isFinite(interval) && interval >= 1) payload.round_interval_days = interval;
    if (format === 'groups') {
      const pc = parseInt(poolCount, 10);
      if (Number.isFinite(pc) && pc >= 2) payload.pool_count = pc;
      const qpp = parseInt(qualifiersPerPool, 10);
      if (Number.isFinite(qpp) && qpp >= 1) payload.qualifiers_per_pool = qpp;
    }

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
              <select value={format} onChange={(e) => handleFormatChange(e.target.value)} className={`${INPUT_CLS} bg-white`}>
                {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Field label="Max équipes"><input className={INPUT_CLS} type="number" min={4} value={maxTeams} onChange={(e) => setMaxTeams(e.target.value)} /></Field>
            <Field label="Matchs par équipe (auto)"><input className={`${INPUT_CLS} bg-gray-50 text-gray-500`} type="number" value={matchesPerTeam} readOnly title="Calculé automatiquement selon le format, le nombre d'équipes et le type de matchs" /></Field>
          </div>

          {format === 'groups' && (
            <div className="grid grid-cols-2 gap-6">
              <Field label="Nombre de poules"><input className={INPUT_CLS} type="number" min={2} value={poolCount} onChange={(e) => setPoolCount(e.target.value)} /></Field>
              <Field label="Qualifiés par poule"><input className={INPUT_CLS} type="number" min={1} value={qualifiersPerPool} onChange={(e) => setQualifiersPerPool(e.target.value)} /></Field>
            </div>
          )}

          {(format === 'round_robin' || format === 'league' || format === 'groups') && (
            <Field label="Type de matchs">
              <div className="flex gap-2">
                {[
                  { v: '1', label: 'Aller simple' },
                  { v: '2', label: 'Aller-retour' },
                ].map((opt) => {
                  const active = legs === opt.v;
                  return (
                    <button key={opt.v} type="button" onClick={() => setLegs(opt.v)}
                      className="px-5 h-11 rounded-lg text-sm font-semibold border transition"
                      style={{ backgroundColor: active ? '#F0FDF4' : 'white', borderColor: active ? '#1E7A3A' : '#E5E7EB', color: active ? '#1E7A3A' : '#9CA3AF' }}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-6">
            <Field label="Durée d'un match (min)"><input className={INPUT_CLS} type="number" min={30} step={15} value={matchDuration} onChange={(e) => setMatchDuration(e.target.value)} /></Field>
            <Field label="Écart entre journées (jours)"><input className={INPUT_CLS} type="number" min={1} value={roundInterval} onChange={(e) => setRoundInterval(e.target.value)} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Field label="Date de début"><input className={INPUT_CLS} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="Date de fin (auto)"><input className={`${INPUT_CLS} bg-gray-50 text-gray-500`} type="date" value={endDate} readOnly title="Calculée : date de début + (nombre de journées − 1) × écart entre journées" /></Field>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Field label="Coût inscription (FCFA)"><input className={INPUT_CLS} placeholder="Ex : 25000" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
            <Field label="Dotation (texte)"><input className={INPUT_CLS} placeholder="Ex : 2 000 000 FCFA" value={prize} onChange={(e) => setPrize(e.target.value)} /></Field>
          </div>

          <Field label="Lieu / zone"><input className={INPUT_CLS} placeholder="Ex : Cocody, Abidjan" value={location} onChange={(e) => setLocation(e.target.value)} /></Field>

          <Field label="Description"><textarea className={`${INPUT_CLS.replace('h-11', 'min-h-[80px] py-3')}`} placeholder="Présentation de la ligue…" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>

          {/* Règlement intérieur — pré-rempli par rubriques, entièrement modifiable */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[13px] font-semibold text-gray-800">Règlement intérieur</label>
              <button
                type="button"
                onClick={restoreReglement}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 hover:text-gray-800 transition"
                title="Remplacer par le modèle adapté au format sélectionné"
              >
                <RotateCcw size={13} /> Restaurer le modèle
              </button>
            </div>
            <textarea
              className={`${INPUT_CLS.replace('h-11', 'min-h-[220px] py-3 font-mono text-[13px] leading-relaxed')}`}
              placeholder="Règlement intérieur de la ligue…"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
            />
            <p className="mt-1.5 text-[12px] text-gray-400">Modèle pré-rempli (éligibilité, feuille de match, retards/forfaits, classement, discipline, reports) adapté au format. Adaptez-le librement.</p>
          </div>

          {/* Récompenses structurées — toutes optionnelles */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-800 mb-1">Récompenses</label>
            <p className="mb-3 text-[12px] text-gray-400">Chaque récompense est facultative. Laissez une ligne vide pour l'ignorer. Un montant est requis uniquement pour le type « Argent ».</p>

            <div className="space-y-2.5">
              {/* En-têtes de colonnes */}
              <div className="hidden md:grid grid-cols-[1.3fr_0.9fr_1fr_1.4fr_32px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                <span>Intitulé</span><span>Type</span><span>Montant (FCFA)</span><span>Description</span><span />
              </div>

              {rewardRows.map((r) => (
                <div key={r.key} className="grid grid-cols-2 md:grid-cols-[1.3fr_0.9fr_1fr_1.4fr_32px] gap-2 items-center">
                  {r.preset ? (
                    <span className="text-[13px] font-semibold text-gray-700 px-1">{r.label}</span>
                  ) : (
                    <input
                      className={`${INPUT_CLS} h-10`}
                      placeholder="Prix personnalisé"
                      value={r.label}
                      onChange={(e) => updateRow(r.key, { label: e.target.value })}
                    />
                  )}

                  <select
                    className={`${INPUT_CLS} h-10 bg-white`}
                    value={r.type}
                    onChange={(e) => updateRow(r.key, { type: e.target.value as RewardType })}
                  >
                    {REWARD_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>

                  <input
                    className={`${INPUT_CLS} h-10 ${r.type !== 'money' ? 'bg-gray-50 text-gray-400' : ''}`}
                    type="text"
                    inputMode="numeric"
                    placeholder={r.type === 'money' ? 'Ex : 150 000' : '—'}
                    value={r.amount}
                    disabled={r.type !== 'money'}
                    onChange={(e) => updateRow(r.key, { amount: e.target.value })}
                  />

                  <input
                    className={`${INPUT_CLS} h-10`}
                    placeholder="Détail (optionnel)"
                    value={r.description}
                    onChange={(e) => updateRow(r.key, { description: e.target.value })}
                  />

                  {r.preset ? (
                    <span className="hidden md:block" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeRow(r.key)}
                      className="justify-self-end p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Supprimer cette récompense"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addCustomRow}
              className="mt-3 inline-flex items-center gap-1.5 px-3 h-10 rounded-lg text-sm font-semibold border border-dashed border-gray-300 text-gray-600 hover:border-primary hover:text-primary transition"
            >
              <Plus size={15} /> Ajouter une récompense personnalisée
            </button>

            {/* Récapitulatif */}
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-gray-50 px-4 py-3 text-[13px]">
              <span className="text-gray-600">
                <strong className="text-gray-900">{filledRewards.length}</strong> récompense{filledRewards.length > 1 ? 's' : ''} renseignée{filledRewards.length > 1 ? 's' : ''}
              </span>
              <span className="text-gray-600">
                Dotation totale : <strong className="text-gray-900">{fmtFcfa.format(totalDotation)} FCFA</strong>
              </span>
            </div>
          </div>

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
