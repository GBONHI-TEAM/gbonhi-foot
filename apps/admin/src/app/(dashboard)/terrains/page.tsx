'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ExternalLink,
  ImagePlus,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { EmptyState } from '../../../components/ui/empty-state';
import { apiFetch } from '../../../lib/api';
import { createSupabaseBrowserClient } from '../../../lib/supabase/client';

interface TerrainPartner {
  id: string;
  full_name: string | null;
  username: string | null;
}

interface ApiTerrain {
  id: string;
  partner_id: string;
  partner?: TerrainPartner | null;
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

interface PartnerOption {
  id: string;
  name: string;
  terrains: { id: string; name: string }[];
}

const SURFACES = [
  { value: 'grass', label: 'Gazon' },
  { value: 'artificial', label: 'Synthétique' },
  { value: 'futsal', label: 'Futsal' },
] as const;
const SURFACE_LABEL = Object.fromEntries(SURFACES.map((surface) => [surface.value, surface.label]));
// day_of_week : 0 = Lundi … 6 = Dimanche (cohérent avec l'app mobile / le portail).
const OPENING_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const HOUR_OPTIONS = Array.from({ length: 25 }, (_, h) => h); // 0..24
const FORMATS = ['5vs5', '7vs7', '8vs8', '11vs11'];
const AMENITIES = ['Vestiaires', 'Douches', 'Parking', 'Éclairage', 'Buvette', 'Wifi'];
const INPUT_CLASS = 'mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1E7A3A] focus:ring-2 focus:ring-[#1E7A3A]/10';

function formatFcfa(value: number | null) {
  return value == null ? '—' : `${value.toLocaleString('fr-FR')} F`;
}

function partnerName(partner?: TerrainPartner | null) {
  return partner?.full_name?.trim() || partner?.username?.trim() || 'Partenaire non renseigné';
}

function TerrainThumbnail({ terrain }: { terrain: ApiTerrain }) {
  const image = terrain.photos?.[0];
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" className="h-8 w-11 rounded-md object-cover" />
    );
  }
  const color = terrain.surface === 'futsal' ? '#F97316' : terrain.surface === 'grass' ? '#62B996' : '#2E8B57';
  return <span className="h-8 w-11 rounded-md" style={{ backgroundColor: color }} aria-hidden />;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: active ? '#D1FAE5' : '#E5E7EB', color: active ? '#15803D' : '#6B7280' }}
    >
      {active ? 'Actif' : 'Inactif'}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-600">{label}{children}</label>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className="relative h-6 w-11 rounded-full transition"
      style={{ backgroundColor: checked ? '#24883F' : '#CBD5E1' }}
    >
      <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all" style={{ left: checked ? '22px' : '2px' }} />
    </button>
  );
}

