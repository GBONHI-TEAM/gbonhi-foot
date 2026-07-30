'use client';
import { useEffect, useState } from 'react';
import { MapPin, Users as UsersIcon, Plus, Pencil } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { EmptyState } from '../../../components/ui/empty-state';
import { apiFetch } from '../../../lib/api';
import { createSupabaseBrowserClient } from '../../../lib/supabase/client';

interface ApiTerrain {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  surface: string | null;
  format: string | null;
  capacity: number | null;
  price_per_hour: number | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  phone_contact: string | null;
  photos: string[] | null;
  amenities: string[] | null;
  is_active: boolean;
}

const SURFACES: { value: string; label: string }[] = [
  { value: 'grass', label: 'Gazon naturel' },
  { value: 'artificial', label: 'Synthétique' },
  { value: 'futsal', label: 'Futsal' },
];
const SURFACE_LABEL: Record<string, string> = Object.fromEntries(SURFACES.map((s) => [s.value, s.label]));

const FORMATS = ['5vs5', '7vs7', '8vs8', '11vs11'];

const AMENITIES = ['Vestiaires', 'Douches', 'Parking', 'Éclairage LED', 'Buvette', 'Gardien'];

function fmtFcfa(v: number | null) {
  if (v == null) return '—';
  return `${v.toLocaleString('fr-FR')} FCFA`;
}

/** Champ label + input — même style que l'écran Ligues. */
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

