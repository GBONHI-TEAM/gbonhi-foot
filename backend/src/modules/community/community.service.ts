import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { UserPayload } from '../../common/types/user-payload.type';
import { NotificationsService } from '../notifications/notifications.service';

const AUTHOR_SELECT = { id: true, full_name: true, avatar_url: true } as const;

// Types de réactions supportés (⚽ 🔥 👏 💪).
const REACTION_TYPES = ['goal', 'fire', 'clap', 'strong'] as const;
type ReactionType = (typeof REACTION_TYPES)[number];
type ReactionCounts = Record<ReactionType, number>;
function emptyCounts(): ReactionCounts {
  return { goal: 0, fire: 0, clap: 0, strong: 0 };
}

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Nom d'affichage court d'un utilisateur (pour le corps des notifications). */
  private async displayName(userId: string) {
    const p = await this.prisma.profile.findUnique({ where: { id: userId }, select: { full_name: true } });
    return p?.full_name?.trim() || 'Quelqu\'un';
  }

  /**
   * Compteurs de réactions par type + réactions de l'utilisateur, pour un lot de
   * publications. SQL brut (pas de dépendance à la clé composite Prisma).
   */
  private async reactionData(postIds: string[], userId: string) {
    const map = new Map<string, { reactions: ReactionCounts; my_reactions: string[] }>();
    postIds.forEach((id) => map.set(id, { reactions: emptyCounts(), my_reactions: [] }));
    if (postIds.length === 0) return map;

    const ids = Prisma.join(postIds.map((id) => Prisma.sql`${id}::uuid`));

    const counts = await this.prisma.$queryRaw<{ post_id: string; type: string; count: bigint }[]>`
      SELECT post_id::text AS post_id, type, COUNT(*)::bigint AS count
      FROM post_reactions WHERE post_id IN (${ids}) GROUP BY post_id, type`;
    for (const r of counts) {
      const e = map.get(r.post_id);
      if (e && (REACTION_TYPES as readonly string[]).includes(r.type)) {
        e.reactions[r.type as ReactionType] = Number(r.count);
      }
    }

    const mine = await this.prisma.$queryRaw<{ post_id: string; type: string }[]>`
      SELECT post_id::text AS post_id, type FROM post_reactions
      WHERE user_id = ${userId}::uuid AND post_id IN (${ids})`;
    for (const r of mine) {
      const e = map.get(r.post_id);
      if (e) e.my_reactions.push(r.type);
    }
    return map;
  }

  private decorateReactions<T extends { id: string; reactions?: unknown }>(
    post: T,
    rd: { reactions: ReactionCounts; my_reactions: string[] } | undefined,
  ) {
    const data = rd ?? { reactions: emptyCounts(), my_reactions: [] };
    const total = Object.values(data.reactions).reduce((a, b) => a + b, 0);
    // On retire la relation typée `reactions` et on la remplace par les compteurs.
    const { reactions: _typed, ...rest } = post as T & { reactions?: unknown };
    void _typed;
    return {
      ...rest,
      reactions: data.reactions,
      my_reactions: data.my_reactions,
      likes_count: total,
      liked_by_me: data.my_reactions.length > 0,
    };
  }

  /** Fil communautaire, du plus récent au plus ancien. */
  async listPosts(user: UserPayload, opts: { limit?: number; offset?: number }) {
    const take = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const skip = Math.max(opts.offset ?? 0, 0);

    const posts = await this.prisma.communityPost.findMany({
      orderBy: { created_at: 'desc' },
      take,
      skip,
      include: {
        author: { select: AUTHOR_SELECT },
        team: { select: { id: true, name: true } },
      },
    });

    const rmap = await this.reactionData(posts.map((p) => p.id), user.id);
    return posts.map((p) => this.decorateReactions(p, rmap.get(p.id)));
  }

  async createPost(user: UserPayload, dto: { content: string; image_url?: string; team_id?: string; category?: string }) {
    const allowed = ['general', 'equipe', 'league', 'terrain'];
    const category = allowed.includes(dto.category ?? '') ? (dto.category as string) : 'general';
    return this.prisma.communityPost.create({
      data: {
        author_id: user.id,
        content: dto.content,
        image_url: dto.image_url ?? null,
        team_id: dto.team_id ?? null,
        category,
      },
      include: { author: { select: AUTHOR_SELECT }, team: { select: { id: true, name: true } } },
    });
  }

  async getPost(id: string, user: UserPayload) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id },
      include: {
        author: { select: AUTHOR_SELECT },
        team: { select: { id: true, name: true } },
        comments: {
          orderBy: { created_at: 'asc' },
          include: { author: { select: AUTHOR_SELECT } },
        },
      },
    });
    if (!post) throw new NotFoundException('Publication introuvable');
    const rd = (await this.reactionData([post.id], user.id)).get(post.id);
    return this.decorateReactions(post, rd);
  }

  async deletePost(id: string, user: UserPayload) {
    const post = await this.prisma.communityPost.findUnique({ where: { id }, select: { author_id: true } });
    if (!post) throw new NotFoundException('Publication introuvable');
    if (post.author_id !== user.id) throw new ForbiddenException('Seul l\'auteur peut supprimer cette publication');
    await this.prisma.communityPost.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Ajoute / retire une réaction d'un type donné (⚽ 🔥 👏 💪).
   *
   * Un joueur ne peut exprimer qu'une seule réaction par publication. Choisir
   * une autre réaction remplace donc la précédente ; retaper la même la retire.
   */
  async toggleReaction(id: string, user: UserPayload, typeRaw?: string) {
    const type: ReactionType = (REACTION_TYPES as readonly string[]).includes(typeRaw ?? '')
      ? (typeRaw as ReactionType)
      : 'goal';

    const post = await this.prisma.communityPost.findUnique({ where: { id }, select: { id: true, author_id: true } });
    if (!post) throw new NotFoundException('Publication introuvable');

    const existing = await this.prisma.$queryRaw<{ type: string }[]>`
      SELECT type FROM post_reactions
      WHERE post_id = ${id}::uuid AND user_id = ${user.id}::uuid`;

    let added = false;
    if (existing.some((reaction) => reaction.type === type)) {
      await this.prisma.$executeRaw`
        DELETE FROM post_reactions WHERE post_id = ${id}::uuid AND user_id = ${user.id}::uuid AND type = ${type}`;
    } else {
      await this.prisma.$executeRaw`
        DELETE FROM post_reactions WHERE post_id = ${id}::uuid AND user_id = ${user.id}::uuid`;
      await this.prisma.$executeRaw`
        INSERT INTO post_reactions (post_id, user_id, type) VALUES (${id}::uuid, ${user.id}::uuid, ${type})`;
      added = true;
    }

    // Recalcule le total et le stocke dans likes_count (compteur dénormalisé).
    const totalRows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM post_reactions WHERE post_id = ${id}::uuid`;
    const total = Number(totalRows[0]?.count ?? 0);
    await this.prisma.communityPost.update({ where: { id }, data: { likes_count: total } });

    // Notifier l'auteur à l'ajout d'une réaction (sauf sur son propre post).
    if (added && post.author_id && post.author_id !== user.id) {
      const who = await this.displayName(user.id);
      await this.notifications.notify(post.author_id, {
        type: 'community_like',
        title: 'Nouvelle réaction',
        body: `${who} a réagi à ta publication.`,
        data: { post_id: id },
      });
    }

    const rd = (await this.reactionData([id], user.id)).get(id);
    return {
      reactions: rd?.reactions ?? emptyCounts(),
      my_reactions: rd?.my_reactions ?? [],
      likes_count: total,
    };
  }

  /** Compat : ancien endpoint « like » → réaction ⚽ (goal). */
  toggleLike(id: string, user: UserPayload) {
    return this.toggleReaction(id, user, 'goal');
  }

  async listComments(id: string) {
    return this.prisma.postComment.findMany({
      where: { post_id: id },
      orderBy: { created_at: 'asc' },
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  async addComment(id: string, user: UserPayload, content: string) {
    const post = await this.prisma.communityPost.findUnique({ where: { id }, select: { id: true, author_id: true } });
    if (!post) throw new NotFoundException('Publication introuvable');

    const [comment] = await this.prisma.$transaction([
      this.prisma.postComment.create({
        data: { post_id: id, author_id: user.id, content },
        include: { author: { select: AUTHOR_SELECT } },
      }),
      this.prisma.communityPost.update({ where: { id }, data: { comments_count: { increment: 1 } } }),
    ]);

    // Notifier l'auteur du post (sauf s'il commente lui-même).
    if (post.author_id && post.author_id !== user.id) {
      const who = await this.displayName(user.id);
      await this.notifications.notify(post.author_id, {
        type: 'community_comment',
        title: 'Nouveau commentaire',
        body: `${who} a commenté ta publication.`,
        data: { post_id: id },
      });
    }
    return comment;
  }
}
