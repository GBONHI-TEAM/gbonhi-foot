'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Lock as LockSmall } from 'lucide-react';
import logoSrc from '../../../assets/logo.png';
import bandTl from '../../../assets/band-tl.png';
import bandBr from '../../../assets/band-br.png';
import filigrane from '../../../assets/filigrane.png';
import { createSupabaseBrowserClient } from '../../../lib/supabase/client';
import { apiFetch } from '../../../lib/api';
import { isAdminRole } from '../../../lib/admin-access';

const asUrl = (a: unknown) => (typeof a === 'string' ? a : (a as { src: string }).src);

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setLoading(false);
      if (authError.status === 0) {
        setError('Le service de connexion est momentanément inaccessible. Vérifie ta connexion Internet puis réessaie.');
      } else if (authError.code === 'email_not_confirmed') {
        setError('Cette adresse email doit être confirmée avant de pouvoir se connecter.');
      } else {
        setError('Adresse email ou mot de passe incorrect.');
      }
      return;
    }

    try {
      const profile = await apiFetch<{ role?: string }>('/users/me');
      if (!isAdminRole(profile.role)) {
        await supabase.auth.signOut();
        setError('Ce compte ne possède pas d’accès au back-office administrateur.');
        return;
      }
    } catch {
      await supabase.auth.signOut();
      setError('Impossible de vérifier vos droits d’accès. Réessayez dans quelques instants.');
      return;
    } finally {
      setLoading(false);
    }
    router.push('/tableau-de-bord');
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6 sm:p-10"
      style={{ backgroundColor: '#EEF1F4' }}
    >
      {/* Carte centrée */}
      <div
        className="flex w-full max-w-[1120px] overflow-hidden rounded-2xl bg-white"
        style={{ minHeight: '680px', boxShadow: '0 24px 60px rgba(15,23,42,0.14)' }}
      >
        {/* ─── Panneau gauche ───────────────────────────────────────────────
            Couche 1 : fond vert #0D1F0D
            Couche 2 : halo radial vert derrière le logo
            Couche 3 : filigrane officiel (100% du panneau)
            Couche 4 : bandes décoratives (coins TL & BR)         */}
        <div
          className="relative hidden w-[55%] overflow-hidden lg:block"
          style={{ backgroundColor: '#0D1F0D' }}
        >
          {/* Couche 3 — filigrane officiel tuilé */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `url(${asUrl(filigrane)})`,
              backgroundRepeat: 'repeat',
              backgroundSize: '180px 180px',
            }}
          />
          {/* Couche 2 — halo radial vert derrière le logo */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 46%, rgba(58,181,94,0.28) 0%, rgba(46,158,79,0.14) 34%, rgba(13,31,13,0) 62%)',
            }}
          />
          {/* Couche 4 — bandes décoratives officielles (extraites de la maquette) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asUrl(bandTl)}
            alt=""
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 w-[62%]"
            draggable={false}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asUrl(bandBr)}
            alt=""
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-0 w-[62%]"
            draggable={false}
          />

          {/* Contenu centré : logo + libellé */}
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asUrl(logoSrc)}
              alt="GBONHI FOOT"
              className="h-auto w-[248px] select-none"
              draggable={false}
            />
            <p className="mt-5 text-xl font-bold tracking-wide text-white">Espace Administrateur</p>
            <div className="mt-3 h-0.5 w-24 rounded-full" style={{ backgroundColor: '#F7921E' }} />
          </div>
        </div>

        {/* ─── Panneau droit blanc ─────────────────────────────────────────── */}
        <div className="flex flex-1 items-center justify-center bg-white px-8 py-12 sm:px-14">
          <div className="w-full max-w-[400px]">
            <div className="mb-8 text-center lg:hidden">
              <span className="text-3xl font-black" style={{ color: '#1E7A3A' }}>GBONHI </span>
              <span className="text-3xl font-black" style={{ color: '#F7921E' }}>FOOT</span>
              <p className="mt-1 text-sm text-gray-500">Espace Administrateur</p>
            </div>

            <h2 className="mb-1.5 text-[28px] font-extrabold leading-tight text-gray-900">Connexion</h2>
            <p className="mb-8 text-sm text-gray-500">Accédez à votre tableau de bord</p>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-gray-700">Adresse email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    placeholder="admin@gbonhifoot.ci"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-[52px] w-full rounded-xl border border-gray-200 pl-11 pr-4 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-[#1E7A3A] focus:outline-none focus:ring-1 focus:ring-[#1E7A3A]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[13px] font-semibold text-gray-700">Mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-[52px] w-full rounded-xl border border-gray-200 pl-11 pr-11 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-[#1E7A3A] focus:outline-none focus:ring-1 focus:ring-[#1E7A3A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="mt-2 text-right">
                  <a href="#" className="text-[13px] font-semibold hover:underline" style={{ color: '#1E7A3A' }}>
                    Mot de passe oublié ?
                  </a>
                </div>
              </div>

              {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="h-[52px] w-full rounded-xl text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-60"
                style={{ backgroundColor: '#1E7A3A' }}
              >
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>

            <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-sm text-gray-400">
              <LockSmall size={13} /> Accès restreint — GBONHI FOOT
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
