-- Add forum tag fields to channels table
-- available_tags: JSON array of {id, name, emoji_name} stored on forum channels
-- applied_tags: JSON array of tag ID strings stored on thread channels
ALTER TABLE fluxer.channels ADD available_tags text;
ALTER TABLE fluxer.channels ADD applied_tags text;
