'use client';
import { useState } from 'react';
import { Header } from '../../../components/layout/header';
import { Info, Lock, X, UserPlus, Users } from 'lucide-react';
import { useCurrentUser } from '../../../lib/use-user';
import { displayName, initials, ROLE_FR } from '../../../lib/domain';

const PERM_CHIPS = [
  { label: 'Créneaux', locked: false },
  { label: 'Réservations', locked: false },
  { label: 'Live', locked: false },
  { label: 'Avis clients', locked: false },
  { label: 'Revenus', locked: true },
  { label: 'Rôles & Accès', locked: true },
];

export default function RolesPage() {
  const [modal, setModal] = useState(false);
  const user = useCurrentUser();
  const nom = displayName(user);
  const inits = nom ? initials(nom) : '';
  const roleLabel = user ? ROLE_FR[user.role] ?? 'Propriétaire' : 'Propriétaire';
  const identifiant = user?.username ?? user?.email ?? '';

  return (
    <>
      <Header title="Rôles & Accès" subtitle="Vue propriétaire" />

      {/* Membres actifs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-[14px]">Membres actifs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ backgroundColor: '#1E7A3A' }}>
                {['Nom', 'Rôle', 'Identifiant de connexion', 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-[11px] font-semibold text-white uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {user && (
                <tr>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: '#7C3AED' }}>
                        {inits}
                      </div>
                      <span className="text-[13px] font-semibold text-gray-900">{nom}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#EDE9FE', color: '#7C3AED' }}>{roleLabel}</span>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-gray-600">{identifiant || '—'}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: '#10B981' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10B981' }} /> Actif
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-gray-300">—</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accès supplémentaires */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900 text-[14px]">Accès supplémentaires</h2>
            <p className="text-[12px] text-gray-400">Déléguez certaines sections à un gérant.</p>
          </div>
          <button
            onClick={() => setModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border"
            style={{ color: '#F7921E', borderColor: '#F7921E' }}
          >
            <UserPlus size={14} /> Créer un accès
          </button>
        </div>
        <div className="flex flex-col items-center justify-center text-center py-12">
          <Users size={26} className="text-gray-300 mb-3" />
          <p className="text-[13px] font-medium text-gray-500">Aucun accès supplémentaire</p>
          <p className="text-[12px] text-gray-400 mt-1 max-w-xs">Créez un accès gérant pour déléguer la gestion de certaines sections.</p>
        </div>
        <div className="flex items-center gap-1.5 px-5 py-3 border-t border-gray-100">
          <Info size={13} className="text-gray-400 flex-shrink-0" />
          <p className="text-[12px] text-gray-400">Revenus &amp; Finances et Rôles &amp; Accès sont réservés au Propriétaire et ne peuvent pas être délégués.</p>
        </div>
      </div>

      {/* Modal Créer un accès */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-start justify-between p-5 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-[15px]">Créer un accès gérant</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">Créez un identifiant et définissez les permissions d&apos;accès.</p>
              </div>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>

            <div className="px-5 space-y-3">
              <input placeholder="Nom complet *" className="w-full h-11 px-3 rounded-lg border border-gray-200 text-[13px] placeholder:text-gray-400 focus:outline-none focus:border-[#1E7A3A]" />
              <input placeholder="Identifiant *" className="w-full h-11 px-3 rounded-lg border border-gray-200 text-[13px] placeholder:text-gray-400 focus:outline-none focus:border-[#1E7A3A]" />
              <input type="password" placeholder="Mot de passe *" className="w-full h-11 px-3 rounded-lg border border-gray-200 text-[13px] placeholder:text-gray-400 focus:outline-none focus:border-[#1E7A3A]" />
              <input type="password" placeholder="Confirmer le mot de passe *" className="w-full h-11 px-3 rounded-lg border border-gray-200 text-[13px] placeholder:text-gray-400 focus:outline-none focus:border-[#1E7A3A]" />

              <div>
                <p className="text-[12px] font-semibold text-gray-700 mb-2">Permissions</p>
                <div className="grid grid-cols-2 gap-2">
                  {PERM_CHIPS.map((c) => (
                    <label
                      key={c.label}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-medium"
                      style={{
                        backgroundColor: c.locked ? '#F9FAFB' : 'white',
                        borderColor: '#E5E7EB',
                        color: c.locked ? '#9CA3AF' : '#6B7280',
                      }}
                    >
                      <input type="checkbox" disabled={c.locked} className="accent-[#1E7A3A]" />
                      {c.label}
                      {c.locked && <Lock size={11} className="ml-auto" />}
                    </label>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-gray-400">Le gérant se connectera avec l&apos;identifiant et le mot de passe définis ci-dessus.</p>
            </div>

            <div className="flex items-center justify-end gap-3 p-5">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:text-gray-900">Annuler</button>
              <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white" style={{ backgroundColor: '#1E7A3A' }}>Créer l&apos;accès</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
