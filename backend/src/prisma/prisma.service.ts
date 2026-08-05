import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const RETRYABLE_DATABASE_CODES = new Set(['P1001', 'P1017']);

function isRetryableDatabaseError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && RETRYABLE_DATABASE_CODES.has(code);
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Supabase limite très fortement les connexions du pooler de session (5432).
 * L'API Nest effectue des requêtes concurrentes : elle doit donc utiliser le
 * pooler transactionnel (6543), qui remet chaque connexion dans le pool à la
 * fin de la requête. La transformation garde les environnements non-Supabase
 * inchangés et évite de dupliquer un secret dans le code.
 */
function runtimeDatabaseUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl) return '';

  const url = new URL(databaseUrl);
  if (url.hostname.endsWith('.pooler.supabase.com') && url.port === '5432') {
    url.port = '6543';
    url.searchParams.set('pgbouncer', 'true');
    url.searchParams.set('connection_limit', '5');
    url.searchParams.set('pool_timeout', '15');
    // libpq (psql) négocie TLS par défaut, mais Prisma ne le déduit pas
    // toujours d'une URL de pooler sans `sslmode`. Le pooler Supabase refuse
    // la connexion non chiffrée et Prisma la rapporte seulement comme P1001.
    if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require');
  }
  return url.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    // Ne pas appeler $connect ici ou pendant le bootstrap Nest : un refus
    // temporaire du pooler Supabase ne doit jamais empêcher l'API de démarrer.
    // Prisma établit la connexion de façon sûre à la première requête.
    const databaseUrl = runtimeDatabaseUrl(process.env.DATABASE_URL);
    super({
      datasources: { db: { url: databaseUrl } },
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Le pooler Supabase peut refuser une connexion très brièvement après une
   * veille réseau ou une remise en route. Une seule requête de lecture ne doit
   * pas faire échouer le parcours terrain dans ce cas. Les erreurs métier et
   * SQL restent, elles, immédiatement remontées sans être masquées.
   */
  async withRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await operation();
      } catch (error: unknown) {
        lastError = error;
        if (!isRetryableDatabaseError(error) || attempt === attempts - 1) {
          throw error;
        }

        await wait(250 * (attempt + 1));
        // $connect ne recrée une connexion que si Prisma en a réellement
        // besoin ; on ne déconnecte pas les requêtes concurrentes en cours.
        await this.$connect().catch(() => undefined);
      }
    }

    throw lastError;
  }
}
