'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Header } from '../../../components/layout/header';
import { AlertCircle, Loader2, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { usePartnerAccess } from '../../../components/auth/partner-access-provider';
import { apiFetch } from '../../../lib/api';
import { initials } from '../../../lib/domain';

type AccessStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
type AccessRole = 'OWNER' | 'MANAGER';

interface TeamAccess {
  id: string;
  email: string;
  role: AccessRole;
  status: AccessStatus;
  invited_at: string;
  last_login_at: string | null;
  partner: { id: string; full_name: string | null; username: string | null };
  user: { id: string; full_name: string | null; username: string | null; avatar_url: string | null };
}

const statusMeta: Record<AccessStatus, { label: string; bg: string; color: string }> = {
  INVITED: { label: 'Invitation envoyée', bg: '#FEF3C7', color: '#92400E' },
  ACTIVE: { label: 'Actif', bg: '#DCFCE7', color: '#166534' },
  SUSPENDED: { label: 'Suspendu', bg: '#FEE2E2', color: '#B91C1C' },
  REVOKED: { label: 'Révoqué', bg: '#F3F4F6', color: '#4B5563' },
};

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Une erreur est survenue. Réessaie dans quelques instants.';
  const separator = ' — ';
  const index = error.message.indexOf(separator);
  if (index < 0) return 'Une erreur est survenue. Réessaie dans quelques instants.';
  try {
    const body = JSON.parse(error.message.slice(index + separator.length)) as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message[0] : body.message ?? 'Une erreur est survenue.';
  } catch {
    return 'Une erreur est survenue. Réessaie dans quelques instants.';
  }
}

function memberName(member: TeamAccess): string {
  return member.user.full_name?.trim() || member.user.username?.trim() || member.email;
}

export default function RolesPage() {
  const { isOwner, loading } = usePartnerAccess();
  const [members, setMembers] = useState<TeamAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!isOwner) return;
    setIsLoading(true);
    try {
      const result = await apiFetch<TeamAccess[]>('/partner-accesses/me/team');
      setMembers(Array.isArray(result) ? result : []);
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [isOwner]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  async function inviteManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const result = await apiFetch<{ invitationSent: boolean }>('/partner-accesses/me/managers', {
        method: 'POST',
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), username: username.trim() || undefined }),
      });
      setFullName(''); setEmail(''); setUsername(''); setIsModalOpen(false);
      setFeedback(result.invitationSent ? 'Invitation envoyée par e-mail.' : 'Le gérant a été ajouté à votre portail.');
      await loadMembers();
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(member: TeamAccess, status: 'ACTIVE' | 'SUSPENDED') {
    setFeedback(null);
    try {
      await apiFetch(`/partner-accesses/me/team/${member.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setFeedback(status === 'SUSPENDED' ? 'L’accès du gérant est suspendu.' : 'L’accès du gérant est réactivé.');
      await loadMembers();
    } catch (error) { setFeedback(errorMessage(error)); }
  }

  async function revoke(member: TeamAccess) {
    if (!window.confirm(`Retirer définitivement l’accès de ${memberName(member)} ?`)) return;
    setFeedback(null);
    try {
      await apiFetch(`/partner-accesses/me/team/${member.id}`, { method: 'DELETE' });
      setFeedback('Accès retiré.');
      await loadMembers();
    } catch (error) { setFeedback(errorMessage(error)); }
  }

  if (loading) return <><Header title="Rôles & Accès" /><p className="text-sm text-gray-400">Vérification des accès…</p></>;
  if (!isOwner) return <><Header title="Accès restreint" /><div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">La gestion des rôles et accès est réservée au propriétaire du partenaire.</div></>;

  return (
    <>
      <Header title="Rôles & Accès" subtitle="Vue propriétaire" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm text-gray-500">Invitez les gérants qui organisent vos créneaux et réservations. Ils n’ont jamais accès à vos revenus ni à la gestion des rôles.</p>
        <button onClick={() => { setFeedback(null); setIsModalOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primaryMedium"><Plus size={16} /> Ajouter un gérant</button>
      </div>

      {feedback && <div className="mb-5 flex items-start gap-2 rounded-lg border border-primary/20 bg-green-50 px-4 py-3 text-sm text-primary"><AlertCircle size={16} className="mt-0.5 shrink-0" />{feedback}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4"><Users size={18} className="text-primary" /><div><h2 className="text-sm font-semibold text-gray-900">Membres du portail</h2><p className="text-xs text-gray-400">Accès de votre établissement uniquement.</p></div></div>
        {isLoading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><Loader2 size={18} className="animate-spin" />Chargement des accès…</div> : members.length === 0 ? <div className="py-16 text-center"><Users size={28} className="mx-auto mb-3 text-gray-300" /><p className="text-sm font-medium text-gray-600">Aucun accès partenaire</p></div> : <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-primary">{['Membre', 'Rôle', 'Statut', 'Dernière activité', 'Actions'].map((label) => <th key={label} className="whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-white">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{members.map((member) => { const name = memberName(member); const status = statusMeta[member.status]; return <tr key={member.id}><td className="px-5 py-3"><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primaryDeep text-[11px] font-bold text-white">{initials(name)}</div><div><p className="text-[13px] font-semibold text-gray-900">{name}</p><p className="text-xs text-gray-400">{member.email}</p></div></div></td><td className="px-5 py-3"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">{member.role === 'OWNER' ? 'Propriétaire' : 'Gérant'}</span></td><td className="px-5 py-3"><span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: status.bg, color: status.color }}>{status.label}</span></td><td className="px-5 py-3 text-xs text-gray-500">{member.last_login_at ? new Date(member.last_login_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Pas encore connecté'}</td><td className="px-5 py-3">{member.role === 'MANAGER' ? <div className="flex items-center gap-2"><button onClick={() => void changeStatus(member, member.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED')} className="text-xs font-semibold text-primary hover:underline">{member.status === 'SUSPENDED' ? 'Réactiver' : 'Suspendre'}</button><button onClick={() => void revoke(member)} aria-label={`Retirer ${name}`} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button></div> : <span className="text-xs text-gray-400">—</span>}</td></tr>; })}</tbody></table></div>}
      </div>
      <div className="mt-5 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800"><ShieldCheck size={16} className="shrink-0" />Les gérants accèdent aux créneaux, réservations et avis. Les revenus, finances et rôles restent exclusivement réservés au propriétaire.</div>

      {isModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><form onSubmit={inviteManager} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-lg font-bold text-gray-900">Ajouter un gérant</h2><p className="mt-1 text-sm text-gray-500">La personne recevra une invitation sécurisée par e-mail.</p><div className="mt-5 space-y-4"><label className="block text-sm font-medium text-gray-700">Nom complet<input required minLength={2} value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-primary" /></label><label className="block text-sm font-medium text-gray-700">Adresse e-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-primary" /></label><label className="block text-sm font-medium text-gray-700">Identifiant <span className="font-normal text-gray-400">(facultatif)</span><input value={username} onChange={(event) => setUsername(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-primary" /></label></div><div className="mt-6 flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setIsModalOpen(false)} className="h-10 rounded-lg px-4 text-sm font-semibold text-gray-600 hover:bg-gray-100">Annuler</button><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">{saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Envoi…' : 'Envoyer l’invitation'}</button></div></form></div>}
    </>
  );
}
