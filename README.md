# LiveScribe

Aplikacja webowa do transkrypcji audio w czasie rzeczywistym. Nagrywa dzwiek z mikrofonu przegladarki, dzieli go na fragmenty i wysyla na serwer, gdzie OpenAI Whisper zamienia mowe na tekst. Wynik pojawia sie na ekranie na zywo.

## Funkcje

- **Transkrypcja na zywo** -- ciagly zapis mowy na tekst z mikrofonu przegladarki
- **Wybor modelu** -- `gpt-4o-mini-transcribe` (szybszy) lub `gpt-4o-transcribe` (dokladniejszy)
- **Obsluga wielu jezykow** -- 14 jezykow + automatyczne wykrywanie
- **Diaryzacja** -- identyfikacja mowcow w rozmowie (model `gpt-4o-transcribe-diarize`)
- **Korekta AI (Clarify)** -- automatyczna poprawa gramatyki i logiki zdań przez GPT-4o-mini
- **Tlumaczenie na zywo** -- dwupanelowy widok z transkrypcja i tlumaczeniem na wybrany jezyk
- **Podsumowanie spotkania** -- generowanie raportu z kluczowymi punktami, celami i zadaniami
- **Klucz API per uzytkownik** -- kazdy uzytkownik podaje wlasny klucz OpenAI, przechowywany tylko w przegladarce
- **Konfigurowalne ustawienia** -- czas chunka, prog ciszy, temperatura, dlugosc kontekstu

---

## Wymagania

