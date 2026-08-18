-- Add free_tier_count column to profiles table for tracking free tier usage
-- Run this in Supabase SQL Editor

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS free_tier_count INTEGER DEFAULT 0 NOT NULL;

-- Add comment
COMMENT ON COLUMN profiles.free_tier_count IS 'Number of free tier analyses used (max 3)';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_free_tier_count ON profiles(free_tier_count);

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ free_tier_count column added to profiles table';
END $$;

