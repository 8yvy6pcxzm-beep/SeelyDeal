-- Per-proposal visual theme override (primary/accent color, font, cover image).
-- Nullable and opt-in: only proposals drafted from a template that declares its
-- own `theme` (e.g. the "Genel Yüklenici Teklifi — Orta Kapsam" construction
-- template) get a value here. Existing proposals and every other template are
-- unaffected — the public proposal page still falls back to companies.primary_color
-- / companies.cover_image_url when theme_json is null.
alter table proposals add column if not exists theme_json jsonb;