/** Boutons segmentés (vert plein actif) — surface, format. */
function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="px-4 h-11 rounded-lg text-sm font-semibold border transition"
            style={{
              backgroundColor: active ? '#F0FDF4' : 'white',
              borderColor: active ? '#1E7A3A' : '#E5E7EB',
              color: active ? '#1E7A3A' : '#9CA3AF',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Modal création / édition d'un terrain — Écran 20. */
function TerrainFormModal({
  terrain,
  onClose,
  onSaved,
}: {
  terrain: ApiTerrain | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!terrain;
  const [name, setName] = useState(terrain?.name ?? '');
  const [surface, setSurface] = useState(terrain?.surface?.trim() || 'grass');
  const [format, setFormat] = useState(terrain?.format?.trim() || '5vs5');
  const [capacity, setCapacity] = useState(terrain?.capacity != null ? String(terrain.capacity) : '');
  const [address, setAddress] = useState(terrain?.address ?? '');
  const [city, setCity] = useState(terrain?.city ?? '');
  const [latitude, setLatitude] = useState(terrain?.latitude != null ? String(terrain.latitude) : '');
  const [longitude, setLongitude] = useState(terrain?.longitude != null ? String(terrain.longitude) : '');
  const [description, setDescription] = useState(terrain?.description ?? '');
  const [amenities, setAmenities] = useState<string[]>(terrain?.amenities ?? []);
  const [pricePerHour, setPricePerHour] = useState(terrain?.price_per_hour != null ? String(terrain.price_per_hour) : '');
  const [phoneContact, setPhoneContact] = useState(terrain?.phone_contact ?? '');
  const [photos, setPhotos] = useState<string[]>(terrain?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [isActive, setIsActive] = useState(terrain?.is_active ?? true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAmenity(a: string) {
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  // Upload multi-images vers Supabase Storage (bucket public « terrains »).
  async function uploadPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const added: string[] = [];
    for (const file of Array.from(files)) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('terrains').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upErr) {
        setError(`Échec de l'envoi d'une image : ${upErr.message}`);
        continue;
      }
      const { data } = supabase.storage.from('terrains').getPublicUrl(path);
      if (data?.publicUrl) added.push(data.publicUrl);
    }
    if (added.length) setPhotos((p) => [...p, ...added]);
    setUploading(false);
  }

  function removePhoto(url: string) {
    setPhotos((p) => p.filter((x) => x !== url));
    try {
      const supabase = createSupabaseBrowserClient();
      const path = url.split('/terrains/')[1];
      if (path) void supabase.storage.from('terrains').remove([path]);
    } catch {
      /* suppression best-effort */
    }
  }

  async function handleSave() {
    setError(null);
    if (name.trim().length < 3) {
      setError('Le nom doit contenir au moins 3 caractères.');
      return;
    }
    if (!address.trim()) {
      setError("L'adresse est obligatoire.");
      return;
    }
    const capNum = parseInt(capacity, 10);
    const priceNum = parseInt(pricePerHour, 10);
    if (!Number.isFinite(capNum) || capNum < 1) {
      setError('La capacité doit être un entier supérieur ou égal à 1.');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 1) {
      setError('Le prix par heure doit être un entier supérieur ou égal à 1.');
      return;
    }

    const photoList = photos;

    const payload: Record<string, unknown> = {
      name: name.trim(),
      surface,
      format,
      capacity: capNum,
      address: address.trim(),
      price_per_hour: priceNum,
      amenities,
      is_active: isActive,
    };
    if (city.trim()) payload.city = city.trim();
    if (description.trim()) payload.description = description.trim();
    if (phoneContact.trim()) payload.phone_contact = phoneContact.trim();
    payload.photos = photoList; // toujours envoyé (permet aussi de vider la galerie)
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (latitude.trim() && Number.isFinite(latNum)) payload.latitude = latNum;
    if (longitude.trim() && Number.isFinite(lngNum)) payload.longitude = lngNum;

    setSaving(true);
    try {
      await apiFetch(isEdit ? `/terrains/${terrain!.id}` : '/terrains', {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      onSaved();
    } catch (e) {
      setError(
        isEdit
          ? "Échec de la modification du terrain. " + (e instanceof Error ? e.message : '')
          : "Échec de la création du terrain. " + (e instanceof Error ? e.message : ''),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-black text-gray-900 mb-6">
          {isEdit ? 'Modifier le terrain' : 'Ajouter un terrain'}
        </h2>

        <div className="space-y-5">
          <Field label="Nom du terrain">
            <input className={INPUT_CLS} placeholder="Ex : Five Arena Cocody" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Surface">
              <Segmented options={SURFACES} value={surface} onChange={setSurface} />
            </Field>
            <Field label="Format">
              <Segmented options={FORMATS.map((f) => ({ value: f, label: f }))} value={format} onChange={setFormat} />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Capacité (joueurs)">
              <input className={INPUT_CLS} type="number" min={1} placeholder="Ex : 10" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </Field>
            <Field label="Prix / heure (FCFA)">
              <input className={INPUT_CLS} type="number" min={1} placeholder="Ex : 25000" value={pricePerHour} onChange={(e) => setPricePerHour(e.target.value)} />
            </Field>
          </div>

          <Field label="Adresse">
            <input className={INPUT_CLS} placeholder="Ex : Rue des Jardins, Cocody" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Field label="Ville">
              <input className={INPUT_CLS} placeholder="Ex : Abidjan" value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="Latitude (optionnel)">
              <input className={INPUT_CLS} placeholder="Ex : 5.3599" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
            </Field>
            <Field label="Longitude (optionnel)">
              <input className={INPUT_CLS} placeholder="Ex : -3.9986" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
            </Field>
          </div>

          <Field label="Téléphone de contact">
            <input className={INPUT_CLS} placeholder="Ex : +225 07 00 00 00 00" value={phoneContact} onChange={(e) => setPhoneContact(e.target.value)} />
          </Field>

          <Field label="Description">
            <textarea
              className={`${INPUT_CLS.replace('h-11', 'min-h-[88px] py-3')}`}
              placeholder="Quelques mots sur le terrain…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <div>
            <label className="block text-[13px] font-semibold text-gray-800 mb-2">Équipements</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {AMENITIES.map((a) => {
                const checked = amenities.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAmenity(a)}
                    className="flex items-center gap-2.5 px-3 h-11 rounded-lg border text-sm font-medium transition text-left"
                    style={{
                      backgroundColor: checked ? '#F0FDF4' : 'white',
                      borderColor: checked ? '#1E7A3A' : '#E5E7EB',
                      color: checked ? '#15803D' : '#6B7280',
                    }}
                  >
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: checked ? '#1E7A3A' : 'transparent', border: checked ? 'none' : '1.5px solid #D1D5DB' }}
                    >
                      {checked && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>
                      )}
                    </span>
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-gray-800 mb-2">Photos du terrain</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {photos.map((url) => (
                <div key={url} className="relative group rounded-lg overflow-hidden border border-gray-200" style={{ aspectRatio: '16 / 10' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Photo terrain" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(url)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-sm leading-none"
                    aria-label="Supprimer la photo"
                  >
                    ×
                  </button>
                </div>
              ))}
              <label
                className="rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 text-xs cursor-pointer hover:border-primary hover:text-primary transition"
                style={{ aspectRatio: '16 / 10' }}
              >
                {uploading ? (
                  <span>Envoi…</span>
                ) : (
                  <>
                    <Plus size={18} />
                    <span className="mt-1">Ajouter</span>
                  </>
                )}
                <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={(e) => uploadPhotos(e.target.files)} />
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Plusieurs images possibles · enregistrées, modifiables et supprimables · visibles automatiquement dans l&apos;application mobile.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 h-14">
            <div>
              <p className="text-sm font-semibold text-gray-800">Terrain actif</p>
              <p className="text-xs text-gray-400">Visible et réservable par les joueurs.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className="relative w-12 h-7 rounded-full transition"
              style={{ backgroundColor: isActive ? '#1E7A3A' : '#D1D5DB' }}
              aria-pressed={isActive}
            >
              <span
                className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all"
                style={{ left: isActive ? '26px' : '4px' }}
              />
            </button>
          </div>
        </div>

        {error && <p className="mt-6 text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>}

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="px-6 h-11 rounded-lg text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 h-11 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#1E7A3A' }}
          >
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer les modifications' : 'Créer le terrain'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TerrainsPage() {
  const [terrains, setTerrains] = useState<ApiTerrain[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApiTerrain | null>(null);

  async function fetchTerrains() {
    try {
      const data = await apiFetch<ApiTerrain[]>('/terrains');
      setTerrains(Array.isArray(data) ? data : []);
    } catch {
      setTerrains([]);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    fetchTerrains();
  }, []);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(t: ApiTerrain) {
    setEditing(t);
    setModalOpen(true);
  }
  function handleSaved() {
    setModalOpen(false);
    setEditing(null);
    setLoaded(false);
    fetchTerrains();
  }

  return (
    <>
      <Header title="Gestion des Terrains" />

      <div className="flex items-center justify-end mb-6">
        {/* CTA orange — SANS glow */}
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: '#F7921E' }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Ajouter un terrain
        </button>
      </div>

      {loaded && terrains.length === 0 ? (
        <EmptyState icon={MapPin} title="Aucun terrain pour le moment" message="Cliquez sur « Ajouter un terrain » pour créer le premier." />
      ) : !loaded ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 text-sm">Chargement…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {terrains.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between" style={{ backgroundColor: '#0F3D1E' }}>
                <div className="min-w-0">
                  <p className="font-black text-white truncate">{t.name}</p>
                  {(t.city || t.address) && (
                    <p className="text-white/60 text-xs truncate flex items-center gap-1 mt-0.5">
                      <MapPin size={12} /> {[t.address, t.city].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-bold flex-shrink-0"
                  style={{ backgroundColor: t.is_active ? '#065F46' : '#7F1D1D', color: 'white' }}
                >
                  {t.is_active ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Surface</p>
                    <p className="font-semibold text-gray-900">{t.surface ? SURFACE_LABEL[t.surface.trim()] ?? t.surface.trim() : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Format</p>
                    <p className="font-semibold text-gray-900">{t.format?.trim() || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Capacité</p>
                    <p className="font-semibold text-gray-900 flex items-center gap-1">
                      <UsersIcon size={13} className="text-gray-400" /> {t.capacity ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Prix / heure</p>
                    <p className="font-semibold" style={{ color: '#1E7A3A' }}>{fmtFcfa(t.price_per_hour)}</p>
                  </div>
                </div>
                {Array.isArray(t.amenities) && t.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {t.amenities.map((a) => (
                      <span key={a} className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: '#F0FDF4', color: '#15803D' }}>
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => openEdit(t)}
                  className="w-full mt-1 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                >
                  <Pencil size={14} /> Modifier
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <TerrainFormModal terrain={editing} onClose={() => setModalOpen(false)} onSaved={handleSaved} />
      )}
    </>
  );
}
