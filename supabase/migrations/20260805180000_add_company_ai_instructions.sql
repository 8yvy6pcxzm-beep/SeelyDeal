-- Freeform, persistent instructions the company writes once and that get injected into every
-- future AI proposal draft (all plans — not gated) so users don't have to repeat themselves.
alter table companies add column if not exists ai_instructions text;
