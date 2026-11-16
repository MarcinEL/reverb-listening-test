# Reverb Listening Test — Aplikacja do subiektywnych testów odsłuchowych pogłosu

Webowa platforma do przeprowadzania subiektywnych testów odsłuchowych jakości pogłosu algorytmicznego (w szczególności struktur FDN — *Feedback Delay Network*), działająca w przeglądarce bez konieczności instalacji zewnętrznych zależności (Vanilla JS + Web Audio API `AudioWorklet`).

Aplikacja obsługuje dwa główne standardy i protokoły testowe:
1. **MUSHRA** (*MUlti Stimulus test with Hidden Reference and Anchor*, zgodnie z zaleceniem ITU-R BS.1534) — `index.html` / `listening_test.html`
2. **Testy porównawcze par (AB, ABX, Preferencja)** — `listening_test_ab.html`

---

## Główne funkcjonalności

* **Silnik audio niskiej latencji (`AudioWorkletNode`)**:
  * Przetwarzanie w dedykowanym wątku audio w blokach 128 próbek (~2,9 ms przy 44,1 kHz / ~2,7 ms przy 48 kHz).
  * Bezszwowe przełączanie między próbkami w pętli z zachowaniem bieżącej pozycji odtwarzania oraz wygładzaniem **crossfade 5 ms** (okno kosinusowe / *raised-cosine*), eliminującym trzaski komutacyjne.
  * Precyzyjne przewijanie (kliknięcie na obwiedni sygnału) z interpolacją pozycji kursora.
* **Zabezpieczenia metodologiczne (ślepe testy)**:
  * Losowa permutacja kolejności próbek w scenariuszach MUSHRA oraz kolejności par (i przypisania próbki $X \in \{A, B\}$) w testach AB/ABX.
  * Ukrywanie podglądu obwiedni czasowej (*waveform*) dla sygnału referencyjnego (**Referencja**), sygnału suchego (**Dry**) oraz próbki **X** w trybie ABX, aby uniemożliwić wzrokowe dopasowanie próbek.
  * Odblokowywanie suwaka oceny MUSHRA wyłącznie dla aktualnie odsłuchiwanej próbki.
* **Dwa tryby pracy**:
  * **Tryb administratora** (domyślny) — graficzny edytor scenariuszy/par testowych, podgląd i eksport plików konfiguracyjnych JSON (`config.json`, `config_ab.json`).
  * **Tryb uczestnika** (`?participant=1`) — bezpośrednie przejście do formularza uczestnika i właściwego testu odsłuchowego.
* **Zbieranie wyników (Google Sheets Webhook)**:
  * Automatyczny zapis wyników do arkusza Google Sheets za pośrednictwem skryptu `google_apps_script.js` (osobne zakładki dla `MUSHRA`, `AB`, `ABX`, `PREFERENCE`).

---

## Struktura repozytorium

```text
├── index.html                  # Aplikacja testowa MUSHRA (strona główna GitHub Pages)
├── listening_test.html         # Aplikacja testowa MUSHRA (kopia zgodna z index.html)
├── listening_test_ab.html      # Aplikacja testowa AB / ABX / Preferencja
├── audio-processor.js          # Procesor AudioWorklet (odtwarzanie w pętli, crossfade 5 ms)
├── config.json                 # Konfiguracja scenariuszy dla testu MUSHRA
├── config_ab.json              # Konfiguracja par porównawczych dla testu AB / ABX / Preferencja
├── google_apps_script.js       # Skrypt Google Apps Script (odbiornik wyników do Google Sheets)
├── samples/                    # Pliki audio WAV (44,1 kHz) wykorzystywane w testach
│   ├── wokal_*                 # Scenariusz: Wokal żeński (Room, 1 s)
│   ├── perkusja_*              # Scenariusz: Perkusja (Room, 1 s)
│   ├── fortepian_*             # Scenariusz: Fortepian (Hall, 5 s)
│   ├── miks_*                  # Scenariusz: Miks utworu (Hall, 5 s)
│   └── Snare_*                 # Dodatkowe próbki testowe werbla (Large Hall)
└── .github/workflows/          # Konfiguracja automatycznego wdrożenia na GitHub Pages
```

---

## Uruchomienie lokalne

Ze względu na wymagania bezpieczeństwa przeglądarek dotyczące modułów `AudioWorklet` (`audioCtx.audioWorklet.addModule('audio-processor.js')`) oraz pobierania plików audio/JSON przez `fetch` / `XMLHttpRequest`, aplikację należy uruchamiać przez **lokalny serwer HTTP** (lub HTTPS na GitHub Pages), a nie bezpośrednio przez protokół `file://`.

