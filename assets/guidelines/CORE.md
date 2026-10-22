# CORE — Naming, convenzioni, restrizioni assolute

Stack, struttura del progetto, naming dei file e pattern stanno in `PATTERNS.md`, più sotto. Dove `PATTERNS.md` è più preciso di questa sezione, vale `PATTERNS.md`.

## Naming conventions

### Branch

- `ai/<descrizione-breve-kebab-case>` — branch agenti AI
- `feature/<descrizione>` — feature developer
- `fix/<descrizione>` — bugfix developer
- `spec/<nome-change>` — spec OpenSpec di un change (vedi WORKFLOW)
- `chore/<descrizione>` — manutenzione: tooling, dipendenze, documentazione
- `main` e `develop` — branch principali, mai lavorati direttamente

## Lingua

- **Commenti nel codice:** inglese
- **Documentazione** (README, docs/): italiano

## File header obbligatorio

Ogni file di codice inizia con questo blocco. Quali file e quali cartelle lo richiedono, e quali sono esenti, lo dice `PATTERNS.md`; se non lo dice, vale per ogni file di codice. Si usa la sintassi di commento del linguaggio: `//` per TS/JS, `#` per shell e YAML.

```
// ============================================================
// ROLE: [cosa fa questo file, 1 riga]
// DEPENDS ON: [file/moduli da cui dipende]
// USED BY: [chi usa questo modulo]
// KEY DECISIONS: [perché alcune scelte non ovvie]
// GOTCHAS: [trappole, edge case, comportamenti inattesi]
// LAST UPDATED: YYYY-MM-DD — [breve descrizione]
// ============================================================
```

- Delimitatori: `// ` seguito da esattamente 60 `=`, in apertura e in chiusura. Prima dell'header non c'è niente, né commenti né import; l'unica eccezione è lo shebang (`#!/usr/bin/env ...`) di un file eseguibile, che resta sulla prima riga.
- Tutti e sei i campi, in quest'ordine. Un campo senza contenuto vale `none`.
- Un campo che continua va a capo con `//` e almeno due spazi di rientro (`//   ...`).
- `ROLE` è una sola riga. `GOTCHAS` è la sezione più importante: solo ciò che morde.
- `LAST UPDATED`: data ISO, trattino lungo `—`, descrizione. Si aggiorna quando cambiano il comportamento o l'API del file, e quando il file viene rinominato (`renamed from <nome precedente>`). Non si aggiorna per modifiche al solo header, per la formattazione o per i percorsi degli import.
- Esenti di norma: le migration e i file di configurazione dei tool (`eslint.config.*`, `prettier.config.js`, `vite.config.js` e simili). L'elenco esatto sta in `PATTERNS.md`.
- Al termine di ogni sessione, `/update-context` aggiorna gli header dei file modificati.

### Commenti inline

- Una riga sopra ogni metodo o funzione: **cosa fa**, non come

  ```typescript
  // Calculates the order total applying discounts and VAT
  function calculateTotal(order: Order): number { ... }
  ```

- Una riga sopra ogni gruppo logico di stato o costanti: il **dominio** che rappresenta
- I commenti descrivono il perché o il dominio, mai il cosa se è già evidente dal nome
- Sempre una riga sola, mai blocchi di commento su più righe
- Nessun commento su codice auto-esplicativo (getter banali, assegnazioni ovvie)

## Commit

- Conventional Commits con commitlint: `<type>(<scope>): <descrizione>`
- Tipi ammessi: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`, `ci`, `build`. `style` è solo formattazione, zero logica
- `subject-case: lower-case` — nomi di librerie vanno lowercased nel subject
- Validati dall'hook `commit-msg` e, sull'intera PR, dalla CI

## Regole generali

- Non duplicare logica già esistente: cercare prima
- Prima di modificare un file esistente, leggerlo interamente
- Al termine di ogni modifica, elencare i file toccati
- Problemi fuori scope: segnalare nel summary senza sistemare autonomamente

## Gestione dipendenze

Nessuna nuova dipendenza senza approvazione esplicita. Segnalare nel summary come domanda aperta.

## Gestione ambiguità

Se un requisito è ambiguo, l'agente si ferma e formula la domanda specifica nel summary. Nessuna implementazione basata su assunzioni non dichiarate.

## File protetti — mai toccati dagli agenti

```
.agent-guidelines/*
.cursor/
.env*               (eccetto .env.example)
.github/workflows/*
.husky/*
.opencode/commands/
.opencode/skills/
.npmrc
agent-harness.lock.json
AGENTS.md
CLAUDE.md
docker-compose.yml
Makefile
openspec/config.yaml
openspec/specs/
opencode.json
opencode.local.json
package-lock.json
package.json        (root e ogni sub-package)
```

I file protetti propri dello stack (per esempio `vite.config.*`) sono elencati in `PATTERNS.md`.
