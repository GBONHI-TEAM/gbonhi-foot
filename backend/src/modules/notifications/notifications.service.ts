import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserPayload } from '../../common/types/user-payload.type';
import { CreateNotificationDto } from './dto/create-notification.dto';

interface NotifyPayload {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_CHANNEL_ID = 'gbonhi-notifications';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Notifications de l'utilisateur connecté. */
  findMine(user: UserPayload) {
    return this.prisma.notification.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }

  /** Toutes les notifications envoyées (vue admin). */
  findAll() {
    return this.prisma.notification.findMany({
      orderBy: { created_at: 'desc' },
      take: 200,
      include: { user: { select: { id: true, full_name: true } } },
    });
  }

  async markRead(id: string, user: UserPayload) {
    await this.prisma.notification.updateMany({
      where: { id, user_id: user.id },
      data: { read: true },
    });
    return { ok: true };
  }

  /** Marque toutes les notifications de l'utilisateur comme lues. */
  async markAllRead(user: UserPayload) {
    await this.prisma.notification.updateMany({
      where: { user_id: user.id, read: false },
      data: { read: true },
    });
    return { ok: true };
  }

  /** Nombre de notifications non lues (badge). */
  async unreadCount(user: UserPayload) {
    const count = await this.prisma.notification.count({
      where: { user_id: user.id, read: false },
    });
    return { count };
  }

  /** Enregistre le token push Expo du device de l'utilisateur (colonne fcm_token). */
  async registerToken(user: UserPayload, token: string) {
    if (!token || !token.startsWith('ExponentPushToken')) {
      // On stocke quand même si format inattendu, mais on log.
      this.logger.warn(`Token push au format inattendu pour ${user.id}`);
    }
    // Un token = un appareil. On le détache de tout AUTRE compte (cas des tests
    // multi-comptes sur le même téléphone) pour que l'appareil ne reçoive que les
    // notifications du compte connecté, et éviter les doublons.
    if (token) {
      await this.prisma.profile.updateMany({
        where: { fcm_token: token, id: { not: user.id } },
        data: { fcm_token: null },
      });
    }
    await this.prisma.profile.update({
      where: { id: user.id },
      data: { fcm_token: token, updated_at: new Date() },
    });
    return { ok: true };
  }

  /**
   * Cœur du système : crée les lignes Notification en base ET envoie le push Expo
   * aux destinataires qui ont un token. Ne jette jamais (best-effort) pour ne pas
   * casser l'action métier qui la déclenche.
   */
  async notify(userIds: string | string[], payload: NotifyPayload) {
    const ids = Array.from(new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean)));
    if (ids.length === 0) return;

    try {
      await this.prisma.notification.createMany({
        data: ids.map((user_id) => ({
          user_id,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          data: (payload.data ?? undefined) as object | undefined,
        })),
      });
    } catch (e) {
      this.logger.error(`Échec insertion notifications: ${(e as Error).message}`);
    }

    // Envoi push (best-effort).
    try {
      const profiles = await this.prisma.profile.findMany({
        where: { id: { in: ids }, fcm_token: { not: null } },
        select: { fcm_token: true },
      });
      // Dédup : un même token (appareil partagé entre comptes de test) ne doit
      // recevoir qu'UN seul push par notification.
      const tokens = Array.from(new Set(profiles.map((p) => p.fcm_token).filter((t): t is string => !!t)));
      if (tokens.length > 0) await this.sendExpoPush(tokens, payload);
    } catch (e) {
      this.logger.error(`Échec envoi push: ${(e as Error).message}`);
    }
  }

  /** Envoi effectif via l'API push Expo (batch de 100 max). */
  private async sendExpoPush(tokens: string[], payload: NotifyPayload) {
    const messages = tokens.map((to) => ({
      to,
      sound: 'default',
      priority: 'high',
      channelId: EXPO_PUSH_CHANNEL_ID,
      title: payload.title,
      body: payload.body,
      data: { type: payload.type, ...(payload.data ?? {}) },
    }));

    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push HTTP ${res.status}: ${await res.text()}`);
      }
    }
  }

  /**
   * Création manuelle d'une notification (endpoint admin). Si `broadcast`
   * (ou aucun destinataire), envoie à tous les profils.
   */
  async create(dto: CreateNotificationDto) {
    const type = dto.type ?? 'info';

    if (dto.broadcast || !dto.user_id) {
      const ids = await this.resolveAudience(dto.target ?? 'all');
      if (ids.length === 0) return { count: 0 };
      await this.notify(ids, { type, title: dto.title, body: dto.body });
      return { count: ids.length };
    }

    await this.notify(dto.user_id, { type, title: dto.title, body: dto.body });
    return { count: 1 };
  }

  /**
   * Résout la liste des destinataires d'une diffusion selon le segment :
   *  - all         : tous les profils
   *  - leagues     : joueurs engagés (membres d'équipe actifs ∪ participations ligue)
   *  - reservation : utilisateurs ayant déjà réservé un terrain
   */
  private async resolveAudience(target: 'all' | 'leagues' | 'reservation'): Promise<string[]> {
    if (target === 'all') {
      const profiles = await this.prisma.profile.findMany({ select: { id: true } });
      return profiles.map((p) => p.id);
    }

    if (target === 'leagues') {
      const [members, participations] = await Promise.all([
        this.prisma.teamMember.findMany({ where: { status: 'active' }, select: { user_id: true } }),
        this.prisma.leaguePlayerRegistration.findMany({ select: { user_id: true } }),
      ]);
      return [...new Set([...members.map((m) => m.user_id), ...participations.map((p) => p.user_id)])];
    }

    // reservation
    const reservations = await this.prisma.reservation.findMany({
      distinct: ['user_id'],
      select: { user_id: true },
    });
    return [...new Set(reservations.map((r) => r.user_id))];
  }
}
