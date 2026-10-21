## Naming conventions

### Branch

- `ai/<descrizione-breve-kebab-case>` — branch agenti AI
- `feature/<descrizione>` — feature developer
- `fix/<descrizione>` — bugfix developer
- `spec/<nome-change>`
- `chore/<descrizione>`

## Lingua

- **Commenti nel codice:** inglese
- **Documentazione** (README, docs/): italiano

## Header e commenti

### Header obbligatorio

Ogni file di codice inizia con questo blocco, seguito da una riga vuota. Si usa la sintassi di commento del linguaggio: `//` per TS/JS, `#` per shell e YAML.

```
// ============================================================
// ROLE: [cosa fa questo file, 1 riga]
// DEPENDS ON: [file/moduli da cui dipende]
// USED BY: [chi usa questo modulo]
// KEY DECISIONS: [perché alcune scelte non ovvie]
// GOTCHAS: [trappole, edge case, comportamenti inattesi]
// LAST UPDATED: [data ISO + breve descrizione]
// ============================================================
```

- ROLE è una sola riga
- GOTCHAS è la sezione più importante: solo ciò che morde
- LAST UPDATED si aggiorna solo per modifiche semanticamente rilevanti
- Al termine di ogni sessione, `/update-context` aggiorna gli header dei file modificati

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

- Conventional Commits con commitlint
- `subject-case: lower-case` — nomi di librerie vanno lowercased nel subject

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
AGENTS.md
CLAUDE.md
commitlint.config.js
config/
docker-compose.yml
Makefile
openspec/config.yaml
openspec/specs/
opencode.json
package-lock.json
package.json        (root e ogni sub-package)
scripts/check-flow.sh
scripts/openspec-update.sh
scripts/sync-agents.js
```
