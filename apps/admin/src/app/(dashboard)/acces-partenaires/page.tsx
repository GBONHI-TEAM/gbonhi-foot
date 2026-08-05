'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Building2, Mail, MoreHorizontal, Plus, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { ApiError, apiFetch } from '../../../lib/api';

type AccessRole = 'OWNER' | 'MANAGER';
type AccessStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

interface PartnerOption {
  id: string;
  name: string;
  terrains: { id: string; name: string }[];
}

interface PartnerAccess {
  id: string;
  email: string | null;
  role: AccessRole;
  status: AccessStatus;
  invited_at: string;
  last_login_at: string | null;
  terrainCount: number;
  partner: { id: string; full_name: string | null; username: string | null };
  user: { id: string; full_name: string | null; username: string | null; avatar_url: string | null };
}

const STATUS_META: Record<AccessStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'Actif', className: 'bg-emerald-50 text-emerald-700' },
  INVITED: { label: 'Invitation envoyée', className: 'bg-amber-50 text-amber-700' },
  SUSPENDED: { label: 'Suspendu', className: 'bg-orange-50 text-orange-700' },
  REVOKED: { label: 'Révoqué', className: 'bg-slate-100 text-slate-600' },
};

function displayName(person: { full_name: string | null; username: string | null }) {
  return person.full_name?.trim() || person.username?.trim() || 'Compte sans nom';
}

function formatDate(value: string | null) {
  if (!value) return 'Jamais';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function toMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return 'Une erreur est survenue. Réessaie dans quelques instants.';
}

