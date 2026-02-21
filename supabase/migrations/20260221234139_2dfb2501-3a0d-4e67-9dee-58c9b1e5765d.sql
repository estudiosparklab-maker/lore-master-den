
-- Add individual token size to map_tokens
ALTER TABLE public.map_tokens ADD COLUMN IF NOT EXISTS token_size integer NOT NULL DEFAULT 40;

-- Add structured backpack data (items with name, description, quantity, weight)
ALTER TABLE public.character_sheets ADD COLUMN IF NOT EXISTS backpack_data jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add structured mount data
ALTER TABLE public.character_sheets ADD COLUMN IF NOT EXISTS mount_data jsonb NOT NULL DEFAULT '[]'::jsonb;
