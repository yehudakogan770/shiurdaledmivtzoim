-- The order of the mivtzoim on everyone's front page, set by an admin.
alter table personal_categories add column if not exists position integer;
