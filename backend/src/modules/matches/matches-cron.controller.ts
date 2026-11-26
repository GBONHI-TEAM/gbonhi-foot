import { Controller, Post, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { MatchesService } from './matches.service';

/**
 * Endpoint déclenché par un cron EXTERNE (cron-job.org, GitHub Actions…) pour
 * envoyer les notifications de match (1 h avant + coup d'envoi, L7).
 * Même mécanisme que les rappels de réservation : hors guards d'auth,
 * protégé par le secret partagé `CRON_SECRET` (en-tête `x-cron-secret`).
 * Render (plan gratuit) s'endormant, pas de planificateur interne.
 */
@Controller('cron')
export class MatchesCronController {
  constructor(private readonly matchesService: MatchesService) {}

  private assertSecret(secret?: string) {
    const expected = process.env.CRON_SECRET?.trim();
    // Si aucun secret n'est configuré, on refuse par sécurité (pas d'endpoint ouvert).
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Secret cron invalide.');
    }
  }

  @Post('match-reminders')
  runPost(@Headers('x-cron-secret') secret?: string) {
    this.assertSecret(secret);
    return this.matchesService.sendMatchReminders();
  }

  // Variante GET pour les crons qui n'envoient que des requêtes GET.
  @Get('match-reminders')
  runGet(@Headers('x-cron-secret') secret?: string) {
    this.assertSecret(secret);
    return this.matchesService.sendMatchReminders();
  }
}
