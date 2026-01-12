# Supabase Configuration

This directory contains Supabase-specific files for the AI SaaS Platform.

## Structure

```
supabase/
├── migrations/          # SQL migrations
│   └── 20260111_create_report_tasks.sql
└── functions/          # Edge Functions (Deno)
    └── generate-report/
        └── index.ts
```

## Setup Instructions

### 1. Apply Migrations

Run the migration in your Supabase project:

```bash
# Option 1: Via Supabase CLI
supabase db push

# Option 2: Via Supabase Dashboard
# Copy the SQL from migrations/ and run in SQL Editor
```

### 2. Deploy Edge Functions

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy generate-report
```

### 3. Set Environment Variables

In Supabase Dashboard > Edge Functions > Settings:

```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=your_database_connection_string
```

## Testing

Test the Edge Function locally:

```bash
supabase functions serve generate-report
```

Then call it:

```bash
curl -X POST http://localhost:54321/functions/v1/generate-report \
  -H "Content-Type: application/json" \
  -d '{"task_id": "test-uuid"}'
```
