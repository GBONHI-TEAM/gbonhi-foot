'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '../../../lib/supabase/client';

/**
 * Page de définition du mot de passe, atteinte via le lien reçu par e-mail
 * (invitation admin OU lien « définir un mot de passe » pour un compte existant).
 *
 * Le client @supabase/ssr échange automatiquement le `code` présent dans l'URL
 * contre une session (flux PKCE). On tente aussi l'échange manuellement par
 * robustesse. Une fois la session établie, on autorise la saisie du mot de passe
 * (updateUser), puis on renvoie vers l'écran de connexion.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [phase, setPhase] = useState<'loading' | 'form' | 'invalid' | 'done'>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // 1) Session déjà établie ?
      const { data } = await supabase.auth.getSession();
      if (data.session) { if (active) setPhase('form'); return; }

      // 2) Sinon, échanger le `code` de l'URL (PKCE) contre une session.
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (!exErr) { if (active) setPhase('form'); return; }
      }

      // 3) Dernier recours : re-vérifier (jetons en hash déjà parsés par supabase-js).
      const { data: retry } = await supabase.auth.getSession();
      if (active) setPhase(retry.session ? 'form' : 'invalid');
    })();
    return () => { active = false; };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    setSaving(true);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (upErr) { setError('Impossible d’enregistrer le mot de passe. Le lien a peut-être expiré — redemande un lien.'); return; }
    await supabase.auth.signOut();
    setPhase('done');
    setTimeout(() => router.push('/login'), 2200);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: '#EEF1F4' }}>
      <div className="w-full max-w-[440px] rounded-2xl bg-white p-8 sm:p-10" style={{ boxShadow: '0 24px 60px rgba(15,23,42,0.14)' }}>
        <div className="mb-6 text-center">
          <span className="text-2xl font-black" style={{ color: '#1E7A3A' }}>GBONHI </span>
          <span className="text-2xl font-black" style={{ color: '#F7921E' }}>FOOT</span>
          <p className="mt-1 text-sm text-gray-500">Espace Administrateur</p>
        </div>

        {phase === 'loading' && (
          <p className="py-8 text-center text-sm text-gray-500">Vérification du lien…</p>
        )}

        {phase === 'invalid' && (
          <div className="text-center">
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-500">
              Ce lien est invalide ou a expiré. Demande un nouveau lien d’accès.
            </p>
            <Link href="/forgot-password" className="text-sm font-semibold hover:underline" style={{ color: '#1E7A3A' }}>
              Recevoir un nouveau lien
            </Link>
          </div>
        )}

        {phase === 'done' && (
          <div className="py-6 text-center">
            <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: '#1E7A3A' }} />
            <p className="text-sm text-gray-700">Mot de passe enregistré. Redirection vers la connexion…</p>
          </div>
        )}

        {phase === 'form' && (
          <>
            <h2 className="mb-1.5 text-[24px] font-extrabold leading-tight text-gray-900">Définir votre mot de passe</h2>
            <p className="mb-7 text-sm text-gray-500">Choisissez un mot de passe pour accéder au back-office.</p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-gray-700">Nouveau mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Au moins 8 caractères"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-[52px] w-full rounded-xl border border-gray-200 pl-11 pr-11 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-[#1E7A3A] focus:outline-none focus:ring-1 focus:ring-[#1E7A3A]"
                  />
                  <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={showPassword ? 'Masquer' : 'Afficher'}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-gray-700">Confirmer le mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Retapez le mot de passe"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="h-[52px] w-full rounded-xl border border-gray-200 pl-11 pr-4 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-[#1E7A3A] focus:outline-none focus:ring-1 focus:ring-[#1E7A3A]"
                  />
                </div>
              </div>
              {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-500">{error}</p>}
              <button type="submit" disabled={saving} className="h-[52px] w-full rounded-xl text-sm font-bold text-white transition disabled:opacity-60" style={{ backgroundColor: '#F7921E' }}>
                {saving ? 'Enregistrement…' : 'Enregistrer et continuer'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
