import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';
import { CommunityService } from './community.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { UserPayload } from '../../common/types/user-payload.type';

class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  team_id?: string;
}

class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content: string;
}

class ReactDto {
  @IsOptional()
  @IsString()
  type?: string;
}

@ApiTags('Community')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('posts')
  @ApiOperation({ summary: 'Fil communautaire' })
  listPosts(
    @CurrentUser() user: UserPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.community.listPosts(user, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('posts')
  @ApiOperation({ summary: 'Créer une publication' })
  createPost(@CurrentUser() user: UserPayload, @Body() dto: CreatePostDto) {
    return this.community.createPost(user, dto);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Détail d\'une publication (avec commentaires)' })
  getPost(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.community.getPost(id, user);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Supprimer sa publication' })
  deletePost(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.community.deletePost(id, user);
  }

  @Post('posts/:id/like')
  @ApiOperation({ summary: 'Compat : réaction ⚽ (goal)' })
  toggleLike(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.community.toggleLike(id, user);
  }

  @Post('posts/:id/react')
  @ApiOperation({ summary: 'Ajouter / retirer une réaction (goal, fire, clap, strong)' })
  react(@Param('id') id: string, @Body() dto: ReactDto, @CurrentUser() user: UserPayload) {
    return this.community.toggleReaction(id, user, dto?.type);
  }

  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'Commentaires d\'une publication' })
  listComments(@Param('id') id: string) {
    return this.community.listComments(id);
  }

  @Post('posts/:id/comments')
  @ApiOperation({ summary: 'Commenter une publication' })
  addComment(@Param('id') id: string, @CurrentUser() user: UserPayload, @Body() dto: CreateCommentDto) {
    return this.community.addComment(id, user, dto.content);
  }
}