- Node.js 20+
- PostgreSQL 14+
- Klucz API OpenAI (https://platform.openai.com/api-keys)

---

## Zmienne srodowiskowe

| Zmienna | Wymagana | Opis |
|---------|----------|------|
| `DATABASE_URL` | Tak | Connection string do PostgreSQL, np. `postgresql://user:pass@localhost:5432/livescribe` |
| `OPENAI_API_KEY` | Nie | Domyslny klucz OpenAI uzywany gdy uzytkownik nie poda wlasnego w ustawieniach |
| `PORT` | Nie | Port serwera (domyslnie `5000`) |

> Klucz API OpenAI mozna rowniez podac bezposrednio w ustawieniach aplikacji w przegladarce. Jest przechowywany wylacznie w localStorage i wysylany z kazdym zadaniem jako naglowek `X-OpenAI-Key`. Nigdy nie jest zapisywany na serwerze.

---

## Uruchomienie lokalne

### 1. Sklonuj repozytorium

```bash
git clone <URL_REPOZYTORIUM>
cd livescribe
```

### 2. Zainstaluj zaleznosci

```bash
npm install
```

### 3. Skonfiguruj baze danych PostgreSQL

Utworz baze danych i ustaw zmienna srodowiskowa:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/livescribe"
```

Zsynchronizuj schemat bazy:

```bash
npm run db:push
```

### 4. Ustaw klucz OpenAI (opcjonalnie)

```bash
export OPENAI_API_KEY="sk-..."
```

Jesli nie ustawisz klucza tutaj, kazdy uzytkownik bedzie musial podac wlasny w ustawieniach aplikacji.

### 5. Uruchom aplikacje

```bash
npm run dev
```

Aplikacja bedzie dostepna pod adresem `http://localhost:5000`.

### Build produkcyjny

```bash
npm run build
npm start
```

---

## Uruchomienie z Docker

### 1. Zbuduj obraz

```bash
docker build -t livescribe .
```

### 2. Uruchom kontener

```bash
docker run -d \
  --name livescribe \
  -p 5000:5000 \
  -e DATABASE_URL="postgresql://user:password@host.docker.internal:5432/livescribe" \
  -e OPENAI_API_KEY="sk-..." \
  livescribe
```

### Z Docker Compose

Utworz plik `docker-compose.yml`:

```yaml
version: "3.8"

services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: livescribe
      POSTGRES_PASSWORD: livescribe
      POSTGRES_DB: livescribe
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://livescribe:livescribe@db:5432/livescribe
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - db

volumes:
  pgdata:
```

Uruchom:

```bash
OPENAI_API_KEY="sk-..." docker compose up -d
```

Aplikacja bedzie dostepna pod `http://localhost:5000`.

---

## Architektura

### Struktura katalogow

```
livescribe/
  client/               # Frontend React (Vite + TypeScript)
    src/
      components/       # Komponenty UI
      hooks/            # Hooki React
      lib/              # Biblioteki pomocnicze
      pages/            # Strony aplikacji
  server/               # Backend Express (TypeScript)
    routes.ts           # Endpointy API
    index.ts            # Punkt wejscia serwera
    storage.ts          # Warstwa dostepu do bazy danych
    db.ts               # Polaczenie z PostgreSQL
  shared/               # Wspolne typy i schematy
    schema.ts           # Schemat bazy danych (Drizzle ORM)
  script/               # Skrypty budowania
```

### Frontend

| Technologia | Zastosowanie |
|-------------|-------------|
| React 18 | Framework UI |
| TypeScript | Typowanie statyczne |
| Vite | Bundler i dev server z HMR |
| Tailwind CSS | Stylowanie |
| shadcn/ui + Radix UI | Komponenty UI |
| Framer Motion | Animacje |
| TanStack React Query | Zarzadzanie stanem serwera |
| Wouter | Routing |

### Backend

| Technologia | Zastosowanie |
|-------------|-------------|
| Express 5 | Serwer HTTP |
| TypeScript + tsx | Runtime z hot-reload |
| Multer | Upload plikow audio |
| OpenAI SDK | Komunikacja z API OpenAI |
| Drizzle ORM | Baza danych PostgreSQL |

---

## Opis kluczowych klas i komponentow

### `ChunkedAudioRecorder` (`client/src/lib/audio-recorder.ts`)

Glowna klasa odpowiedzialna za nagrywanie audio z mikrofonu. Uzywa Web Audio API (`ScriptProcessorNode`) do przechwytywania probek dzwieku w czasie rzeczywistym.

- Nagrywa z czestotliwoscia probkowania 16 kHz (mono)
- Dzieli nagranie na fragmenty (chunki) o konfigurowalnej dlugosci (domyslnie 3 sekundy)
- Koduje kazdy chunk do formatu WAV
- Wykrywa cisze na podstawie poziomu RMS -- ciche fragmenty nie sa wysylane
- Wywoluje callback `onChunk(wavBlob)` dla kazdego aktywnego fragmentu
- Wywoluje callback `onSilenceChange(isSilent)` przy zmianie stanu ciszy

```
start()  -- Uruchamia nagrywanie (prosi o dostep do mikrofonu)
stop()   -- Zatrzymuje nagrywanie i zwalnia zasoby
flush()  -- Przetwarza bufor i wysyla chunk (wewnetrzna)
```

### `useTranscribeChunk` / `useDiarizeChunk` (`client/src/hooks/use-transcription.ts`)

Hooki React (TanStack Query `useMutation`) do komunikacji z API transkrypcji.

- `useTranscribeChunk` -- wysyla chunk audio do `/api/transcribe` z parametrami: model, jezyk, temperatura, kontekst
- `useDiarizeChunk` -- wysyla chunk do `/api/transcribe-diarize` dla identyfikacji mowcow
- Obsluguja blad `DiarizeModelError` gdy model diaryzacji nie jest dostepny
- Klucz API uzytkownika jest przesylany w naglowku `X-OpenAI-Key`

### `Home` (`client/src/pages/Home.tsx`)

Glowny komponent strony. Zarzadza calym przeplywem transkrypcji:

- Laczy `ChunkedAudioRecorder` z hookami transkrypcji
- Zarzadza stanem nagrywania, transkrypcji, tlumaczenia i diaryzacji
- Implementuje pipeline: nagrywanie -> transkrypcja -> korekta (clarify) -> tlumaczenie
- Deduplikacja tekstu -- wykrywa i eliminuje powtorzenia miedzy chunkami (n-gram matching, overlap detection)
- Dwupanelowy layout gdy tlumaczenie jest wlaczone
- Renderuje segmenty diaryzacji z kolorowymi etykietami mowcow

### `SettingsDialog` (`client/src/components/SettingsDialog.tsx`)

Dialog konfiguracji z nastepujacymi opcjami:

- **OpenAI API Key** -- pole z mozliwoscia pokazania/ukrycia klucza
- **Chunk duration** -- co ile sekund wysylac audio (1-10s)
- **Language** -- jezyk transkrypcji (14 jezykow + auto)
- **Transcription model** -- wybor miedzy `gpt-4o-mini-transcribe` a `gpt-4o-transcribe`
- **Speaker diarization** -- przelacznik identyfikacji mowcow
- **Context length** -- ile znakow poprzedniej transkrypcji wysylac jako kontekst (0-500)
- **Temperature** -- parametr kreatywnosci modelu (0.0-1.0)
- **Silence threshold** -- prog RMS ponizej ktorego audio uznawane jest za cisze
- **Clarify** -- przelacznik korekty AI z konfigurowalna liczba zdan na batch
- **Translator** -- przelacznik tlumaczenia na zywo z wyborem jezyka docelowego
- **Summary prompt** -- wlasne instrukcje dla AI przy generowaniu podsumowania

Ustawienia sa przechowywane w `localStorage` i odczytywane przy starcie.

### `SummaryDialog` (`client/src/components/SummaryDialog.tsx`)

Dialog generowania podsumowania spotkania:

- Wysyla pelny tekst transkrypcji do `/api/summarize`
- Wyswietla raport w formacie Markdown (Summary, Key Points, Goals, Action Items)
- Mozliwosc ponownego generowania i kopiowania
- Obsluguje wlasny prompt uzytkownika z ustawien

### Endpointy API (`server/routes.ts`)

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/transcribe` | POST | Transkrypcja audio (multipart/form-data). Parametry: `file`, `model`, `language`, `temperature`, `prompt` |
| `/api/transcribe-diarize` | POST | Transkrypcja z diaryzacja. Parametry: `file`, `language` |
| `/api/clarify` | POST | Korekta gramatyki tekstu (JSON). Parametry: `text`, `language` |
| `/api/translate` | POST | Tlumaczenie tekstu (JSON). Parametry: `text`, `targetLanguage`, `sourceLanguage` |
| `/api/summarize` | POST | Generowanie podsumowania (JSON). Parametry: `text`, `language`, `customPrompt` |

Kazdy endpoint uzywa funkcji `getOpenAI(req)` -- jesli uzytkownik przeslal naglowek `X-OpenAI-Key`, tworzony jest nowy klient OpenAI z tym kluczem. W przeciwnym razie uzywany jest domyslny klucz serwera z `OPENAI_API_KEY`.

### Baza danych (`shared/schema.ts`)

Schemat PostgreSQL zarzadzany przez Drizzle ORM:

- `transcription_logs` -- tabela do przechowywania logów transkrypcji (`id`, `content`, `created_at`)

Synchronizacja schematu z baza: `npm run db:push`

---

## Skrypty NPM

| Skrypt | Opis |
|--------|------|
| `npm run dev` | Uruchamia serwer deweloperski z HMR |
| `npm run build` | Buduje frontend (Vite) i backend (esbuild) do katalogu `dist/` |
| `npm start` | Uruchamia zbudowana aplikacje produkcyjna |
| `npm run db:push` | Synchronizuje schemat bazy danych |
| `npm run check` | Sprawdza typy TypeScript |

---

## Licencja

MIT
