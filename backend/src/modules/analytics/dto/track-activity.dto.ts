import { IsIn, IsObject, IsOptional } from 'class-validator';

export const ACTIVITY_TYPES = [
  'LOGIN', 'MODE_SELECTED', 'PLAYER_PROFILE_COMPLETED', 'TEAM_CREATED',
  'TEAM_JOINED', 'LEAGUE_VIEWED', 'LEAGUE_JOINED', 'TERRAIN_VIEWED',
  'RESERVATION_STARTED', 'RESERVATION_CREATED', 'PAYMENT_COMPLETED',
] as const;

export class TrackActivityDto {
  @IsIn(ACTIVITY_TYPES)
  type: (typeof ACTIVITY_TYPES)[number];

  @IsOptional()
  @IsIn(['leagues', 'reservation'])
  mode?: 'leagues' | 'reservation';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string | number | boolean>;
}