export default function PartnerAccessesPage() {
  const [accesses, setAccesses] = useState<PartnerAccess[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ partnerId: '', fullName: '', email: '', role: 'MANAGER' as AccessRole, username: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [accessData, partnerData] = await Promise.all([
        apiFetch<PartnerAccess[]>('/partner-accesses'),
        apiFetch<PartnerOption[]>('/partner-accesses/partners'),
      ]);
      setAccesses(accessData);
      setPartners(partnerData);
      setForm((current) => ({ ...current, partnerId: current.partnerId || partnerData[0]?.id || '' }));
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => ({
    active: accesses.filter((item) => item.status === 'ACTIVE').length,
    pending: accesses.filter((item) => item.status === 'INVITED').length,
    suspended: accesses.filter((item) => item.status === 'SUSPENDED').length,
  }), [accesses]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const result = await apiFetch<{ invitationSent: boolean }>('/partner-accesses', {
        method: 'POST',
        body: JSON.stringify({
          partnerId: form.partnerId,
          fullName: form.fullName,
          email: form.email,
          role: form.role,
          ...(form.username.trim() ? { username: form.username.trim() } : {}),
        }),
      });
      setModalOpen(false);
      setForm((current) => ({ ...current, fullName: '', email: '', username: '', role: 'MANAGER' }));
      setNotice(result.invitationSent ? 'Invitation envoyée par e-mail. La personne choisira son mot de passe via Supabase.' : 'Accès partenaire activé pour ce compte existant.');
      await load();
    } catch (caught) {
      setError(toMessage(caught));
    }
  }

  async function changeStatus(access: PartnerAccess, status: 'ACTIVE' | 'SUSPENDED') {
    setActionId(access.id);
    setError('');
    try {
      await apiFetch(`/partner-accesses/${access.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setNotice(status === 'SUSPENDED' ? 'Accès suspendu. Les données et l’historique sont conservés.' : 'Accès réactivé.');
      await load();
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setActionId(null);
    }
  }

  async function revoke(access: PartnerAccess) {
    if (!window.confirm(`Révoquer définitivement l’accès partenaire de ${displayName(access.user)} ?`)) return;
    setActionId(access.id);
    setError('');
    try {
      await apiFetch(`/partner-accesses/${access.id}`, { method: 'DELETE' });
      setNotice('Accès révoqué. Le compte Supabase et l’historique restent intacts.');
      await load();
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setActionId(null);
    }
  }

  return (
    <>
      <Header title="Accès partenaires" />
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Building2 size={20} className="text-[#1E7A3A]" /> Comptes de la plateforme partenaire</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">Les accès sont liés à un partenaire, jamais à un mot de passe partagé. Une révocation conserve les données et les traces d’audit.</p>
            </div>
            <button onClick={() => { setError(''); setModalOpen(true); }} disabled={partners.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-[#1E7A3A] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Plus size={17} /> Créer un accès</button>
          </div>
          {partners.length === 0 && !loading && <p className="mt-4 text-sm font-medium text-amber-700">Aucun partenaire avec terrain n’est disponible. Créez d’abord un terrain et rattachez-le à son propriétaire.</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Accès actifs', summary.active, 'text-emerald-700'],
            ['Invitations en attente', summary.pending, 'text-amber-700'],
            ['Accès suspendus', summary.suspended, 'text-orange-700'],
          ].map(([label, value, color]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p></div>)}
        </div>

        {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><ShieldAlert size={18} className="mt-0.5 shrink-0" />{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h3 className="font-bold text-slate-900">Utilisation et accès</h3><button onClick={() => void load()} className="inline-flex items-center gap-1 text-sm font-semibold text-[#1E7A3A]"><RefreshCw size={15} /> Actualiser</button></div>
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Utilisateur', 'Partenaire / terrains', 'Rôle', 'Statut', 'Dernière activité', 'Actions'].map((head) => <th key={head} className="px-5 py-3 font-semibold">{head}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {accesses.map((access) => {
                  const status = STATUS_META[access.status];
                  const busy = actionId === access.id;
                  return <tr key={access.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4"><p className="font-semibold text-slate-900">{displayName(access.user)}</p><p className="mt-0.5 text-xs text-slate-500">{access.email ?? 'Adresse e-mail non disponible'}</p></td>
                    <td className="px-5 py-4"><p className="font-medium text-slate-800">{displayName(access.partner)}</p><p className="mt-0.5 text-xs text-slate-500">{access.terrainCount} terrain{access.terrainCount > 1 ? 's' : ''}</p></td>
                    <td className="px-5 py-4"><span className="font-semibold text-slate-700">{access.role === 'OWNER' ? 'Propriétaire' : 'Gérant'}</span></td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span></td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(access.last_login_at)}</td>
                    <td className="px-5 py-4"><div className="flex items-center gap-2">{access.role === 'MANAGER' && access.status !== 'REVOKED' && <>
                      {access.status === 'SUSPENDED' ? <button disabled={busy} onClick={() => void changeStatus(access, 'ACTIVE')} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-50">Réactiver</button> : <button disabled={busy} onClick={() => void changeStatus(access, 'SUSPENDED')} className="rounded-lg border border-orange-200 px-2.5 py-1.5 text-xs font-semibold text-orange-700 disabled:opacity-50">Suspendre</button>}
                      <button disabled={busy} onClick={() => void revoke(access)} title="Révoquer l’accès" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><MoreHorizontal size={17} /></button>
                    </>}</div></td>
                  </tr>;
                })}
                {!loading && accesses.length === 0 && <tr><td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-500">Aucun accès partenaire n’a encore été créé.</td></tr>}
                {loading && <tr><td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-400">Chargement des accès…</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-lg font-bold text-slate-900">Créer un accès partenaire</h3><p className="mt-1 text-sm text-slate-500">Un e-mail d’invitation permet de définir le mot de passe de manière sécurisée.</p></div><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={19} /></button></div>
        <div className="mt-5 space-y-4"><label className="block text-sm font-medium text-slate-700">Partenaire<select required value={form.partnerId} onChange={(event) => setForm({ ...form, partnerId: event.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name} — {partner.terrains.map((terrain) => terrain.name).join(', ')}</option>)}</select></label>
          <label className="block text-sm font-medium text-slate-700">Nom complet<input required minLength={2} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="Kone Issa" /></label>
          <label className="block text-sm font-medium text-slate-700">E-mail de connexion<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="issa@partenaire.ci" /></label>
          <div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium text-slate-700">Rôle<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AccessRole })} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="MANAGER">Gérant</option><option value="OWNER">Propriétaire</option></select></label><label className="block text-sm font-medium text-slate-700">Identifiant <span className="font-normal text-slate-400">(optionnel)</span><input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="kone.issa" /></label></div></div>
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600">Annuler</button><button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-[#1E7A3A] px-4 py-2 text-sm font-semibold text-white"><Mail size={16} /> Envoyer l’invitation</button></div></form></div>}
    </>
  );
}
