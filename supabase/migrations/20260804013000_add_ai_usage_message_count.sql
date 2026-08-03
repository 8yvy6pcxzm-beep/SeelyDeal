-- Second counter alongside ai_usage.count (completed drafts): tracks every AI chat
-- message regardless of whether it produced a finished draft, so abusive/runaway
-- chatting can't rack up unlimited real Anthropic API cost for free.
alter table ai_usage add column if not exists message_count integer not null default 0;
