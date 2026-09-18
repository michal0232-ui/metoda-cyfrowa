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

## Publikacja: GitHub i Cloudflare Pages

Projekt jest statyczną aplikacją Vite (bez backendu, Functions i wymaganych sekretów).
Nazwa repozytorium/projektu: `metoda-cyfrowa`. Plik `.nvmrc` wskazuje sprawdzoną
wersję Node.js `24.13.0`; Cloudflare Pages obsługuje ten plik przy wyborze Node.js.

Do repozytorium należy dodać kod, `package.json`, `package-lock.json`, `.nvmrc`,
`.gitignore`, testy, wszystkie siedem plików w `assets/gestures/` oraz cały katalog
`public/` (w tym 14 sampli MP3 i pliki autorstwa/licencji). `.gitignore` wyklucza
zależności, build, raporty testów, pliki środowiskowe i lokalne pliki narzędzi.
`private: true` w `package.json` chroni przed publikacją paczki npm i nie blokuje
repozytorium GitHub ani hostingu Pages.

Kontrola lokalna przed publikacją:

```sh
npm ci
npm test
npm run test:e2e
npm run build
npm run preview
```

Konfiguracja Cloudflare Pages po zatwierdzeniu publikacji:

| Ustawienie                  | Wartość                                  |
| --------------------------- | ---------------------------------------- |
| Framework preset            | None (z jawną komendą Vite poniżej)      |
| Root directory              | katalog główny repozytorium (pole puste) |
| Build command               | `npm run build`                          |
| Build output directory      | `dist`                                   |
| Node.js                     | `24.13.0` z `.nvmrc`                     |
| Sekrety / zmienne aplikacji | brak wymaganych                          |

Nie ustawiaj instalacji z `--omit=dev`: Vite jest zależnością deweloperską potrzebną
do budowania. Testy przeglądarkowe wymagają lokalnego Chrome i nie są częścią komendy
build na Cloudflare. Serwer `npm run dev` służy wyłącznie do pracy lokalnej.

Nie ma własnego `vite.config.*`: używane są domyślne `base: "/"`, `publicDir: "public"`
i `build.outDir: "dist"`. Konfiguracja zakłada hosting pod głównym adresem domeny
Pages lub domeny własnej. Sample i informacje o autorstwie są kopiowane bez zmian
do `dist/audio/salamander/`; ścieżki `/audio/salamander/...` działają od korzenia domeny.
Gesty wskazywane przez `new URL(..., import.meta.url)` trafiają do `dist/assets/`
z hashami w nazwach, a Vite aktualizuje odwołania. Fonty nutowe są w pakiecie VexFlow,
favicon jest osadzony w HTML, a JS i CSS również trafiają do `dist/assets/`.
Nie należy ustawiać prefiksu `/metoda-cyfrowa/` na Cloudflare Pages.

Widoczna nazwa to „Metoda Cyfrowa”. Dawna nazwa pozostaje wyłącznie w wewnętrznym
kluczu localStorage i testach zgodności, aby nie resetować istniejących ustawień.
Ustawienia z localhost nie przenoszą się automatycznie na nową domenę.

Instrukcje nie tworzą repozytorium ani deploymentu. Publikacja wymaga osobnego
potwierdzenia właściciela projektu.

Dokumentacja: [konfiguracja build Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/build-configuration/)
oraz [wybór wersji Node.js](https://developers.cloudflare.com/pages/configuration/build-image/).

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
- Poprawna odpowiedź ujawnia dokładną nutę (cała nuta jako symbol wysokości, niezależnie od czasu odtwarzania), zapisuje zadanie i uruchamia rozwiązanie. Po jego zakończeniu i przerwie 1,5 s losowane jest następne zadanie. Powtórzenie tego samego stopnia w losowaniu jest dozwolone.
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

Format ustawień: `keys` — lista identyfikatorów tonacji, `key` — stała tonacja z tej listy, `mixKeys` — boolean, `answerNames` — `digits` / `solfege` / `european`, `degrees`, `volume`. Starsze ustawienia zawierające tylko `key` są automatycznie migrowane do jednoelementowej puli, z wyłączonym mieszaniem i etykietami cyfrowymi. Nieprawidłowe wartości są normalizowane do poprawnych ustawień.

Każda tonacja posiada pole `mode`, a interwały skali pochodzą z rejestru `SCALES`. Obecnie zarejestrowano tylko `major`. Dodanie tonacji molowych w przyszłości wymaga rejestracji odpowiedniej skali/tonacji oraz osobnych definicji kadencji i rozwiązań ćwiczenia; obecne rozwiązania durowe pozostają niezależne od sposobu nazwania odpowiedzi.
