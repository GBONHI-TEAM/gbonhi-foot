'use client';

import { useEffect, useMemo, useState } from 'react';
import { Camera, MapPin, Shield, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface PlayerCard {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  position: string | null;
  city: string | null;
  bio: string | null;
  player_profile: {
    birth_date: string | null;
    height_cm: string | null;
    weight_kg: string | null;
    preferred_foot: string | null;
    secondary_position: string | null;
  };
  statistics: {
    matches_played: number;
    goals: number;
    assists: number;
    yellow_cards: number;
    red_cards: number;
  };
}

interface PlayerProfileDrawerProps {
  playerId: string;
  teamName?: string;
  jerseyNumber?: number | null;
  membershipStatus?: 'Titulaire' | 'Remplaçant' | null;
  onClose: () => void;
}

function initial(name: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : parts[0]?.slice(0, 2).toUpperCase() ?? 'JF';
}

function age(birthDate: string | null) {
  if (!birthDate) return '—';
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return '—';
  const now = new Date();
  let value = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) value -= 1;
  return `${value} ans`;
}

export function PlayerProfileDrawer({ playerId, teamName, jerseyNumber, membershipStatus, onClose }: PlayerProfileDrawerProps) {
  const [player, setPlayer] = useState<PlayerCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setUnavailable(false);
    void apiFetch<PlayerCard>(`/users/${playerId}/player-card`)
      .then((result) => { if (!cancelled) setPlayer(result); })
      .catch(() => { if (!cancelled) setUnavailable(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [playerId]);

  const identity = useMemo(() => player?.full_name?.trim() || 'Joueur GBONHI FOOT', [player]);
  const physical = player?.player_profile ?? { birth_date: null, height_cm: null, weight_kg: null, preferred_foot: null, secondary_position: null };
  const stats = player?.statistics ?? { matches_played: 0, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };
  return <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[30rem] flex-col overflow-hidden bg-white shadow-2xl" role="dialog" aria-label="Fiche joueur">
    <header className="bg-[#0F3D1E] px-6 py-5 text-white">
      <div className="flex items-start gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/30 bg-[#1E7A3A] text-lg font-black">
          {player?.avatar_url ? <img src={player.avatar_url} alt={`Photo de ${identity}`} className="h-full w-full object-cover" /> : <>{initial(player?.full_name ?? null)}<Camera size={15} className="absolute bottom-1 right-1 rounded-full bg-[#0F3D1E] p-0.5" /></>}
        </div>
        <div className="min-w-0 flex-1"><p className="truncate text-xl font-black">{loading ? 'Chargement…' : identity}</p><p className="mt-1 text-sm text-white/70">{player?.position || 'Poste non renseigné'}{teamName ? ` · ${teamName}` : ''}{jerseyNumber ? ` · N°${jerseyNumber}` : ''}</p>{membershipStatus && <span className="mt-2 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">{membershipStatus}</span>}</div>
        <button onClick={onClose} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Fermer"><X size={20} /></button>
      </div>
    </header>
    <div className="flex-1 overflow-y-auto p-6">
      {loading ? <p className="py-16 text-center text-sm text-gray-400">Chargement de la fiche joueur…</p> : unavailable || !player ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">La fiche détaillée est momentanément indisponible. Les informations de l’équipe restent consultables.</p> : <>
        <Section title="Fiche joueur">
          <div className="grid grid-cols-2 gap-x-6"><Detail label="Âge" value={age(physical.birth_date)} /><Detail label="Taille" value={physical.height_cm ? `${physical.height_cm} cm` : '—'} /><Detail label="Poids" value={physical.weight_kg ? `${physical.weight_kg} kg` : '—'} /><Detail label="Pied fort" value={physical.preferred_foot || '—'} /><Detail label="Poste" value={player.position || '—'} /><Detail label="Poste secondaire" value={physical.secondary_position || '—'} /></div>
        </Section>
        <Section title="Identité & contact"><div className="space-y-3 text-sm"><div className="flex items-center gap-2 text-gray-700"><Shield size={16} className="text-[#1E7A3A]" />@{player.username || 'identifiant non renseigné'}</div>{player.city && <div className="flex items-center gap-2 text-gray-700"><MapPin size={16} className="text-[#1E7A3A]" />{player.city}</div>}{player.bio && <p className="rounded-lg bg-gray-50 p-3 leading-relaxed text-gray-600">{player.bio}</p>}</div></Section>
        <Section title="Statistiques saison"><div className="grid grid-cols-3 gap-3"><Metric value={stats.matches_played} label="Matchs joués" color="#1E7A3A" /><Metric value={stats.goals} label="Buts" color="#F7921E" /><Metric value={stats.assists} label="Passes déc." color="#15803D" /><Metric value={stats.yellow_cards} label="Cartons jaunes" color="#B45309" /><Metric value={stats.red_cards} label="Cartons rouges" color="#DC2626" /><Metric value={jerseyNumber ?? '—'} label="Numéro" color="#111827" /></div></Section>
        <p className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">Informations issues de la fiche joueur enregistrée dans l’application. Le contrôleur les consulte sans les modifier.</p>
      </>}
    </div>
  </aside>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mb-7"><h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-gray-400">{title}</h2>{children}</section>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="border-b border-gray-100 py-2.5"><p className="text-xs text-gray-400">{label}</p><p className="mt-0.5 text-sm font-bold text-gray-800">{value}</p></div>; }
function Metric({ value, label, color }: { value: number | string; label: string; color: string }) { return <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-2xl font-black" style={{ color }}>{value}</p><p className="mt-1 text-[11px] text-gray-500">{label}</p></div>; }
