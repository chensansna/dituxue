alter table public.profiles
  add column if not exists honorific text,
  add column if not exists avatar_color text not null default '#176b4d',
  add column if not exists theme_mode text not null default 'light',
  add column if not exists theme_color text not null default 'green';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_theme_mode_check'
  ) then
    alter table public.profiles
      add constraint profiles_theme_mode_check
      check (theme_mode in ('light', 'dark'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_theme_color_check'
  ) then
    alter table public.profiles
      add constraint profiles_theme_color_check
      check (theme_color in ('green', 'blue', 'purple', 'slate'));
  end if;
end $$;
