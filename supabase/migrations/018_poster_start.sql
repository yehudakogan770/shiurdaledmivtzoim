-- 018: A poster can have a starting date: it shows from that day on. Safe to run twice.
alter table posters add column if not exists starts date;