### Szybki start (Python)

W katalogu głównym projektu uruchom:

```bash
python -m http.server 8000
```

Następnie otwórz w przeglądarce jeden z poniższych adresów:

* **Test MUSHRA (tryb administratora / konfigurator):**
  `http://localhost:8000/index.html`
* **Test MUSHRA (bezpośredni link dla uczestnika):**
  `http://localhost:8000/index.html?participant=1`
* **Test AB / ABX / Preferencja (tryb administratora / konfigurator):**
  `http://localhost:8000/listening_test_ab.html`
* **Test AB / ABX / Preferencja (bezpośredni link dla uczestnika):**
  `http://localhost:8000/listening_test_ab.html?participant=1`

### Parametry URL

| Parametr | Opis | Przykład |
| :--- | :--- | :--- |
| `participant` | Pomija ekran konfiguracji administratora i uruchamia test dla słuchacza | `?participant=1` |
| `config` | Wskazuje alternatywny plik JSON z konfiguracją testu | `?participant=1&config=moj_config.json` |

---

## Konfiguracja testów

### 1. Test MUSHRA (`config.json`)

Każdy scenariusz w `config.json` definiuje ścieżkę referencyjną (`reference`), opcjonalną ścieżkę suchą (`dry`) oraz zestaw ocenianych próbek (`samples`), wśród których zgodnie ze standardem MUSHRA powinny znaleźć się:
* **ukryta referencja** (`hidden_ref`) — kopia sygnału referencyjnego,
* **kotwica** (`anchor`) — sygnał o celowo obniżonej jakości (np. monofoniczny, ograniczony pasmowo),
* **badane algorytmy pogłosu** (np. `fdn_wojda`, `dragonfly`, `orilriver`, `valhalla`).

Przykład struktury `config.json`:
```json
{
  "title": "Ocena jakości pogłosu FDN",
  "randomize": true,
  "webhook": "https://script.google.com/macros/s/.../exec",
  "scenarios": [
    {
      "name": "Wokal żeński — Room (krótki pogłos)",
      "description": "Porównaj i oceń jakość pogłosu typu Room na wokalu żeńskim.",
      "reference": "samples/wokal_ref_1s_mix.wav",
      "dry": "samples/wokal_dry.wav",
      "samples": [
        { "id": "fdn_wojda", "label": "Sample A", "url": "samples/wokal_poglosie_1s_mix.wav" },
        { "id": "hidden_ref", "label": "Sample B", "url": "samples/wokal_ref_1s_mix.wav" },
        { "id": "dragonfly", "label": "Sample C", "url": "samples/wokal_dragonfly_1s_mix.wav" },
        { "id": "orilriver", "label": "Sample D", "url": "samples/wokal_orilriver_1s_mix.wav" },
        { "id": "anchor", "label": "Sample E", "url": "samples/wokal_ref_1s_mix_anchor.wav" }
      ]
    }
  ]
}
```

### 2. Test AB / ABX / Preferencja (`config_ab.json`)

Pole `mode` przyjmuje jedną z wartości:
* `"ab"` — wybór lepszej próbki (`A jest lepsza`, `Brak różnicy`, `B jest lepsza`),
* `"abx"` — ślepy test rozróżnialności (`X = A` lub `X = B`), z pomiarem czasu reakcji i automatycznym zliczaniem trafności,
* `"preference"` — wymuszony wybór preferencji (`Wolę A` lub `Wolę B`).

---

## Integracja z Google Sheets (`google_apps_script.js`)

Aby zbierać wyniki testów w arkuszu Google Sheets:

1. Utwórz nowy arkusz w **Google Sheets** i przejdź do **Rozszerzenia → Apps Script**.
2. Wklej zawartość pliku `google_apps_script.js` i zapisz projekt.
3. Kliknij **Wdróż → Nowe wdrożenie** (*Deploy → New deployment*).
4. Wybierz typ: **Aplikacja internetowa** (*Web app*).
5. Ustaw:
   * **Wykonywanie jako**: *Ja* (właściciel arkusza),
   * **Kto ma dostęp**: *Każdy* (*Anyone*).
6. Skopiuj wygenerowany adres URL aplikacji internetowej (`https://script.google.com/macros/s/.../exec`) i wklej go w polu `webhook` w plikach `config.json` oraz `config_ab.json`.
