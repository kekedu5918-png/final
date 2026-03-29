-- Colonnes sync : fiches FSRS (flashcards), oral, session fiches dues
-- À appliquer sur le projet Supabase (SQL Editor ou CLI) si la table `progress` existe déjà.

alter table public.progress
  add column if not exists flash_fsrs jsonb default '{}'::jsonb;

alter table public.progress
  add column if not exists oral_scores jsonb default '{}'::jsonb;

alter table public.progress
  add column if not exists fs_due_session jsonb;

comment on column public.progress.flash_fsrs is 'FSRS flashcards (S.flashFsrs)';
comment on column public.progress.oral_scores is 'Progression entraînement oral (S.oral)';
comment on column public.progress.fs_due_session is 'Session fiches dues { ids: [...] } ou null';
