import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { BRAND_LOGO_PNG_BASE64 } from './brand-logo';
import { BRAND_MOTIF_PNG_BASE64 } from './brand-motif';

/**
 * Routes racine (hors préfixe api/v1).
 */
@Controller()
export class AppController {
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

  /** Page smart-link brandée + redirection store intelligente (iOS/Android). */
  private brandedPage(opts: { title: string; subtitle: string; deepLink: string; extra?: string }): string {
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] ?? char));
}
