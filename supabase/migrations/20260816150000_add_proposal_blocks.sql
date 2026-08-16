-- Faz 1: block-based rendering. `blocks` is an ordered, typed list (HeroCover,
-- RichSection, PricingTable, ContractSignOff) that a single <BlockRenderer>
-- consumes instead of each surface re-deriving layout from the legacy columns.
-- Legacy columns (sections/line_items/contract_text/intro_text/about_text/
-- next_steps...) are NOT dropped — existing rows keep working via
-- lib/proposal-blocks/convert-legacy.ts until later phases migrate every
-- consumer and backfill this column.
alter table proposals add column if not exists blocks jsonb not null default '[]'::jsonb;
alter table templates add column if not exists blocks jsonb not null default '[]'::jsonb;