function TerrainForm({
  terrain,
  partners,
  onBack,
  onSaved,
}: {
  terrain: ApiTerrain | null;
  partners: PartnerOption[];
  onBack: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(terrain);
  const [name, setName] = useState(terrain?.name ?? '');
  const [partnerId, setPartnerId] = useState(terrain?.partner_id ?? partners[0]?.id ?? '');
  const [surface, setSurface] = useState(terrain?.surface?.trim() || 'artificial');
  const [format, setFormat] = useState(terrain?.format?.trim() || '5vs5');
  const [capacity, setCapacity] = useState(terrain?.capacity != null ? String(terrain.capacity) : '10');
  const [price, setPrice] = useState(terrain?.price_per_hour != null ? String(terrain.price_per_hour) : '');
  const [address, setAddress] = useState(terrain?.address ?? '');
  const [city, setCity] = useState(terrain?.city ?? '');
  const [latitude, setLatitude] = useState(terrain?.latitude != null ? String(terrain.latitude) : '');
  const [longitude, setLongitude] = useState(terrain?.longitude != null ? String(terrain.longitude) : '');
  const [phone, setPhone] = useState(terrain?.phone_contact ?? '');
  const [description, setDescription] = useState(terrain?.description ?? '');
  const [photos, setPhotos] = useState<string[]>(terrain?.photos ?? []);
  const [amenities, setAmenities] = useState<string[]>(terrain?.amenities ?? []);
  const [active, setActive] = useState(terrain?.is_active ?? true);
  const [openDays, setOpenDays] = useState<boolean[]>(() => Array(7).fill(true));
  const [openHour, setOpenHour] = useState(6);
  const [closeHour, setCloseHour] = useState(22);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hourlyRate = Number.parseInt(price, 10);
  const mapUrl = latitude && longitude ? `https://www.google.com/maps?q=${latitude},${longitude}` : null;

  function toggleAmenity(amenity: string) {
    setAmenities((current) => current.includes(amenity) ? current.filter((item) => item !== amenity) : [...current, amenity]);
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('terrains').upload(path, file, {
        cacheControl: '3600',
        contentType: file.type || undefined,
      });
      if (uploadError) {
        setError("L'envoi d'une image a échoué. Vérifie votre connexion puis réessaie.");
        continue;
      }
      const { data } = supabase.storage.from('terrains').getPublicUrl(path);
      if (data.publicUrl) urls.push(data.publicUrl);
    }
    setPhotos((current) => [...current, ...urls]);
    setUploading(false);
  }

  function removePhoto(url: string) {
    setPhotos((current) => current.filter((item) => item !== url));
    const path = url.split('/terrains/')[1];
    if (path) void createSupabaseBrowserClient().storage.from('terrains').remove([path]);
  }

  async function save() {
    setError(null);
    const parsedCapacity = Number.parseInt(capacity, 10);
    const parsedPrice = Number.parseInt(price, 10);
    if (name.trim().length < 3) return setError('Le nom du terrain doit contenir au moins 3 caractères.');
    if (!editing && !partnerId) return setError('Sélectionnez le partenaire exploitant ce terrain.');
    if (!address.trim()) return setError("L'adresse du terrain est obligatoire.");
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 40) return setError('La capacité doit être comprise entre 1 et 40 joueurs.');
    if (!Number.isInteger(parsedPrice) || parsedPrice < 1) return setError('Le tarif horaire doit être supérieur à 0 FCFA.');

    const parsedLatitude = Number.parseFloat(latitude);
    const parsedLongitude = Number.parseFloat(longitude);
    if ((latitude && !Number.isFinite(parsedLatitude)) || (longitude && !Number.isFinite(parsedLongitude))) {
      return setError('Les coordonnées GPS doivent être des nombres valides.');
    }

    const payload: Record<string, unknown> = {
      name: name.trim(), surface, format, capacity: parsedCapacity, price_per_hour: parsedPrice,
      address: address.trim(), city: city.trim() || 'Abidjan', phone_contact: phone.trim() || undefined,
      description: description.trim() || undefined, photos, amenities, is_active: active,
    };
    if (latitude) payload.latitude = parsedLatitude;
    if (longitude) payload.longitude = parsedLongitude;
    if (!editing) {
      payload.partner_id = partnerId;
      if (closeHour <= openHour) return setError("L'heure de fermeture doit être postérieure à l'ouverture.");
      payload.hours = openDays
        .map((open, day) => (open ? { day_of_week: day, start_hour: openHour, end_hour: closeHour } : null))
        .filter(Boolean);
    }

    setSaving(true);
    try {
      await apiFetch(editing ? `/terrains/${terrain!.id}` : '/terrains/admin', {
        method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload),
      });
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L'enregistrement a échoué. Réessaie dans quelques instants.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header title={editing ? 'Modifier le terrain' : 'Ajouter un terrain'} />
      <div className="mb-6 flex items-center gap-3">
        <button type="button" onClick={onBack} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          <ChevronLeft size={17} /> Retour aux terrains
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Informations générales</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nom"><input value={name} onChange={(event) => setName(event.target.value)} className={INPUT_CLASS} placeholder="Five Arena Cocody" /></Field>
              <Field label="Partenaire">
                <select value={partnerId} disabled={editing} onChange={(event) => setPartnerId(event.target.value)} className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:bg-slate-50`}>
                  {!editing && <option value="">Sélectionner un partenaire</option>}
                  {editing && !partners.some((partner) => partner.id === partnerId) && <option value={partnerId}>{partnerName(terrain?.partner)}</option>}
                  {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
                </select>
                {editing && <span className="mt-1 block text-xs text-slate-400">Le rattachement partenaire est protégé après la création.</span>}
              </Field>
              <Field label="Type de surface">
                <select value={surface} onChange={(event) => setSurface(event.target.value)} className={INPUT_CLASS}>
                  {SURFACES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </Field>
              <Field label="Quartier / Ville"><input value={city} onChange={(event) => setCity(event.target.value)} className={INPUT_CLASS} placeholder="Cocody, Abidjan" /></Field>
              <Field label="Format">
                <select value={format} onChange={(event) => setFormat(event.target.value)} className={INPUT_CLASS}>
                  {FORMATS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Capacité"><input type="number" min="1" max="40" value={capacity} onChange={(event) => setCapacity(event.target.value)} className={INPUT_CLASS} /></Field>
              <Field label="Adresse"><input value={address} onChange={(event) => setAddress(event.target.value)} className={INPUT_CLASS} placeholder="Rue des Jardins" /></Field>
              <Field label="Téléphone"><input value={phone} onChange={(event) => setPhone(event.target.value)} className={INPUT_CLASS} placeholder="07 00 00 00 00" /></Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-bold text-[#24883F]"><MapPin size={18} className="text-[#F7921E]" /> Localisation GPS</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Latitude *"><input value={latitude} onChange={(event) => setLatitude(event.target.value)} className={INPUT_CLASS} inputMode="decimal" placeholder="5.354717" /></Field>
              <Field label="Longitude *"><input value={longitude} onChange={(event) => setLongitude(event.target.value)} className={INPUT_CLASS} inputMode="decimal" placeholder="-4.008256" /></Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {mapUrl ? <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#24883F] px-3 text-sm font-semibold text-[#24883F]"><MapPin size={15} /> Voir sur Google Maps <ExternalLink size={14} /></a> : <span className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-3 text-sm text-slate-400">Ajoutez les coordonnées pour prévisualiser</span>}
            </div>
            <div className="relative mt-3 h-28 overflow-hidden rounded-lg border border-[#D7E5D8]" style={{ background: 'linear-gradient(135deg, #EFF6F0 25%, #E1EEDF 25% 50%, #EFF6F0 50% 75%, #E1EEDF 75%)', backgroundSize: '28px 28px' }}>
              <MapPin className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#F7921E]" fill="#F7921E" />
              <span className="absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-xs text-slate-500">Aperçu : {latitude || '—'}, {longitude || '—'}</span>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Photos</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((url) => <div key={url} className="group relative aspect-[16/9] overflow-hidden rounded-lg border border-slate-200">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt="Terrain" className="h-full w-full object-cover" /><button type="button" onClick={() => removePhoto(url)} className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-white group-hover:flex" aria-label="Supprimer la photo"><Trash2 size={14} /></button></div>)}
              <label className="flex aspect-[16/9] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-center text-sm text-slate-400 hover:border-[#24883F] hover:text-[#24883F]">
                <ImagePlus size={22} /><span className="mt-1">{uploading ? 'Envoi…' : 'Glisser une image'}</span><input type="file" accept="image/*" multiple disabled={uploading} onChange={(event) => uploadPhotos(event.target.files)} className="hidden" />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Équipements</h2>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-3">
              {AMENITIES.map((amenity) => <button key={amenity} type="button" onClick={() => toggleAmenity(amenity)} className="inline-flex items-center gap-2 text-sm text-slate-600"><span className="flex h-4 w-4 items-center justify-center rounded border" style={{ borderColor: amenities.includes(amenity) ? '#24883F' : '#CBD5E1', backgroundColor: amenities.includes(amenity) ? '#24883F' : 'white' }}>{amenities.includes(amenity) && <Check size={12} className="text-white" />}</span>{amenity}</button>)}
            </div>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-800 outline-none focus:border-[#1E7A3A]" placeholder="Description visible par les joueurs (facultatif)" />
          </section>
        </div>

        <aside className="space-y-4">
          <section className="min-h-[250px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Tarifs & horaires</h2>
            <Field label="Tarif / heure (FCFA)"><input type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} className={INPUT_CLASS} placeholder="15 000" /></Field>
            <div className="mt-5 overflow-hidden rounded-lg border border-slate-100 text-sm">
              <div className="grid grid-cols-2 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500"><span>Créneaux</span><span>Tarif indicatif</span></div>
              {['Matin', 'Après-midi', 'Soir'].map((period) => <div key={period} className="grid grid-cols-2 border-t border-slate-100 px-3 py-3 text-slate-600"><span>{period}</span><span className="font-semibold text-slate-800">{Number.isFinite(hourlyRate) && hourlyRate > 0 ? formatFcfa(hourlyRate) : '—'}</span></div>)}
            </div>
            {editing ? (
              <p className="mt-3 text-xs leading-5 text-slate-400">Les horaires sont ensuite pilotés par le partenaire dans son portail.</p>
            ) : (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-bold text-slate-900">Horaires d&apos;ouverture</h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-500">Ouverture
                    <select value={openHour} onChange={(event) => setOpenHour(Number(event.target.value))} className={`${INPUT_CLASS} mt-1`}>
                      {HOUR_OPTIONS.slice(0, 24).map((h) => <option key={h} value={h}>{h}h</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-500">Fermeture
                    <select value={closeHour} onChange={(event) => setCloseHour(Number(event.target.value))} className={`${INPUT_CLASS} mt-1`}>
                      {HOUR_OPTIONS.slice(1).map((h) => <option key={h} value={h}>{h}h</option>)}
                    </select>
                  </label>
                </div>
                <p className="mt-4 text-xs font-semibold text-slate-500">Jours ouverts</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {OPENING_DAYS.map((label, day) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setOpenDays((prev) => prev.map((value, index) => (index === day ? !value : value)))}
                      className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                      style={{
                        borderColor: openDays[day] ? '#24883F' : '#CBD5E1',
                        backgroundColor: openDays[day] ? '#24883F' : 'white',
                        color: openDays[day] ? 'white' : '#64748B',
                      }}
                    >
                      {label.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-400">Des créneaux d&apos;1h seront générés sur cette plage pour chaque jour ouvert. Le partenaire pourra ensuite ouvrir/fermer les jours depuis son portail.</p>
              </div>
            )}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Partenariat</h2>
            <dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Commission GBONHI</dt><dd className="font-bold text-slate-700">10%</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Partenaire</dt><dd className="max-w-[55%] text-right font-semibold text-slate-700">{editing ? partnerName(terrain?.partner) : partners.find((partner) => partner.id === partnerId)?.name || '—'}</dd></div></dl>
          </section>
          <section className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-bold text-slate-900">Statut</h2><div className="flex items-center gap-2"><Toggle checked={active} onChange={() => setActive((value) => !value)} /><span className="text-sm font-semibold" style={{ color: active ? '#24883F' : '#64748B' }}>{active ? 'Actif' : 'Inactif'}</span></div></section>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3"><button type="button" onClick={onBack} className="h-12 flex-1 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-600">Annuler</button><button type="button" disabled={saving} onClick={save} className="h-12 flex-[1.3] rounded-lg bg-[#24883F] text-sm font-bold text-white transition hover:bg-[#1E7A3A] disabled:opacity-60">{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
        </aside>
      </div>
    </>
  );
}

export default function TerrainsPage() {
  const [terrains, setTerrains] = useState<ApiTerrain[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [formTerrain, setFormTerrain] = useState<ApiTerrain | null | undefined>(undefined);

  async function load() {
    setLoading(true);
    try {
      const terrainData = await apiFetch<ApiTerrain[]>('/terrains/admin');
      // La liste des terrains reste utilisable même si les options partenaires
      // ne sont temporairement pas disponibles (seule la création est alors bloquée).
      const partnerData = await apiFetch<PartnerOption[]>('/partner-accesses/partners').catch(() => []);
      setTerrains(Array.isArray(terrainData) ? terrainData : []);
      setPartners(Array.isArray(partnerData) ? partnerData : []);
    } catch {
      setTerrains([]);
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const displayedTerrains = useMemo(() => terrains.filter((terrain) => {
    if (filter === 'active' && !terrain.is_active) return false;
    if (filter === 'inactive' && terrain.is_active) return false;
    const term = search.trim().toLocaleLowerCase('fr');
    return !term || [terrain.name, terrain.city, terrain.address, partnerName(terrain.partner)].filter(Boolean).join(' ').toLocaleLowerCase('fr').includes(term);
  }), [filter, search, terrains]);

  if (formTerrain !== undefined) {
    return <TerrainForm terrain={formTerrain} partners={partners} onBack={() => setFormTerrain(undefined)} onSaved={() => { setFormTerrain(undefined); void load(); }} />;
  }

  return (
    <>
      <Header title="Gestion des terrains" />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {([['all', 'Tous'], ['active', 'Actifs'], ['inactive', 'Inactifs']] as const).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className="h-10 rounded-lg border px-4 text-sm font-semibold transition" style={{ backgroundColor: filter === value ? '#24883F' : 'white', borderColor: filter === value ? '#24883F' : '#E2E8F0', color: filter === value ? 'white' : '#64748B' }}>{label}</button>)}
        </div>
        <div className="flex gap-2"><label className="relative hidden md:block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-60 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#1E7A3A]" placeholder="Rechercher un terrain…" /></label><button onClick={() => setFormTerrain(null)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#F7921E] px-4 text-sm font-bold text-slate-900 transition hover:bg-[#E98515]"><Plus size={17} strokeWidth={2.5} /> Ajouter un terrain</button></div>
      </div>
      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">Chargement des terrains…</div> : displayedTerrains.length === 0 ? <EmptyState icon={MapPin} title="Aucun terrain trouvé" message={terrains.length ? 'Modifiez vos filtres pour afficher les terrains correspondants.' : 'Ajoutez le premier terrain partenaire.'} /> : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-[960px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3">Terrain</th><th className="px-4 py-3">Partenaire</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Capacité</th><th className="px-4 py-3">Tarif/h</th><th className="px-4 py-3">Comm.</th><th className="px-4 py-3">Coût match</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-slate-100">{displayedTerrains.map((terrain) => <tr key={terrain.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-3"><div className="flex items-center gap-3"><TerrainThumbnail terrain={terrain} /><span className="font-bold text-slate-900">{terrain.name}</span></div></td><td className="px-4 py-3 text-slate-700">{partnerName(terrain.partner)}</td><td className="px-4 py-3 text-slate-700">{terrain.surface ? SURFACE_LABEL[terrain.surface.trim()] ?? terrain.surface : '—'}</td><td className="px-4 py-3 text-slate-700"><span className="inline-flex items-center gap-1"><Users size={14} className="text-slate-400" />{terrain.capacity ?? '—'} j.</span></td><td className="px-4 py-3 font-medium text-slate-800">{formatFcfa(terrain.price_per_hour)}</td><td className="px-4 py-3 text-slate-700">10%</td><td className="px-4 py-3 text-slate-700">—</td><td className="px-4 py-3"><StatusBadge active={terrain.is_active} /></td><td className="px-4 py-3"><button onClick={() => setFormTerrain(terrain)} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm font-semibold text-[#24883F] hover:bg-emerald-50"><Pencil size={14} /> Modifier</button></td></tr>)}</tbody></table></div></div>}
    </>
  );
}
