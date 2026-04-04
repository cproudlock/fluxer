-- Guild scheduled events
CREATE TABLE IF NOT EXISTS fluxer.guild_scheduled_events (
    guild_id bigint,
    event_id bigint,
    name text,
    description text,
    scheduled_start_time timestamp,
    scheduled_end_time timestamp,
    entity_type int,
    status int,
    channel_id bigint,
    location text,
    cover_image text,
    creator_id bigint,
    user_count int,
    created_at timestamp,
    PRIMARY KEY ((guild_id), event_id)
) WITH CLUSTERING ORDER BY (event_id DESC);

-- RSVP tracking: who is interested in each event
CREATE TABLE IF NOT EXISTS fluxer.guild_scheduled_event_users (
    guild_id bigint,
    event_id bigint,
    user_id bigint,
    created_at timestamp,
    PRIMARY KEY ((guild_id, event_id), user_id)
) WITH CLUSTERING ORDER BY (user_id ASC);
