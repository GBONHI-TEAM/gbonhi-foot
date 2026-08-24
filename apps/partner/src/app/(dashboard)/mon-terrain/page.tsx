'use client';
import { useEffect, useState } from 'react';
import { Header } from '../../../components/layout/header';
import { Info, Check, X, Star } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import {
  ApiTerrain,
  ApiSlot,
  JOURS_FR,
  SURFACE_FR,
  fcfa,
} from '../../../lib/domain';

interface JourDispo {
  nom: string;
  horaire: string;
  ouvert: boolean;
}

interface Equipement {
  nom: string;
  dispo: boolean;
}

// Équipements de référence : on affiche "dispo" si présent dans amenities.
const EQUIPEMENTS_REF = ['Vestiaires', 'Parking', 'Éclairage', 'Buvette'];

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg p-3 mt-4" style={{ backgroundColor: '#FFF7ED' }}>
      <Info size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#F7921E' }} />
      <p className="text-[12px] text-gray-600">{children}</p>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 ${className}`}>{children}</div>;
}

/** Regroupe les créneaux actifs par jour de semaine → "6h – 22h" ou "Fermé". */
function slotsToJours(slots: ApiSlot[]): JourDispo[] {
  return JOURS_FR.map((nom, day) => {
    const jourSlots = slots.filter((s) => s.day_of_week === day && s.is_active);
    if (jourSlots.length === 0) return { nom, horaire: 'Fermé', ouvert: false };
    const min = Math.min(...jourSlots.map((s) => s.start_hour));
    const max = Math.max(...jourSlots.map((s) => s.end_hour));
    return { nom, horaire: `${min}h – ${max}h`, ouvert: true };
  });
}

export default function MonTerrainPage() {
  const [terrain, setTerrain] = useState<ApiTerrain | null>(null);
  const [jours, setJours] = useState<JourDispo[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const terrains = await apiFetch<ApiTerrain[]>('/terrains/mine');
        if (cancelled) return;
        if (Array.isArray(terrains) && terrains.length > 0) {
          const t = terrains[0];
          setTerrain(t);
          setJours(slotsToJours(t.slots ?? []));
        }
      } catch {
        /* affiche l'état vide si l'API échoue */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(i: number) {
    setJours((prev) => prev.map((j, idx) => (idx === i ? { ...j, ouvert: !j.ouvert } : j)));
  }

  const nom = terrain?.name ?? '—';
  const type = terrain ? SURFACE_FR[terrain.surface] ?? terrain.surface : '—';
  const capacite = terrain ? `${terrain.capacity} joueurs` : '—';
  const adresse = terrain
    ? terrain.address.toLowerCase().includes(terrain.city.toLowerCase())
      ? terrain.address
      : `${terrain.address}, ${terrain.city}`
    : '—';
  const prix = terrain ? `${fcfa(terrain.price_per_hour)}/h` : '—';
  const equipements: Equipement[] = EQUIPEMENTS_REF.map((nom) => ({
    nom,
    dispo: (terrain?.amenities ?? []).some((a) => a.toLowerCase() === nom.toLowerCase()),
  }));

  return (
    <>
      <Header title="Mon terrain" subtitle="Informations & disponibilité" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonne gauche */}
        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-gray-900 text-[14px] mb-4">Informations générales</h2>
            <dl className="divide-y divide-gray-100">
              {[
                ['Nom', nom],
                ['Type', type],
                ['Format', terrain?.format ?? '—'],
                ['Capacité', capacite],
                ['Adresse', adresse],
                ['Téléphone', terrain?.phone_contact ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2.5">
                  <dt className="text-[13px] text-gray-500">{k}</dt>
                  <dd className="text-[13px] font-semibold text-gray-900">{v}</dd>
                </div>
              ))}
            </dl>
            {terrain?.description && (
              <p className="text-[13px] text-gray-600 mt-3 pt-3 border-t border-gray-100">{terrain.description}</p>
            )}
            <InfoBanner>
              Les tarifs et horaires sont configurés par l&apos;équipe GBONHI FOOT. Pour toute modification, contactez le support.
            </InfoBanner>
          </Card>

          <Card>
            <h2 className="font-semibold text-gray-900 text-[14px] mb-4">Photos</h2>
            <div className="grid grid-cols-3 gap-3">
              {(terrain?.photos && terrain.photos.length > 0 ? terrain.photos.slice(0, 6) : [null, null, null]).map((url, i) =>
                url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={`Photo ${i + 1} du terrain`}
                    className="aspect-[4/3] w-full rounded-lg object-cover"
                  />
                ) : (
                  <div key={i} className="aspect-[4/3] rounded-lg" style={{ background: 'linear-gradient(135deg,#1E7A3A,#0F3D1E)' }} />
                ),
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-semibold text-gray-900 text-[14px]">Tarif</h2>
              <span className="text-[11px] text-gray-400">lecture seule</span>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[13px] text-gray-600">Prix horaire</span>
                <span className="text-[13px] font-bold text-gray-900">{prix}</span>
              </div>
            </div>
            <InfoBanner>
              Les tarifs sont définis par l&apos;équipe GBONHI FOOT. Pour toute modification, contactez le support.
            </InfoBanner>
          </Card>
        </div>

        {/* Colonne droite */}
        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-gray-900 text-[14px]">Disponibilité de votre terrain</h2>
            <p className="text-[12px] text-gray-400 mb-4">Ouvrez ou fermez chaque jour. Un jour fermé bloque tous ses créneaux.</p>
            <div className="divide-y divide-gray-100">
              {jours.length === 0 && (
                <p className="py-6 text-center text-[13px] text-gray-400">Chargement des créneaux…</p>
              )}
              {jours.map((j, i) => (
                <div key={j.nom} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-[13px] font-medium text-gray-900">{j.nom}</p>
                    <p className="text-[11px] text-gray-400">{j.ouvert ? j.horaire : 'Fermé'}</p>
                  </div>
                  <button
                    onClick={() => toggle(i)}
                    className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
                    style={{ backgroundColor: j.ouvert ? '#1E7A3A' : '#D1D5DB' }}
                    aria-label={`Basculer ${j.nom}`}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                      style={{ left: j.ouvert ? '18px' : '2px' }}
                    />
                  </button>
                </div>
              ))}
            </div>
            {jours.some((j) => !j.ouvert) && (
              <p className="flex items-center gap-1.5 text-[11px] mt-2" style={{ color: '#F7921E' }}>
                <Info size={12} /> Créneaux bloqués — aucune réservation possible les jours fermés.
              </p>
            )}
            <div className="flex items-start gap-2 rounded-lg p-3 mt-4" style={{ backgroundColor: '#EFF6FF' }}>
              <Info size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#1D4ED8' }} />
              <p className="text-[12px]" style={{ color: '#1D4ED8' }}>
                Basculer un jour sur « Fermé » bloquera automatiquement tous les créneaux de ce jour.
              </p>
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-gray-900 text-[14px] mb-4">Équipements</h2>
            <div className="flex flex-wrap gap-2">
              {equipements.map((e) => (
                <span
                  key={e.nom}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border"
                  style={{
                    backgroundColor: e.dispo ? '#F0FDF4' : '#F9FAFB',
                    borderColor: e.dispo ? '#A7F3D0' : '#E5E7EB',
                    color: e.dispo ? '#065F46' : '#9CA3AF',
                  }}
                >
                  {e.dispo ? <Check size={13} /> : <X size={13} />}
                  {e.nom}
                </span>
              ))}
            </div>
          </Card>

          <Card>
            <div className="text-center py-1">
              <div className="flex items-center justify-center gap-1.5">
                <Star size={22} style={{ color: '#F7921E' }} fill="#F7921E" />
                <p className="text-[24px] font-black text-gray-900">
                  {(terrain?.rating_avg ?? 0).toLocaleString('fr-FR', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  <span className="text-[15px] font-semibold text-gray-400">/5</span>
                </p>
              </div>
              <p className="text-[11px] text-gray-400">
                {(terrain?.rating_count ?? 0) > 0
                  ? `${terrain?.rating_count} avis`
                  : 'Aucun avis pour le moment'}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
