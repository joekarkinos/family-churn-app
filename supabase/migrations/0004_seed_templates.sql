-- ─────────────────────────────────────────────────────────────────
-- ZadaniaDom — Seed szablonów zadań (10 szablonów z CLAUDE.md)
-- Idempotentne: ponowne uruchomienie aktualizuje wartości.
-- Rodzina (użytkownicy Auth) jest seedowana skryptem scripts/seed-family.ts.
-- ─────────────────────────────────────────────────────────────────

insert into public.task_templates
  (id, title, description, emoji, default_coins, default_difficulty, suggested_checklist, room)
values
  ('zaladuj-zmywarke', 'Załaduj zmywarkę', 'Ułóż naczynia w zmywarce i dodaj kapsułkę.', '🍽️', 30, 'easy',
   '["Zebrać naczynia ze zlewu i stołu","Poustawiać talerze, kubki, sztućce","Dodać kapsułkę do zmywarki","Ustawić program i uruchomić"]', 'kuchnia'),
  ('rozladuj-zmywarke', 'Rozładuj zmywarkę', 'Wyjmij czyste naczynia i odłóż na miejsce.', '🥣', 25, 'easy',
   '["Sprawdzić czy naczynia są czyste i suche","Odłożyć talerze do szafki","Odłożyć kubki i szklanki","Odłożyć sztućce do szuflady","Zamknąć zmywarkę"]', 'kuchnia'),
  ('rozwiesic-pranie', 'Rozwiesić pranie', 'Wyjmij pranie z pralki i rozwieś na suszarce.', '👕', 60, 'medium',
   '["Wyjąć pranie z pralki","Roztrząsnąć każdą sztukę","Rozwiesić na suszarce","Sprawdzić czy nic się nie zgniata"]', 'prania'),
  ('rozbrac-suche-pranie', 'Rozebrać suche pranie do szafek', 'Złóż wysuszone pranie i odłóż do szafek.', '👗', 50, 'medium',
   '["Sprawdzić czy pranie jest suche","Złożyć każdą sztukę","Odłożyć do właściwych szafek","Złożyć suszarkę"]', 'prania'),
  ('odkurzyc-salon', 'Odkurzyć salon', 'Odkurzyć całą podłogę w salonie, łącznie z przestrzenią pod meblami.', '🧹', 50, 'medium',
   '["Przesunąć poduszki i drobne przedmioty","Odkurzyć środek pokoju","Odkurzyć pod kanapą i przy meblach","Odkurzyć przy ścianach","Odstawić odkurzacz"]', 'salon'),
  ('lazienka-taty', 'Wyczyścić łazienkę Taty', 'Łazienka Taty z kabiną prysznicową.', '🚿', 70, 'hard',
   '["Wyczyścić kabinę prysznicową","Wyczyścić umywalkę","Wyczyścić sedes","Umyć podłogę","Wytrzeć lustro"]', 'lazienka_taty'),
  ('lazienka-z-wanna', 'Wyczyścić łazienkę z wanną', 'Łazienka dziewczyn i Mamy — z wanną.', '🛁', 80, 'hard',
   '["Wyszorować wannę","Wyczyścić umywalkę","Wyczyścić sedes","Umyć podłogę","Wytrzeć lustro"]', 'lazienka_dziewczyn'),
  ('korytarz', 'Pozbierać rzeczy w korytarzu', 'Pozbierać i odłożyć rzeczy leżące w korytarzu.', '📦', 20, 'easy',
   '["Odłożyć buty na miejsce","Powiesić kurtki i torby","Wynieść rzeczy do pokoi","Sprawdzić czy podłoga jest wolna"]', 'korytarz'),
  ('pokoj-hania-maria', 'Posprzątać pokój (Hania & Maria)', 'Wspólny pokój Hani i Marii.', '🛏️', 40, 'medium',
   '["Pościelić oba łóżka","Pozbierać ubrania z podłogi","Odłożyć książki i rzeczy","Przetrzeć biurko"]', 'pokoj_hania_maria'),
  ('pokoj-sonia', 'Posprzątać pokój Soni', 'Osobny pokój Soni.', '🛏️', 40, 'medium',
   '["Pościelić łóżko","Pozbierać ubrania z podłogi","Odłożyć rzeczy na miejsce","Przetrzeć biurko"]', 'pokoj_sonia')
on conflict (id) do update set
  title              = excluded.title,
  description        = excluded.description,
  emoji              = excluded.emoji,
  default_coins      = excluded.default_coins,
  default_difficulty = excluded.default_difficulty,
  suggested_checklist= excluded.suggested_checklist,
  room               = excluded.room;
