-- Convertit les anciens likes en réaction "goal" (⚽)
UPDATE post_reactions SET type = 'goal' WHERE type = 'like' OR type IS NULL;

-- Autorise une réaction par type et par utilisateur (⚽ 🔥 👏 💪)
ALTER TABLE post_reactions DROP CONSTRAINT IF EXISTS post_reactions_post_id_user_id_key;
ALTER TABLE post_reactions ADD CONSTRAINT post_reactions_post_id_user_id_type_key UNIQUE (post_id, user_id, type);;
