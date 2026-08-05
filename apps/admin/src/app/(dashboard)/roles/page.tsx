'use client';
import { useEffect, useState } from 'react';
import { Check, Eye, KeyRound, UserPlus, X } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { ADMIN_ROLES, ROLE_LABELS, type AdminRole } from '../../../lib/admin-access';
import { ApiError, apiFetch } from '../../../lib/api';

type Permission = 'full' | 'limited' | 'none';

const MODULES: { label: string; permissions: Record<AdminRole, Permission> }[] = [
  { label: 'Utilisateurs et support', permissions: { SUPER_ADMIN: 'full', ADMIN: 'full', CONTROLEUR: 'none', SUPPORT: 'full', OPERATEUR: 'none' } },
  { label: 'Ligues et calendriers', permissions: { SUPER_ADMIN: 'full', ADMIN: 'full', CONTROLEUR: 'limited', SUPPORT: 'none', OPERATEUR: 'limited' } },
  { label: 'Matchs et saisie live', permissions: { SUPER_ADMIN: 'full', ADMIN: 'full', CONTROLEUR: 'limited', SUPPORT: 'none', OPERATEUR: 'limited' } },
  { label: 'Terrains et réservations', permissions: { SUPER_ADMIN: 'full', ADMIN: 'full', CONTROLEUR: 'none', SUPPORT: 'none', OPERATEUR: 'limited' } },
  { label: 'Avis et modération', permissions: { SUPER_ADMIN: 'full', ADMIN: 'full', CONTROLEUR: 'none', SUPPORT: 'limited', OPERATEUR: 'none' } },
  { label: 'Finance', permissions: { SUPER_ADMIN: 'full', ADMIN: 'full', CONTROLEUR: 'none', SUPPORT: 'none', OPERATEUR: 'none' } },
  { label: 'Rôles, accès et audit', permissions: { SUPER_ADMIN: 'full', ADMIN: 'none', CONTROLEUR: 'none', SUPPORT: 'none', OPERATEUR: 'none' } },
];

function PermissionCell({ value }: { value: Permission }) {
  if (value === 'full') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check size={15} /> Complet</span>;
  if (value === 'limited') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><Eye size={15} /> Lecture</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400"><X size={15} /> Aucun</span>;
}

interface AdminMember { id: string; full_name: string | null; username: string | null; role: AdminRole; created_at: string; }

function message(error: unknown) {
  return error instanceof ApiError ? error.message : 'Une erreur est survenue. Réessaie dans quelques instants.';
}

export default function RolesPage() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', role: 'ADMIN' as AdminRole, username: '' });
  const [saving, setSaving] = useState(false);
  const load = async () => {
    try { setMembers(await apiFetch<AdminMember[]>('/users/admin-members')); }
    catch (caught) { setError(message(caught)); }
  };
  useEffect(() => { void load(); }, []);
  const invite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const result = await apiFetch<{ invitationSent: boolean }>('/users/admin-invitations', { method: 'POST', body: JSON.stringify({ fullName: form.fullName, email: form.email, role: form.role, ...(form.username.trim() ? { username: form.username.trim() } : {}) }) });
      setNotice(result.invitationSent ? 'Invitation envoyée. Le membre choisira son mot de passe depuis son e-mail.' : 'Rôle administrateur attribué au compte existant.');
      setModal(false); setForm({ fullName: '', email: '', role: 'ADMIN', username: '' }); await load();
    } catch (caught) { setError(message(caught)); }
    finally { setSaving(false); }
  };
  return (
    <>
      <Header title="Rôles & Accès" />
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><KeyRound size={20} className="text-[#1E7A3A]" /> Membres de l’équipe admin</h2><p className="mt-1 text-sm text-slate-500">Les droits sont appliqués par l’API, pas uniquement par l’interface.</p></div>
          <button onClick={() => setModal(true)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#F7921E] px-4 text-sm font-bold text-white"><UserPlus size={16} /> Ajouter un membre</button>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-[780px] w-full text-left text-sm"><thead className="bg-[#1E7A3A] text-xs font-semibold text-white"><tr>{['Membre', 'Identifiant', 'Rôle', 'Créé le', 'Actions'].map((label) => <th key={label} className="px-5 py-3.5 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{members.map((member) => <tr key={member.id}><td className="px-5 py-3.5 font-semibold text-slate-900">{member.full_name?.trim() || member.username?.trim() || 'Compte sans nom'}</td><td className="px-5 py-3.5 text-slate-500">{member.username ? `@${member.username}` : '—'}</td><td className="px-5 py-3.5"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[#1E7A3A]">{ROLE_LABELS[member.role]}</span></td><td className="px-5 py-3.5 text-slate-500">{new Date(member.created_at).toLocaleDateString('fr-FR')}</td><td className="px-5 py-3.5 text-slate-400">•••</td></tr>)}{members.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">Aucun membre administrateur.</td></tr>}</tbody></table></div></div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[920px] w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Module</th>
                {ADMIN_ROLES.map((role) => <th key={role} className="px-4 py-4 font-semibold">{ROLE_LABELS[role]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MODULES.map((module) => (
                <tr key={module.label}>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-800">{module.label}</td>
                  {ADMIN_ROLES.map((role) => <td key={role} className="px-4 py-4"><PermissionCell value={module.permissions[role]} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="flex items-center gap-4 text-xs text-slate-500"><span><Check size={13} className="mr-1 inline text-emerald-600" />Accès complet</span><span><Eye size={13} className="mr-1 inline text-amber-600" />Lecture seule</span><span><X size={13} className="mr-1 inline text-red-500" />Aucun accès</span></p>
      </section>

      {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><form onSubmit={invite} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-lg font-bold text-slate-900">Inviter un membre</h3><p className="mt-1 text-sm text-slate-500">L’accès est créé par e-mail, sans mot de passe partagé.</p></div><button type="button" onClick={() => setModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><div className="mt-5 space-y-4"><label className="block text-sm font-medium text-slate-700">Nom complet<input required minLength={2} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3" /></label><label className="block text-sm font-medium text-slate-700">E-mail<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3" /></label><label className="block text-sm font-medium text-slate-700">Rôle<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AdminRole })} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3">{ADMIN_ROLES.filter((role) => role !== 'SUPER_ADMIN').map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600">Annuler</button><button disabled={saving} type="submit" className="rounded-lg bg-[#1E7A3A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Envoi…' : 'Envoyer l’invitation'}</button></div></form></div>}
    </>
  );
}
