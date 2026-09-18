# Metoda Cyfrowa · 0.1

Nazwa techniczna projektu: `metoda-cyfrowa`.

Lokalna aplikacja do rozpoznawania stopni gamy durowej. HTML, CSS i moduły JavaScript; bez backendu i kont. Web Audio API odtwarza sample prawdziwego fortepianu Salamander (Yamaha C5, Alexander Holm), VexFlow 5 renderuje nuty. Zależności, fonty i sample są lokalne — aplikacja podczas pracy nie korzysta z CDN.

## Uruchomienie

Wymagany Node.js 20.19+ lub 22.12+ i npm.

```sh
npm install
npm run dev
```

Otwórz adres podany przez Vite (domyślnie http://127.0.0.1:5173) w Chrome lub Edge. Kliknięcie „Rozpocznij trening” odblokowuje audio. Używaj serwera lokalnego, nie otwieraj `index.html` przez `file://`.

```sh
npm test          # logika muzyczna, oktawy, statystyka, ustawienia
npm run test:e2e  # testy w zainstalowanym Google Chrome
npm run build    # statyczna aplikacja w dist/
npm run preview  # lokalny podgląd zbudowanej aplikacji
```

Testy E2E korzystają z kanału `chrome`. Jeśli Chrome nie jest zainstalowany, zainstaluj Chromium poleceniem `npx playwright install chromium` i usuń `channel: 'chrome'` z `playwright.config.js`.

## Publikacja: Cloudflare Workers Builds

Projekt jest statyczną aplikacją Vite. Istniejący Worker nazywa się dokładnie
`metoda-cyfrowa`, a jego adres to https://metoda-cyfrowa.sgvb46s755.workers.dev.
Repozytorium: `michal0232-ui/metoda-cyfrowa`, gałąź produkcyjna: `main`.
Należy używać istniejącego Workera, bez tworzenia nowego projektu.

Konfiguracja `wrangler.jsonc` wskazuje `assets.directory: "./dist"`.
Nie jest potrzebny plik wejściowy Workera (`main`), binding zasobów ani plugin
Cloudflare do Vite: aplikacja zawiera wyłącznie statyczny frontend.
Wrangler jest zależnością developerską, a dokładne wersje zależności przechowuje
`package-lock.json`. `.nvmrc` wskazuje Node.js `24.13.0`.

Ustawienia do zastosowania w **istniejącym Workerze → Settings → Build**:

| Ustawienie        | Wartość                        |
| ----------------- | ------------------------------ |
| Repozytorium      | `michal0232-ui/metoda-cyfrowa` |
| Gałąź produkcyjna | `main`                         |
| Root directory    | główny katalog repozytorium    |
| Build command     | `npm run build`                |
| Deploy command    | `npx wrangler deploy`          |
| Katalog assetów   | `./dist` z `wrangler.jsonc`    |

Build musi zakończyć się przed wywołaniem deploy. Samo `npx wrangler deploy`
korzysta z istniejącego `dist`; nie dodano automatycznego build hooka.
Połączenie repozytorium i aktywację automatycznych wdrożeń należy wykonać
osobno, po zatwierdzeniu zmian. Konfiguracja musi być używana na koncie Cloudflare,
na którym istnieje wskazany Worker. Nie zapisuj tokenów autoryzacyjnych w repozytorium.

Lokalna kontrola bez publikacji:

```sh
npm install
npm test
npm run build
npm run preview
```

Nie ustawiaj instalacji z `--omit=dev`: zarówno Vite, jak i Wrangler są potrzebne
podczas build/deploy. `private: true` chroni przed publikacją paczki npm i nie
blokuje GitHuba ani Cloudflare. Aplikacja nie wymaga sekretów ani backendu.

Działanie Vite pozostaje niezmienione: brak własnego `vite.config.*`, domyślne
`base: "/"`, `publicDir: "public"` i `build.outDir: "dist"`. Sample oraz informacje
o autorstwie trafiają do `dist/audio/salamander/`, a siedem grafik gestodźwięków
jest kopiowanych przez Vite do `dist/assets/` z hashami w nazwach. JS, CSS i fonty
nutowe są pakowane jak dotychczas. Ścieżki działają od korzenia domeny Workera;
nie ustawiaj prefiksu `/metoda-cyfrowa/`.

Do repozytorium należą źródła, `wrangler.jsonc`, `package.json`, `package-lock.json`,
`.nvmrc`, `.gitignore`, testy, `assets/gestures/` oraz cały `public/`, wraz z samplami
MP3 i plikami licencyjnymi. `.gitignore` wyklucza `node_modules/`, `dist/`,
`.wrangler/`, `.dev.vars*`, pliki `.env*` (poza przykładem) i lokalne raporty.

Widoczna nazwa to „Metoda Cyfrowa”. Dawna nazwa pozostaje w wewnętrznym kluczu
localStorage i testach zgodności, aby nie resetować ustawień. Ustawienia localhost
nie przenoszą się automatycznie na domenę Workera.

Dokumentacja: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
oraz [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

## Architektura

```text
index.html                      semantyczny interfejs
src/
  app.js                        stany i orkiestracja ćwiczenia
  styles.css                    układ responsywny i stany przycisków
  music/theory.js                tonacje, pisownia nut, MIDI, częstotliwości
  music/scales.js                rejestr rodzajów skal (obecnie durowa)
  audio/engine.js                kolejność odtwarzania, głośność, anulowanie
  audio/sample-instrument.js     preload, dekodowanie, odtwarzanie sampli
  audio/instruments/salamander.js mapa sampli i parametry fortepianu
  exercises/major-degrees.js     kadencja, losowanie, odpowiedzi, rozwiązania
  notation/staff.js              adapter VexFlow; SVG i znaki przykluczowe
  notation/answer-labels.js      cyfry, solmizacja i nazwy europejskie
  settings/settings.js           walidacja, migracja i localStorage
  settings/settings-ui.js        interfejs wyboru tonacji i stopni
  statistics/statistics.js       próby, błędne wybory, podsumowanie
tests/
  music.test.js                  testy jednostkowe (node:test)
  browser/trainer.spec.js        testy integracyjne (Playwright)
```

Nowe ćwiczenia mogą implementować interfejs `createQuestion`, `questionEvents`, `resolutionEvents`, `submitAnswer`. Audio otrzymuje niezależne od ćwiczenia zdarzenia `{ notes: MIDI[], duration, gap }`. Adapter zapisu otrzymuje tę samą strukturę nuty, z której pochodzi dźwięk. Obecny interfejs odpowiedzi jest przeznaczony dla stopni 1–7; inne rodzaje odpowiedzi można dodać w kolejnym etapie.

## Zasady wersji 0.1

- Start: C-dur, wszystkie stopnie, głośność 50%. Można wybrać dowolny niepusty zestaw stopni oraz jedną, kilka lub wszystkie z 13 pisowni tonacji durowych (Fis/Ges to dwie pisownie tej samej wysokości toniki).
- Kadencja: cztery akordy I–IV–V–I, krótka przerwa, jeden dźwięk. Pytania obejmują stopnie w jednej oktawie od dolnej toniki do septymy. C-dur: C4–H4. Rejestry pozostałych tonacji są jawnie określone w `theory.js`.
- Podczas kadencji, rozwiązania i przerwy odpowiedzi są nieaktywne. Po błędzie wybrany przycisk pozostaje wyszarzony i zablokowany, bez nuty ani rozwiązania. Powtórka odtwarza kadencję i ten sam dźwięk oraz zachowuje błędne próby.
- Poprawna odpowiedź ujawnia dokładną nutę (cała nuta jako symbol wysokości, niezależnie od czasu odtwarzania), zapisuje zadanie i uruchamia rozwiązanie. Po jego zakończeniu i przerwie 3 s losowane jest następne zadanie. Powtórzenie tego samego stopnia w losowaniu jest dozwolone.
- „Zakończ” anuluje audio i oczekiwanie. Nierozwiązane zadanie jest porzucane, rozwiązane pozostaje w statystyce. Opuszczenie karty również zatrzymuje trening.
- Statystyki bieżącej sesji pozostają w pamięci do odświeżenia strony. Każdy rekord zawiera `degree`, `key`, `attempts`, `wrongDegrees` w kolejności wyboru i `completedAt`. Pierwsza poprawna próba oznacza `attempts: 1`. Powtórne kliknięcie zablokowanego stopnia nie zwiększa liczby prób.
- Ustawienia (stopnie, pula tonacji, stała tonacja, mieszanie, nazwy odpowiedzi i głośność) są zachowywane w localStorage. Brak dostępu do pamięci przeglądarki nie blokuje treningu.

## Rozwiązania cyfrowe — dokładne oktawy

Frazy zaczynają się od rozpoznawanego stopnia; dla stopnia 7 cały drugi motyw jest przeniesiony oktawę niżej. Kreska pionowa oznacza pauzę między frazami. Przykłady dla C-dur (C4 = środkowe C, H = angielskie B):

| Stopień | Rozwiązanie                                           | Dźwięki             |
| ------- | ----------------------------------------------------- | ------------------- |
| 1       | 1                                                     | C4                  |
| 2       | 2–1                                                   | D4–C4               |
| 3       | 3–2–1                                                 | E4–D4–C4            |
| 4       | 4–3–1                                                 | F4–E4–C4            |
| 5       | 5–1 w dół; 5–1 w górę                                 | G4–C4 ⏐ G4–C5       |
| 6       | 6–5–1 w dół; 6–7–1 w górę                             | A4–G4–C4 ⏐ A4–H4–C5 |
| 7       | 7–1 o sekundę małą w górę; ten sam motyw oktawę niżej | H4–C5 ⏐ H3–C4       |

Pozostałe tonacje transponują wszystkie wysokości, zachowując kierunki, odstępy i podział na frazy. Testy sprawdzają dokładne MIDI wszystkich siedmiu rozwiązań w każdej tonacji oraz zgodność pisowni enharmonicznej z dźwiękiem.

Dokumentacja biblioteki zapisu: [VexFlow — Getting Started](https://vexflow.github.io/vexflow-examples/guides/getting-started/).

## Instrument i preload

14 lokalnych plików MP3 w `public/audio/salamander/` to nagrania fortepianu Salamander Grand Piano, obejmujące pełny zakres obecnych kadencji, pytań i rozwiązań. Mapa ma nagrania co trzy półtony; pozostałe dźwięki odtwarzamy z najbliższego sampla z transpozycją najwyżej o półton. Jest to jedna warstwa dynamiki, bez symulacji pedału i rezonansu pełnego instrumentu SFZ. Autorstwo, źródło i licencja CC BY 3.0: [CREDITS.txt](public/audio/salamander/CREDITS.txt).

Przed aktywowaniem przycisku Start aplikacja pobiera **i dekoduje wszystkie sample**. Ćwiczenie korzysta wyłącznie z buforów w pamięci, również po zmianie tonacji. Błąd pobrania/dekodowania blokuje trening i pokazuje możliwość ponowienia; nie ma zastępczej syntezy oscylatorem. Web Audio może pozostawać zawieszone podczas wstępnego ładowania — kliknięcie Start wznawia kontekst zgodnie z zasadami przeglądarki.

Aby podmienić zestaw nagrań, dodaj mapę instrumentu (MIDI, URL, zakres, release) i przekaż ją do `SampleInstrument` w `app.js`. Aby dodać inny sposób odtwarzania, zaimplementuj adapter instrumentu z metodami `load(context, onProgress)`, `schedule(context, output, { midi, start, duration, velocity })` zwracającą czas zakończenia, oraz `stop(context)`. `AudioEngine` przyjmuje adapter przez konstruktor. Definicje ćwiczeń operują wyłącznie na MIDI i czasach, bez znajomości sampli, instrumentu lub mechanizmu odtwarzania.

## Tonacje i nazwy odpowiedzi

W sekcji „Wybrane tonacje” można zaznaczać osobne tonacje, wybrać „Wszystkie” lub „Tylko bieżąca” (tonacja wskazana w polu „Stała tonacja”). Nie można odznaczyć ostatniej tonacji. Usunięcie aktualnej stałej tonacji z puli przełącza ją na pierwszą zaznaczoną.

- **Mieszaj tonacje — wyłączone:** każde zadanie korzysta ze stałej tonacji wybranej z zaznaczonej puli.
- **Mieszaj tonacje — włączone:** każde nowe zadanie niezależnie losuje tonację z puli; powtórzenie tonacji jest dozwolone. Pole stałej tonacji jest nieaktywne. Kadencja I–IV–V–I, nuty, kafelki oraz statystyka korzystają z tonacji konkretnego zadania. Powtórne odsłuchanie nie losuje nowej tonacji.
- **Nazwy odpowiedzi:** cyfry 1–7, ruchoma solmizacja do–si lub rzeczywiste europejskie nazwy stopni aktualnej tonacji. H oznacza dźwięk B naturalny, B oznacza B♭. Znaki ♯/♭ wynikają z pisowni gamy; np. siódmy stopień Fis-dur to E♯, a czwarty Ges-dur to C♭.

Nazwy można przełączać również podczas zadania. Zmiana etykiet nie przerywa odtwarzania, nie zmienia stopnia, nie odblokowuje błędnych odpowiedzi i nie kasuje statystyki. Klawisze 1–7 zawsze odpowiadają stopniom gamy.

Format ustawień: `keys` — lista identyfikatorów tonacji, `key` — stała tonacja z tej listy, `mixKeys` — boolean, `answerNames` — `digits` / `solfege` / `european` / `gestures`, `noteColors` — boolean (domyślnie `false`), `degrees`, `volume`. Starsze ustawienia zawierające tylko `key` są automatycznie migrowane do jednoelementowej puli, z wyłączonym mieszaniem i etykietami cyfrowymi. Nieprawidłowe wartości są normalizowane do poprawnych ustawień.

Każda tonacja posiada pole `mode`, a interwały skali pochodzą z rejestru `SCALES`. Obecnie zarejestrowano tylko `major`. Dodanie tonacji molowych w przyszłości wymaga rejestracji odpowiedniej skali/tonacji oraz osobnych definicji kadencji i rozwiązań ćwiczenia; obecne rozwiązania durowe pozostają niezależne od sposobu nazwania odpowiedzi.

## Tryb tablicy

Przycisk „⛶ Tryb tablicy” przełącza wyłącznie prezentację ćwiczenia: duża
pięciolinia, status, sterowanie dźwiękiem i siedem kafelków mieszczą się w
aktualnym viewport (`100dvh`) bez przewijania strony. Poniżej 1100 px szerokości
kafelki przechodzą w układ 4+3. Wszystkie cztery sposoby prezentacji odpowiedzi
pozostają dostępne.

„Ustawienia” otwiera duży modal z istniejącymi kontrolkami. Przewijana może być
tylko zawartość modalu, a jego przycisk zamknięcia pozostaje widoczny. Tonacja
i wybór stopni zachowują dotychczasową blokadę podczas treningu; aby je zmienić,
najpierw zamknij panel i zakończ trening. Otwarcie panelu nie przerywa audio.
Skróty odpowiedzi 1–7 nie działają w otwartym modalu.

Fullscreen jest żądany wyłącznie po kliknięciu przycisku wejścia. Jeśli API jest
niedostępne lub odrzuci żądanie, layout tablicy działa w obszarze okna przeglądarki.
Przycisk wyjścia oraz opuszczenie natywnego fullscreen (np. Esc) przywracają zwykły
widok. Esc zamyka również panel ustawień, a w trybie bez fullscreen pozwala wyjść
z tablicy. Tryb nie uruchamia się automatycznie po odświeżeniu.

Testy w `tests/browser/board.spec.js` sprawdzają rozmiary 1920×1080, 1366×768,
1280×720 i 900×720, kompletność widocznego ćwiczenia, odpowiedzi, ustawienia oraz
natywny fullscreen i fallback. Nie zastępują kontroli na fizycznej tablicy Samsung Flip.

## Kolory dźwięków i wizualizacja rozwiązania

„Kolory dźwięków” to niezależne ustawienie Wyłączone/Włączone, domyślnie wyłączone.
Jest zapisywane razem z pozostałymi ustawieniami, również przez panel Trybu tablicy.
Cyfry, ruchoma solmizacja i gestodźwięki są reprezentacjami względnymi:
pozostają neutralne także po włączeniu kolorów. Tylko nazwy europejskie mogą
mieć pasek koloru odpowiadający absolutnej wysokości.
Po poprawnej odpowiedzi kolory włączają podpis nazwy literowej z próbką koloru
oraz kolor główki nuty (publiczne API VexFlow `setKeyStyle`). Pięciolinia,
klucz i znaki przykluczowe nie są kolorowane. Przy wyłączonych kolorach główka
jest czarna. `absolute-note.js` łączy absolutną pisownię i kolor MIDI;
nie istnieje mapa stopnia, solmizacji ani gestu do koloru.

Kolor wynika z rzeczywistej wysokości MIDI modulo 12, a nie ze stopnia gamy.
Zależy zatem od tonacji bieżącego zadania (również przy mieszaniu tonacji), ale
nie od oktawy ani enharmonicznej pisowni. Centralna paleta znajduje się w
`src/music/note-colors.js`:

| Dźwięk  | Kolor              | HEX       |
| ------- | ------------------ | --------- |
| C       | czerwony           | `#E53935` |
| C♯ / D♭ | ciemnoczerwony     | `#9B1C20` |
| D       | pomarańczowy       | `#F58220` |
| D♯ / E♭ | ciemnopomarańczowy | `#A64B00` |
| E       | żółty              | `#F9D635` |
| F       | zielony            | `#36A657` |
| F♯ / G♭ | ciemnozielony      | `#176B3A` |
| G       | niebieski          | `#2474D2` |
| G♯ / A♭ | burgundowy         | `#800020` |
| A       | fioletowy          | `#8046B5` |
| A♯ / B  | seledynowy         | `#A8DDB5` |
| H       | różowy             | `#EF87B5` |

Po poprawnej odpowiedzi zawsze pojawiają się pola z cyframi z istniejących fraz
rozwiązania: zawsze neutralne. Dla stopni 5, 6 i 7 każda fraza ma osobną
grupę. Oba motywy 7–1 zachowują ruch w górę, a drugi leży oktawę niżej.
Cyfry są stale widoczne. Dla czytelności tablicy absolutny podpis dotyczy tylko
rozpoznanej nuty, bez dodatkowej warstwy pod cyframi.
Podświetlenie aktualnego pola korzysta z zegara AudioContext
i nie przebudowuje elementów przy każdym odświeżeniu. Krótkie odstępy między
dźwiękami nie powodują migotania; pauza pomiędzy frazami wygasza podświetlenie.

Po zakończeniu odtwarzania cały przebieg pozostaje widoczny przez 3 sekundy,
niezależnie od ustawienia kolorów. Dopiero potem zaczyna się następne zadanie.
Zakończenie treningu usuwa wizualizację. Zmiana kolorów w trakcie rozwiązania
nie przerywa audio ani postępu. W Trybie tablicy miejsce na rozwiązanie jest
zarezerwowane od początku, aby nie przesuwać kafelków i nie powodować scrolla.
