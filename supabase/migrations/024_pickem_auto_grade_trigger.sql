begin;

drop trigger if exists trg_auto_grade_final_pickem_game
on public.pickem_games;

create trigger trg_auto_grade_final_pickem_game
after update on public.pickem_games
for each row
execute function public.auto_grade_final_pickem_game();

commit;
