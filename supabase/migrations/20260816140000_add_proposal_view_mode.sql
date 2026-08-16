-- The recipient can view a proposal as a sidebar-navigated, one-page-at-a-time
-- document ("pages") or the classic single scrolling page ("scroll"). Chosen when
-- the proposal is drafted (see components/app/ai-draft-dialog.tsx), read by the
-- public view (app/p/[id]/page.tsx).
alter table proposals add column if not exists view_mode text check (view_mode in ('pages', 'scroll')) default 'pages';
