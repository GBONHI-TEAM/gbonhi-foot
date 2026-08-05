'use client';

import { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { EmptyState } from '../../../components/ui/empty-state';
import { apiFetch } from '../../../lib/api';

interface ApiReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user: { id: string; full_name: string | null } | null;
  terrain: { id: string; name: string | null; city: string | null } | null;
}

type ReviewFilter = 'all' | 'published' | 'moderation';

function fmtDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} sur 5`}>
      {[1, 2, 3, 4, 5].map((item) => (
        <Star key={item} size={16} strokeWidth={2} fill={item <= Math.round(rating) ? '#F7921E' : 'none'} className="text-[#F7921E]" />
      ))}
    </span>
  );
}

/** Les avis avec une note basse sont mis en file de vérification, sans modifier
 * leur publication côté API : la modération finale reste une action serveur. */
function requiresModeration(review: ApiReview) {
  return review.rating < 2;
}

export default function AvisPage() {
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [terrainId, setTerrainId] = useState('');

  useEffect(() => {
    let cancelled = false;
    void apiFetch<ApiReview[]>('/reviews')
      .then((data) => { if (!cancelled) setReviews(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setReviews([]); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const terrains = useMemo(() => {
    const byId = new Map<string, string>();
    reviews.forEach((review) => {
      if (review.terrain?.id) byId.set(review.terrain.id, review.terrain.name?.trim() || 'Terrain sans nom');
    });
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [reviews]);
  const filtered = useMemo(() => reviews.filter((review) => {
    if (terrainId && review.terrain?.id !== terrainId) return false;
    return filter !== 'moderation' || requiresModeration(review);
  }), [filter, reviews, terrainId]);
  const moderationCount = reviews.filter(requiresModeration).length;

  return (
    <>
      <Header title="Avis utilisateurs" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {([
            ['all', 'Tous'],
            ['published', 'Publiés'],
            ['moderation', `À modérer${moderationCount ? ` (${moderationCount})` : ''}`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className="h-10 rounded-lg border px-4 text-sm font-semibold transition"
              style={{ backgroundColor: filter === value ? '#1E7A3A' : 'white', borderColor: filter === value ? '#1E7A3A' : '#E5E7EB', color: filter === value ? 'white' : '#6B7280' }}
            >{label}</button>
          ))}
        </div>
        <select value={terrainId} onChange={(event) => setTerrainId(event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 focus:border-[#1E7A3A] focus:outline-none">
          <option value="">Tous les terrains</option>
          {terrains.map((terrain) => <option key={terrain.id} value={terrain.id}>{terrain.name}</option>)}
        </select>
      </div>

      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        💡 « À modérer » rassemble les avis à note basse. L’approbation ou le rejet sera relié à la modération serveur dès son activation.
      </div>

      {!loaded ? <div className="rounded-xl border border-gray-100 bg-white py-20 text-center text-sm text-gray-400">Chargement…</div> : filtered.length === 0 ? (
        <EmptyState icon={Star} title="Aucun avis correspondant" message="Les avis laissés à la fin d'une réservation s'afficheront ici." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
              <tr>{['Note', 'Commentaire', 'Terrain', 'Auteur', 'Date', 'Statut'].map((heading) => <th key={heading} className="px-5 py-3.5">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((review) => {
                const moderate = requiresModeration(review);
                return <tr key={review.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4"><Stars rating={review.rating} /></td>
                  <td className="max-w-[300px] truncate px-5 py-4 text-gray-600">{review.comment?.trim() || 'Aucun commentaire'}</td>
                  <td className="px-5 py-4 font-medium text-gray-800">{review.terrain?.name?.trim() || 'Terrain'}</td>
                  <td className="px-5 py-4 text-gray-700">{review.user?.full_name?.trim() || 'Utilisateur'}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-gray-500">{fmtDate(review.created_at)}</td>
                  <td className="px-5 py-4"><span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: moderate ? '#FEF3C7' : '#DCFCE7', color: moderate ? '#B45309' : '#15803D' }}>{moderate ? 'À modérer' : 'Publié'}</span></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
