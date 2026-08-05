CREATE TABLE community_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id     UUID REFERENCES teams(id) ON DELETE SET NULL,
  content     TEXT NOT NULL CHECK (char_length(content) <= 2000),
  image_url   TEXT,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE post_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'like' CHECK (type IN ('like', 'fire', 'clap')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE post_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('match_start', 'match_goal', 'match_end', 'team_invite',
                             'tournament_start', 'post_reaction', 'post_comment')),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data       JSONB,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE community_posts
  SET likes_count = (SELECT COUNT(*) FROM post_reactions WHERE post_id = COALESCE(NEW.post_id, OLD.post_id))
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_reaction_change
  AFTER INSERT OR DELETE ON post_reactions
  FOR EACH ROW EXECUTE PROCEDURE update_post_likes_count();

CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE community_posts
  SET comments_count = (SELECT COUNT(*) FROM post_comments WHERE post_id = COALESCE(NEW.post_id, OLD.post_id))
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW EXECUTE PROCEDURE update_post_comments_count();

CREATE TRIGGER community_posts_updated_at
  BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_public_read" ON community_posts FOR SELECT USING (true);
CREATE POLICY "posts_author_insert" ON community_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_author_delete" ON community_posts FOR DELETE USING (auth.uid() = author_id);

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions_public_read" ON post_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_self_manage" ON post_reactions FOR ALL USING (auth.uid() = user_id);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_public_read" ON post_comments FOR SELECT USING (true);
CREATE POLICY "comments_author_insert" ON post_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments_author_delete" ON post_comments FOR DELETE USING (auth.uid() = author_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_community_posts_author ON community_posts(author_id);
CREATE INDEX idx_community_posts_team ON community_posts(team_id);
CREATE INDEX idx_community_posts_created_at ON community_posts(created_at DESC);
CREATE INDEX idx_post_reactions_post ON post_reactions(post_id);
CREATE INDEX idx_post_comments_post ON post_comments(post_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = FALSE;;
