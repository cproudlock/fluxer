-- Add thread fields to channels table
ALTER TABLE fluxer.channels ADD thread_archived boolean;
ALTER TABLE fluxer.channels ADD thread_auto_archive_duration int;
ALTER TABLE fluxer.channels ADD thread_archive_timestamp timestamp;
ALTER TABLE fluxer.channels ADD thread_locked boolean;
ALTER TABLE fluxer.channels ADD thread_invitable boolean;
ALTER TABLE fluxer.channels ADD thread_creator_id bigint;
ALTER TABLE fluxer.channels ADD thread_message_count int;
ALTER TABLE fluxer.channels ADD thread_member_count int;

-- Thread members: who is in each thread
CREATE TABLE IF NOT EXISTS fluxer.thread_members (
    thread_id bigint,
    user_id bigint,
    join_timestamp timestamp,
    flags int,
    PRIMARY KEY ((thread_id), user_id)
) WITH CLUSTERING ORDER BY (user_id ASC);

-- Thread members by user: lookup all threads a user is in
CREATE TABLE IF NOT EXISTS fluxer.thread_members_by_user (
    user_id bigint,
    thread_id bigint,
    join_timestamp timestamp,
    PRIMARY KEY ((user_id), thread_id)
) WITH CLUSTERING ORDER BY (thread_id DESC);

-- Active threads by guild: quickly list all active (non-archived) threads
CREATE TABLE IF NOT EXISTS fluxer.active_threads_by_guild (
    guild_id bigint,
    thread_id bigint,
    parent_id bigint,
    created_at timestamp,
    PRIMARY KEY ((guild_id), thread_id)
) WITH CLUSTERING ORDER BY (thread_id DESC);
