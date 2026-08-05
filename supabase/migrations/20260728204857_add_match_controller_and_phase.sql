alter table public.matches
  add column if not exists controller_name text,
  add column if not exists phase text;
comment on column public.matches.controller_name is 'Nom/Prénom du contrôleur de match (BO saisie score).';
comment on column public.matches.phase is 'Phase de déroulement : PREMIERE_MP, ARRET_JEU, ADDITIONNEL_1, MI_TEMPS, DEUXIEME_MP, ADDITIONNEL_2, TERMINE.';;
