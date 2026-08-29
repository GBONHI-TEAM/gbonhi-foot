import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { BRAND_LOGO_PNG_BASE64 } from './brand-logo';
import { BRAND_MOTIF_PNG_BASE64 } from './brand-motif';
import { UsersService } from './modules/users/users.service';

/**
 * Routes racine (hors préfixe api/v1).
 */
@Controller()
export class AppController {
  constructor(private readonly usersService: UsersService) {}
  /** Sonde hébergeur (Render envoie un HEAD / pour détecter le port). */
  @Get()
  root() {
    return { name: 'GBONHI FOOT API', status: 'ok', docs: '/api/v1/health' };
  }

  /** Logo GBONHI FOOT servi pour les pages smart-link (mis en cache 30 jours). */
  @Get('brand/logo.png')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'public, max-age=2592000, immutable')
  brandLogo(@Res() reply: FastifyReply) {
    reply.send(Buffer.from(BRAND_LOGO_PNG_BASE64, 'base64'));
  }

  /** Tuile de motif ivoirien (fond des pages smart-link), cache 30 jours. */
  @Get('brand/motif.png')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'public, max-age=2592000, immutable')
  brandMotif(@Res() reply: FastifyReply) {
    reply.send(Buffer.from(BRAND_MOTIF_PNG_BASE64, 'base64'));
  }

  /**
   * Lien d'invitation d'équipe — page « smart link » HTTPS (cliquable dans
   * WhatsApp/SMS). Tente d'ouvrir l'app, sinon redirige vers le store.
   */
  @Get('join')
  joinRedirect(@Query('code') rawCode: string | undefined, @Res() reply: FastifyReply) {
    const code = (rawCode ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
    const deepLink = `gbonhi://team/join?code=${encodeURIComponent(code)}`;
    const html = this.brandedPage({
      title: 'Rejoins une équipe',
      subtitle: "On t'a invité à rejoindre une équipe sur GBONHI FOOT.",
      deepLink,
      extra: `<div class="code">${code || '—'}</div>
      <p class="hint">Si rien ne se passe, ouvre l'app, va dans « Rejoindre une équipe » et saisis ce code.</p>`,
    });
    reply.type('text/html').send(html);
  }

  /** Smart links de match et publication : lien HTTPS partageable → app. */
  @Get('r/:kind/:id')
  contentRedirect(
    @Param('kind') rawKind: string,
    @Param('id') rawId: string,
    @Res() reply: FastifyReply,
  ) {
    const kind = rawKind === 'match' || rawKind === 'post' ? rawKind : null;
    const id = rawId.replace(/[^A-Za-z0-9-]/g, '').slice(0, 64);
    if (!kind || !id) {
      return reply.code(404).type('text/plain').send('Lien GBONHI FOOT invalide.');
    }
    const deepLink = `gbonhi://${kind}/${encodeURIComponent(id)}`;
    const subtitle = kind === 'match' ? 'Suis ce match en direct sur GBONHI FOOT.' : 'Découvre cette publication sur GBONHI FOOT.';
    return reply.type('text/html').send(
      this.brandedPage({ title: kind === 'match' ? 'Suivre le match' : 'Voir la publication', subtitle, deepLink }),
    );
  }

  /** Carte joueur publique et partageable (lien HTTPS `/p/:slug`). */
  @Get('p/:slug')
  async playerCard(@Param('slug') rawSlug: string, @Res() reply: FastifyReply) {
    const slug = (rawSlug ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48);
    try {
      const card = await this.usersService.getPublicPlayerCard(slug);
      return reply.type('text/html').send(this.playerCardPage(card));
    } catch {
      return reply
        .code(404)
        .type('text/html')
        .send(
          this.brandedPage({
            title: 'Carte introuvable',
            subtitle: 'Cette carte de joueur n’existe pas ou n’est pas publique.',
            deepLink: 'gbonhi://home',
          }),
        );
    }
  }

  /** Rendu HTML de la carte joueur (identité + sportif + statistiques). */
  private playerCardPage(card: PlayerCard): string {
    const name = escapeHtml(card.full_name ?? 'Joueur');
    const pos = escapeHtml(card.position ?? card.player_profile?.secondary_position ?? '—');
    const city = card.city ? escapeHtml(card.city) : '';
    const club = card.current_team?.name ? escapeHtml(card.current_team.name) : null;
    const pp: NonNullable<PlayerCard['player_profile']> = card.player_profile ?? {
      birth_date: null, height_cm: null, weight_kg: null, preferred_foot: null, secondary_position: null, level: null,
    };
    const st = card.statistics ?? { matches_played: 0, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };
    const avatar = card.avatar_url ? escapeHtml(card.avatar_url) : '/brand/logo.png';

    const attr = (label: string, value?: string | null) =>
      value ? `<div class="attr"><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value))}</b></div>` : '';
    const foot = pp.preferred_foot === 'left' ? 'Gauche' : pp.preferred_foot === 'right' ? 'Droit' : pp.preferred_foot ?? null;

    const extra = `
      <div class="pcard">
        <img class="pavatar" src="${avatar}" alt="${name}" />
        <div class="pname">${name}</div>
        <div class="pmeta">${[pos, club, city].filter(Boolean).join(' · ')}</div>
        <div class="stats">
          <div class="stat"><b>${st.goals}</b><span>Buts</span></div>
          <div class="stat"><b>${st.assists}</b><span>Passes</span></div>
          <div class="stat"><b>${st.matches_played}</b><span>Matchs</span></div>
        </div>
        <div class="attrs">
          ${attr('Poste', card.position)}
          ${attr('Poste secondaire', pp.secondary_position)}
          ${attr('Pied fort', foot)}
          ${attr('Niveau', pp.level)}
          ${attr('Taille', pp.height_cm ? `${pp.height_cm} cm` : null)}
          ${attr('Poids', pp.weight_kg ? `${pp.weight_kg} kg` : null)}
        </div>
      </div>`;

    return this.brandedPage({
      title: 'Carte de joueur',
      subtitle: 'Découvre ce joueur sur GBONHI FOOT.',
      deepLink: `gbonhi://player/${encodeURIComponent(card.id)}`,
      extra,
      extraCss: `
        .pcard { width:100%; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:22px; padding:24px 20px; margin:8px 0 4px; }
        .pavatar { width:96px; height:96px; border-radius:50%; object-fit:cover; border:3px solid var(--orange); background:#0F3D1E; }
        .pname { font-size:22px; font-weight:800; margin-top:12px; }
        .pmeta { color:rgba(255,255,255,.6); font-size:14px; margin-top:4px; }
        .stats { display:flex; gap:10px; margin:18px 0 4px; }
        .stat { flex:1; background:rgba(0,0,0,.25); border-radius:14px; padding:12px 6px; }
        .stat b { display:block; font-size:24px; color:var(--gold); }
        .stat span { font-size:12px; color:rgba(255,255,255,.55); }
        .attrs { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:14px; text-align:left; }
        .attr { background:rgba(0,0,0,.2); border-radius:12px; padding:10px 12px; }
        .attr span { display:block; font-size:11px; color:rgba(255,255,255,.5); }
        .attr b { font-size:15px; }
      `,
    });
  }

  /** Page smart-link brandée + redirection store intelligente (iOS/Android). */
  private brandedPage(opts: { title: string; subtitle: string; deepLink: string; extra?: string; extraCss?: string }): string {
    const iosUrl = process.env.IOS_APP_STORE_URL?.trim() ?? '';
    const androidUrl = process.env.ANDROID_PLAY_STORE_URL?.trim() ?? '';
    const downloadUrl = process.env.MOBILE_APP_DOWNLOAD_URL?.trim() ?? '';
    const cfg = JSON.stringify({ deep: opts.deepLink, ios: iosUrl, android: androidUrl, download: downloadUrl });

    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.title)} — GBONHI FOOT</title>
