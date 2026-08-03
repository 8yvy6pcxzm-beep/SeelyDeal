-- Renames plan tiers to the public marketing names: starter -> lite, growth -> pro, scale -> custom.
alter table companies drop constraint if exists companies_plan_check;

update companies set plan = 'lite' where plan = 'starter';
update companies set plan = 'pro' where plan = 'growth';
update companies set plan = 'custom' where plan = 'scale';

alter table companies alter column plan set default 'lite';
alter table companies add constraint companies_plan_check check (plan in ('lite', 'pro', 'custom'));
