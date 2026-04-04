CREATE TABLE IF NOT EXISTS fluxer.guild_soundboard_sounds (
    guild_id bigint,
    sound_id bigint,
    name text,
    emoji text,
    volume double,
    duration_ms int,
    uploaded_by bigint,
    file_key text,
    created_at timestamp,
    PRIMARY KEY ((guild_id), sound_id)
) WITH CLUSTERING ORDER BY (sound_id DESC);
