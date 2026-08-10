-- Şikayet/geri bildirimlerin seelynow.com üzerindeki Seely (site-assistant) sohbetinden
-- yakalanıp saklanması için — demo_requests tablosuyla aynı desen: sahip (contactEmail)
-- girip okuyor, e-posta bildirimi yok.
create table if not exists site_feedback (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  contact text,
  created_at timestamptz not null default now()
);
