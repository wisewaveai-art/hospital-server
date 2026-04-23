-- Add app_theme column to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS app_theme jsonb DEFAULT '{
  "textColor": "#ffffff",
  "dangerColor": "#ef4444",
  "primaryColor": "#6366f1",
  "backgroundColor": "#020617",
  "headerColor": "rgba(15, 23, 42, 0.8)",
  "modalColor": "#1e293b"
}';
