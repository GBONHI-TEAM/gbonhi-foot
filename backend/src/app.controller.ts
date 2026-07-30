import { Controller, Get } from '@nestjs/common';

/**
 * Route racine `/` (hors préfixe api/v1). Répond 200 aux sondes des hébergeurs
 * (Render envoie un HEAD / pour détecter le port) au lieu d'un 404 bruyant.
 */
@Controller()
export class AppController {
  @Get()
  root() {
    return { name: 'GBONHI FOOT API', status: 'ok', docs: '/api/v1/health' };
  }
}
