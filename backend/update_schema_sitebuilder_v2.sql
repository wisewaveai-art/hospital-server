-- Add site configuration JSONB column
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS site_config jsonb DEFAULT '{
  "global": {
    "primaryColor": "#6366f1",
    "fontFamily": "Inter",
    "borderRadius": "12px"
  },
  "sections": [
    {
      "id": "header-1",
      "type": "header",
      "config": {
        "variant": "transparent",
        "logoPosition": "left",
        "sticky": true
      }
    },
    {
      "id": "hero-1",
      "type": "hero",
      "config": {
        "title": "Wise Hospital",
        "subtitle": "Advanced Healthcare Management System",
        "layout": "split",
        "showImages": true
      }
    },
    {
      "id": "features-1",
      "type": "features",
      "config": {
        "title": "Why Choose Us",
        "columns": 3,
        "items": [
            { "title": "24/7 Care", "desc": "Always here for you", "icon": "clock" },
            { "title": "Expert Doctors", "desc": "Best in class", "icon": "user-md" },
            { "title": "Modern Tech", "desc": "Latest equipment", "icon": "server" }
        ]
      }
    },
    {
      "id": "footer-1",
      "type": "footer",
      "config": {
         "copyright": "© 2024 Wise Hospital"
      }
    }
  ]
}';
