'use client';
import { useEffect, useState } from 'react';
import { Star, MessageSquare } from 'lucide-react';
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

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '—';
  }
}

/** Rangée d'étoiles pleines/vides selon la note (1-5). */
function Stars({ rating, size = 15 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= Math.round(rating);
        return (
          <Star
            key={i}
            size={size}
            strokeWidth={1.8}
            style={{ color: '#FFB830' }}
            fill={filled ? '#FFB830' : 'none'}
          />
        );
      })}
    </div>
  );
}

function initials(name: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AvisPage() {
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<ApiReview[]>('/reviews');
        if (!cancelled) setReviews(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setReviews([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const count = reviews.length;
  const average = count > 0 ? Math.round((reviews.reduce((s, r) => s + (r.rating || 0), 0) / count) * 10) / 10 : 0;

  return (
    <>
      <Header title="Avis" />

      {!loaded ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 text-sm">Chargement…</div>
      ) : count === 0 ? (
        <EmptyState
          icon={Star}
          title="Aucun avis pour le moment"
          message="Les avis laissés par les joueurs sur les terrains apparaîtront ici."
        />
      ) : (
        <>
          {/* Synthèse : note moyenne + nombre d'avis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-5">
              <div className="flex flex-col items-center justify-center">
                <p className="text-4xl font-black text-gray-900 leading-none">{average.toLocaleString('fr-FR')}</p>
                <p className="text-xs text-gray-400 mt-1">sur 5</p>
              </div>
              <div>
                <Stars rating={average} size={20} />
                <p className="text-sm text-gray-500 mt-2">Note moyenne globale</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#F0FDF4', color: '#1E7A3A' }}>
                <MessageSquare size={22} strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-3xl font-black text-gray-900 leading-none">{count.toLocaleString('fr-FR')}</p>
                <p className="text-sm text-gray-500 mt-1">{count > 1 ? 'avis clients' : 'avis client'}</p>
              </div>
            </div>
          </div>

          {/* Liste des avis */}
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white" style={{ backgroundColor: '#1E7A3A' }}>
                    {initials(r.user?.full_name ?? null)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-bold text-gray-900">{r.user?.full_name?.trim() || 'Client'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[r.terrain?.name, r.terrain?.city].filter(Boolean).join(' · ') || 'Terrain'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Stars rating={r.rating} />
                        <p className="text-xs text-gray-400">{fmtDate(r.created_at)}</p>
                      </div>
                    </div>
                    {r.comment?.trim() && (
                      <p className="text-sm text-gray-600 mt-2.5 leading-relaxed">{r.comment}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
