# Changelog

Le versioni seguono [semver](https://semver.org/lang/it/). Nelle `0.x` una versione minore può richiedere interventi nel progetto: sono elencati sotto "Aggiornare".

## 0.2.2 — 2026-10-22

### Correzioni

- **I lockfile erano soggetti al limite di 500KB del pre-commit**: un lockfile è generato, non si può dividere e cresce con le dipendenze, quindi un progetto vicino al limite si sarebbe trovato bloccato al primo aggiornamento, su qualsiasi branch. `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock` e `pnpm-lock.yaml` sono esenti per nome, in qualunque cartella; il limite resta per tutti gli altri file.

### Aggiornare da 0.2.1

`npm i -D -E github:aimha/agent-harness#v0.2.2`, poi `npx agent-harness sync`: nei file gestiti cambia solo la versione nell'intestazione.

## 0.2.1 — 2026-10-22

### Correzioni

- **Il commit di archiviazione sul branch `ai/` veniva bloccato dal pre-commit**: `npx openspec archive` scrive in `openspec/specs/`, che è tra i file protetti, e lo stesso valeva per il commit del `Purpose` di una capability nuova. Il controllo dei file protetti sui branch `ai/` ora esclude `openspec/specs/`. Le modifiche a mano degli agenti lì restano negate da OpenCode, e la struttura la controlla `openspec validate` in CI.

### Aggiornare da 0.2.0

`npm i -D -E github:aimha/agent-harness#v0.2.1`, poi `npx agent-harness sync`: cambia solo una frase nella sezione "File protetti" di `AGENTS.md`.

## 0.2.0 — 2026-10-22

Il pacchetto segue il modello di Foundation, che è il progetto di riferimento.

### Novità

- **Branch `develop`**: la CI gira sulle PR verso `main`, `develop` e `feature/**`, e la PR tra `develop` e `main` è ammessa in entrambe le direzioni.
- **Summary per percorso del branch**: `ai/x` → `docs/summaries/ai/x.md`.
- **Archive agganciato ai summary**: ogni summary in `docs/summaries/ai/` presente in una PR richiede il suo change archiviato, qualunque sia il branch. Vale anche per le catene di branch che si chiudono con `fix/` o `feature/`.
- **File protetti**: sui branch `ai/` il pre-commit blocca i file che corrispondono ai `deny` di modifica di `opencode.json`, valutati con le regole di OpenCode. La lista in `AGENTS.md` è generata dagli stessi `deny`.
- **Cursor**: comandi `/opsx-*` e skill OpenSpec anche in `.cursor/`; regole per cartella da `.agent-guidelines/cursor-rules.json`.
- **Prettier**: se il progetto dichiara `prettier`, i file gestiti Markdown e JSON escono già formattati con il suo Prettier e la sua configurazione.
- **Regole**: header nel formato di Foundation, tipo di commit `build`, worktree con `npm ci`, plan mode, catene di branch con merge commit e mai squash.
- `.env.example` modificabile a ogni livello; protetti anche i lockfile nelle sottocartelle e gli overlay di `docker-compose`.

### Cambia

- La CI del pacchetto è `.github/workflows/agent-harness.yml` (job `agent-harness`), con solo i suoi controlli. Lint, build e test stanno nel workflow del progetto.
- `ci.yml` e gli hook di `.husky/` passano al progetto: il `sync` li toglie dal lock senza cancellarli.
- `sync --check` e il pre-commit falliscono se manca `.nvmrc`.

### Aggiornare da 0.1.0

1. `npm i -D -E github:aimha/agent-harness#v0.2.0`, poi `npx agent-harness sync`. Il `sync` aggiunge `agent-harness.yml` e segnala `ci.yml` e gli hook come ceduti al progetto.
2. In `ci.yml` togliere i passi che ora fa `agent-harness.yml` (messaggi di commit, flusso OpenSpec, file gestiti, validate, audit), lasciando lint, test e build. Altrimenti girano due volte.
3. Aggiungere `.nvmrc` nella radice, se manca.
4. Spostare i summary esistenti da `docs/summaries/<nome>.md` a `docs/summaries/ai/<nome>.md`.
5. Nella protezione di `main` (e di `develop`), aggiungere il controllo `agent-harness` tra quelli richiesti.

## 0.1.0 — 2026-10-22

Prima versione: `sync` e `sync --check`, hook git, controllo del flusso OpenSpec, commitlint e OpenSpec eseguiti dal pacchetto.
