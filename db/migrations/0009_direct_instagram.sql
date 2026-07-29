-- Add Instagram as an independent OAuth provider. This uses Business Login for
-- Instagram and does not require the professional account to be linked to a
-- Facebook Page.

alter type integration_provider add value if not exists 'instagram';
