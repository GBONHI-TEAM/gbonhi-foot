'use client';
import { useEffect, useState } from 'react';
import { Header } from '../../../components/layout/header';
import { Star } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import {
  ApiReview,
  dateFR,
  initials,
} from '../../../lib/domain';
import { useTerrain } from '../../../lib/terrain-context';

/** Rangée d'étoiles pleines/vides pour une note donnée. */
function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= Math.round(value);
        return (
          <Star
            key={i}
            size={size}
            style={{ color: filled ? '#F7921E' : '#E5E7EB' }}
            fill={filled ? '#F7921E' : 'none'}
          />
        );
      })}
    </span>
  );
}

export default function AvisPage() {
  const { selectedTerrain: terrain } = useTerrain();
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!terrain) {
      setReviews([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const list = await apiFetch<ApiReview[]>(`/terrains/${terrain.id}/reviews`);
        if (cancelled) return;
        if (Array.isArray(list)) setReviews(list);
      } catch {
        /* état vide si l'API échoue */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [terrain]);

  const count = terrain?.rating_count ?? reviews.length;
  const avg = terrain?.rating_avg ?? 0;

  // Distribution par étoile (5★ → 1★), comptée depuis la liste des avis.
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: reviews.filter((r) => Math.round(r.rating) === star).length,
  }));

  return (
    <>
      <Header title="Avis clients" subtitle="Retours de vos clients" />

      {loading ? (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="py-16 text-center text-[13px] text-gray-400">Chargement des avis…</p>
        </div>
      ) : count === 0 ? (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#F0FDF4' }}>
              <Star size={26} className="text-gray-300" />
            </div>
            <p className="text-[15px] font-semibold text-gray-700">Aucun avis pour le moment</p>
            <p className="text-[13px] text-gray-400 mt-1 max-w-sm">
              Les avis laissés par vos clients après leurs réservations apparaîtront ici.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Résumé : note moyenne + distribution */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex flex-col items-center text-center pb-5 border-b border-gray-100">
                <p className="text-[44px] leading-none font-black text-gray-900">
                  {avg.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  <span className="text-[18px] font-semibold text-gray-400"> / 5</span>
                </p>
                <div className="mt-2">
                  <Stars value={avg} size={18} />
                </div>
                <p className="text-[12px] text-gray-400 mt-2">
                  {count} avis{count > 1 ? '' : ''}
                </p>
              </div>

              <div className="pt-4 space-y-2">
                {distribution.map((d) => {
                  const pct = count > 0 ? (d.n / reviews.length) * 100 : 0;
                  return (
                    <div key={d.star} className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[12px] text-gray-500 w-9">
                        {d.star}
                        <Star size={11} style={{ color: '#F7921E' }} fill="#F7921E" />
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#1E7A3A' }} />
                      </div>
                      <span className="text-[12px] text-gray-400 w-6 text-right">{d.n}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Liste des avis */}
          <div className="lg:col-span-2 space-y-4">
            {reviews.map((r) => {
              const name = r.user?.full_name?.trim() || 'Client';
              return (
                <div key={r.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-start gap-3">
                    {r.user?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.user.avatar_url}
                        alt={name}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold text-white"
                        style={{ backgroundColor: '#1A3D2B' }}
                      >
                        {initials(name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-[14px] font-semibold text-gray-900">{name}</p>
                        <span className="text-[12px] text-gray-400">{dateFR(r.created_at)}</span>
                      </div>
                      <div className="mt-1">
                        <Stars value={r.rating} />
                      </div>
                      {r.comment && (
                        <p className="text-[13px] text-gray-600 mt-2 leading-relaxed">{r.comment}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
