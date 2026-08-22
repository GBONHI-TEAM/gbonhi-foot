import { Controller, Post, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';

/**
 * Endpoint déclenché par un cron EXTERNE (cron-job.org, GitHub Actions…) pour
 * envoyer les rappels de réservation. Volontairement HORS des guards d'auth :
 * il est protégé par un secret partagé (`CRON_SECRET`) transmis dans l'en-tête
 * `x-cron-secret`. Render (plan gratuit) s'endormant, on ne peut pas utiliser
 * un planificateur interne — d'où ce point d'entrée pingé de l'extérieur.
 */
@Controller('cron')
export class ReservationsCronController {
  constructor(private readonly reservationsService: ReservationsService) {}

  private assertSecret(secret?: string) {
    const expected = process.env.CRON_SECRET?.trim();
    // Si aucun secret n'est configuré, on refuse par sécurité (pas d'endpoint ouvert).
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Secret cron invalide.');
    }
  }

  @Post('reservation-reminders')
  runPost(@Headers('x-cron-secret') secret?: string) {
    this.assertSecret(secret);
    return this.reservationsService.sendDueReminders();
  }

  // Variante GET pour les crons qui n'envoient que des requêtes GET.
  @Get('reservation-reminders')
  runGet(@Headers('x-cron-secret') secret?: string) {
    this.assertSecret(secret);
    return this.reservationsService.sendDueReminders();
  }
}
