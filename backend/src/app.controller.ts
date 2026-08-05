import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';

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

  /**
   * Lien d'invitation d'équipe — page « smart link » HTTPS (donc CLIQUABLE dans
   * WhatsApp/SMS, contrairement au scheme `gbonhi://`). Elle tente d'ouvrir l'app
   * sur la bonne route (`gbonhi://team/join?code=…`) et propose un repli manuel.
   *
   * Ex : https://gbonhi-foot-api.onrender.com/join?code=GBF-GZ2C
   */
  @Get('join')
  joinRedirect(@Query('code') rawCode: string | undefined, @Res() reply: FastifyReply) {
    // On n'autorise que [A-Z0-9-] pour empêcher toute injection dans le HTML/JS.
    const code = (rawCode ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
    const deepLink = `gbonhi://team/join?code=${encodeURIComponent(code)}`;
    const downloadUrl = process.env.MOBILE_APP_DOWNLOAD_URL?.trim();
    const fallbackBlock = downloadUrl
      ? `<a class="store" href="${escapeHtml(downloadUrl)}">Télécharger GBONHI FOOT</a>`
      : '<p class="hint">Si l’application n’est pas encore installée, son téléchargement sera bientôt disponible.</p>';

    const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Rejoindre une équipe — GBONHI FOOT</title>
<style>
  body { margin:0; font-family:-apple-system,Segoe UI,Roboto,sans-serif; background:#0D1F0D; color:#fff; text-align:center; padding:48px 24px; }
  h1 { font-size:22px; margin:0 0 8px; }
  p { color:rgba(255,255,255,.7); line-height:1.5; }
  .code { font-size:28px; font-weight:800; letter-spacing:.15em; color:#F7921E; margin:20px 0; }
  a.btn { display:inline-block; margin-top:16px; background:#F7921E; color:#0D1F0D; font-weight:700; text-decoration:none; padding:14px 28px; border-radius:14px; }
  .store { display:inline-block; margin-top:16px; background:#1E7A3A; color:#fff; font-weight:700; text-decoration:none; padding:14px 28px; border-radius:14px; }
  .hint { margin-top:28px; font-size:14px; }
</style>
</head>
<body>
  <h1>GBONHI FOOT ⚽</h1>
  <p>On t'a invité à rejoindre une équipe.</p>
  <div class="code">${code || '—'}</div>
  <a class="btn" href="${deepLink}">Ouvrir dans l'application</a>
  ${fallbackBlock}
  <p class="hint">Si rien ne se passe, ouvre l'app GBONHI FOOT, va dans « Rejoindre une équipe » et saisis le code ci-dessus.</p>
  <script>
    // Tentative d'ouverture automatique de l'app.
    setTimeout(function () { window.location.href = ${JSON.stringify(deepLink)}; }, 300);
  </script>
</body>
</html>`;

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
    const label = kind === 'match' ? 'Suivre ce match' : 'Voir cette publication';
    const fallback = process.env.MOBILE_APP_DOWNLOAD_URL?.trim();
    const fallbackBlock = fallback
      ? `<a class="store" href="${escapeHtml(fallback)}">Télécharger GBONHI FOOT</a>`
      : '<p class="hint">Si l’application n’est pas encore installée, son téléchargement sera bientôt disponible.</p>';
    return reply.type('text/html').send(this.smartLinkHtml(label, deepLink, fallbackBlock));
  }

  private smartLinkHtml(title: string, deepLink: string, fallbackBlock: string): string {
    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — GBONHI FOOT</title><style>
body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0D1F0D;color:#fff;text-align:center;padding:48px 24px}h1{font-size:22px;margin:0 0 8px}p{color:rgba(255,255,255,.7);line-height:1.5}.btn,.store{display:inline-block;margin-top:16px;background:#F7921E;color:#0D1F0D;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:14px}.store{background:#1E7A3A;color:#fff}.hint{margin-top:28px;font-size:14px}
</style></head><body><h1>GBONHI FOOT ⚽</h1><p>${escapeHtml(title)} dans l’application.</p><a class="btn" href="${deepLink}">Ouvrir dans l’application</a>${fallbackBlock}<script>setTimeout(function(){window.location.href=${JSON.stringify(deepLink)}},300)</script></body></html>`;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] ?? char));
}
