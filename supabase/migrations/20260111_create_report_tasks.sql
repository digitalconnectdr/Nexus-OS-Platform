-- Migration: Create report_tasks table for async report generation
-- Created: 2026-01-11

-- Create report_tasks table
CREATE TABLE IF NOT EXISTS report_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('efficiency', 'scorecard', 'campaign', 'sales')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  params JSONB,
  file_path TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_report_tasks_user_id ON report_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_report_tasks_status ON report_tasks(status);
CREATE INDEX IF NOT EXISTS idx_report_tasks_created_at ON report_tasks(created_at DESC);

-- Enable Row Level Security
ALTER TABLE report_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own reports
CREATE POLICY "Users can view own reports"
  ON report_tasks
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can create their own reports
CREATE POLICY "Users can create own reports"
  ON report_tasks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: System can update any report (for Edge Functions)
CREATE POLICY "Service role can update reports"
  ON report_tasks
  FOR UPDATE
  USING (true);

-- Create storage bucket for reports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false,  -- Private bucket, use signed URLs
  10485760,  -- 10MB limit per file
  ARRAY['text/csv', 'application/csv']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Users can upload to their own folder
CREATE POLICY "Users can upload reports"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'reports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: Users can read their own reports
CREATE POLICY "Users can read own reports"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'reports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: Service role can manage all reports
CREATE POLICY "Service role can manage reports"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'reports');

-- Function to cleanup old reports (run daily via cron)
CREATE OR REPLACE FUNCTION cleanup_old_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete report tasks older than 48 hours
  DELETE FROM report_tasks
  WHERE created_at < NOW() - INTERVAL '48 hours';
  
  -- Note: Storage files should be deleted via Edge Function or manually
END;
$$;

-- Comment for documentation
COMMENT ON TABLE report_tasks IS 'Tracks async report generation tasks';
COMMENT ON FUNCTION cleanup_old_reports() IS 'Deletes report tasks older than 48 hours';