<style>
  :root { --green:#1E7A3A; --deep:#0D1F0D; --orange:#F7921E; --gold:#FFB830; }
  * { box-sizing:border-box; }
  html,body { margin:0; }
  body {
    font-family:-apple-system,Segoe UI,Roboto,sans-serif; color:#fff; min-height:100vh;
    display:flex; flex-direction:column; align-items:center;
    /* Fond identique à l'app : motif ivoirien répété sur vert profond */
    background-color:var(--deep);
    background-image:url('/brand/motif.png');
    background-repeat:repeat;
    background-position:top center;
    background-size:auto;
  }
  main { flex:1; width:100%; max-width:440px; padding:56px 28px 40px; text-align:center; display:flex; flex-direction:column; align-items:center; }
  /* Logo avec halo doré (comme le mockup OTP) */
  .logo-wrap { position:relative; margin-bottom:36px; display:flex; align-items:center; justify-content:center; }
  .logo-wrap::before { content:''; position:absolute; width:230px; height:230px; border-radius:50%;
    background:radial-gradient(circle, rgba(255,184,48,.38) 0%, rgba(247,146,30,.18) 38%, rgba(13,31,13,0) 70%); }
  .logo-wrap img { position:relative; width:132px; height:132px; object-fit:contain;
    filter:drop-shadow(0 6px 22px rgba(255,184,48,.35)); }
  h1 { font-size:30px; font-weight:800; margin:0 0 12px; }
  p { color:rgba(255,255,255,.7); line-height:1.6; margin:0 0 6px; font-size:16px; }
  .code { font-size:28px; font-weight:800; letter-spacing:.2em; color:var(--orange); margin:22px 0; }
  .spacer { flex:1; min-height:28px; }
  .btn { display:block; margin:10px 0 0; background:var(--orange); color:#fff; font-weight:800; font-size:17px; text-decoration:none; padding:18px; border-radius:18px; border:0; width:100%; cursor:pointer; box-shadow:0 8px 22px rgba(247,146,30,.32); }
  .btn.secondary { background:transparent; color:rgba(255,255,255,.85); border:1.5px solid rgba(255,255,255,.28); box-shadow:none; margin-top:14px; }
  .hint { margin-top:22px; font-size:13px; color:rgba(255,255,255,.45); }
  .foot { padding:22px; font-size:12px; color:rgba(255,255,255,.35); }
  ${opts.extraCss ?? ''}
</style>
</head>
<body>
  <main>
    <div class="logo-wrap"><img src="/brand/logo.png" alt="GBONHI FOOT" /></div>
    <h1>${escapeHtml(opts.title)}</h1>
    <p>${escapeHtml(opts.subtitle)}</p>
    ${opts.extra ?? ''}
    <div class="spacer"></div>
    <button class="btn" onclick="openApp()">Ouvrir dans l'application</button>
    <button class="btn secondary" onclick="downloadApp()">Télécharger l'application</button>
    <p class="hint">Le football amateur, en 2 clics.</p>
  </main>
  <div class="foot">GBONHI FOOT — Côte d'Ivoire 🇨🇮</div>
  <script>
    var CFG = ${cfg};
    function storeUrl() {
      var ua = navigator.userAgent || '';
      if (/android/i.test(ua)) return CFG.android || CFG.download || '';
      if (/iphone|ipad|ipod/i.test(ua)) return CFG.ios || CFG.download || '';
      return CFG.download || '';
    }
    function openApp() {
      var started = Date.now();
      var url = storeUrl();
      window.location.href = CFG.deep;
      // Si l'app n'est pas installée, on reste sur la page → redirection store.
      if (url) {
        setTimeout(function () {
          if (!document.hidden && Date.now() - started < 2500) window.location.href = url;
        }, 1400);
      }
    }
    function downloadApp() {
      var url = storeUrl();
      if (url) { window.location.href = url; }
      else { alert('GBONHI FOOT arrive très bientôt sur l\\'App Store et Google Play !'); }
    }
    // Tentative d'ouverture automatique à l'arrivée.
    window.addEventListener('load', function () { setTimeout(openApp, 500); });
  </script>
</body>
</html>`;
  }
}

interface PlayerCard {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  position: string | null;
  city: string | null;
  current_team: { id: string; name: string; logo_url: string | null; primary_color: string | null } | null;
  player_profile: {
    birth_date: string | null;
    height_cm: string | null;
    weight_kg: string | null;
    preferred_foot: string | null;
    secondary_position: string | null;
    level: string | null;
  } | null;
  statistics: { matches_played: number; goals: number; assists: number; yellow_cards: number; red_cards: number } | null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] ?? char));
}
