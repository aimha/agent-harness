# WORKFLOW — Dalla spec al merge

Ogni modifica fatta da un agente è un **change OpenSpec**. Nessun codice viene scritto prima che la spec del change sia conclusa. I branch `feature/`, `fix/` e `chore/` delle persone non richiedono un change.

Il **branch di integrazione** è `develop` se il progetto lo usa, altrimenti `main`. Il lavoro parte da lì e torna lì; `develop` arriva su `main` con una PR di rilascio.

Una spec è **conclusa** quando:

1. `npx openspec validate <nome-change> --strict` passa
2. proposal, spec e design sono stati approvati da un umano nella PR della spec
3. la PR della spec è stata mergiata sul branch di integrazione

## Il flusso in 8 passi

| Passo                 | Dove                         | Comando / artefatto                                   |
| --------------------- | ---------------------------- | ----------------------------------------------------- |
| 1. Analisi            | branch `spec/<nome-change>`  | `/grill` → `GLOSSARY.md`, eventuali ADR in `docs/adr/` |
| 2. Formalizzazione    | branch `spec/<nome-change>`  | `/opsx-new`, poi `/opsx-continue` → `proposal.md` e spec delta |
| 3. Dettaglio tecnico  | branch `spec/<nome-change>`  | `/opsx-continue` → `design.md`                        |
| 4. Validazione        | PR della spec                | `openspec validate --strict` + review umana           |
| 5. Piano              | branch `spec/<nome-change>`  | `/opsx-continue` → `tasks.md`, poi merge della PR     |
| 6. Lavorazioni        | worktree `ai/<nome-change>`  | plan mode, sessione test, poi `/opsx-apply`           |
| 7. Verifica           | worktree + PR                | `/opsx-verify`, test, summary, review umana           |
| 8. Chiusura           | worktree, prima del merge    | `npx openspec archive <nome-change> --yes`            |

### 1. Analisi

- Scegliere il nome del change (kebab-case) e creare il branch `spec/<nome-change>` dal branch di integrazione aggiornato.
- `/grill <descrizione del change>` avvia l'intervista: una decisione alla volta, ogni decisione esplicita.
- I **fatti** (com'è il codice, cosa dicono le spec esistenti) li verifica l'agente. Le **decisioni** le prende l'umano: l'agente le propone con una raccomandazione e aspetta la risposta.
- I termini di dominio emersi vanno in `GLOSSARY.md` appena sono definiti.
- Le decisioni che valgono oltre il singolo change, difficili da invertire e frutto di un trade-off reale, vanno in un ADR in `docs/adr/`. Quelle locali al change finiranno in `design.md`.
- Nessun artefatto OpenSpec e nessun codice in questo passo. L'analisi si chiude con il riepilogo delle decisioni, input dei passi successivi.

### 2–3. Formalizzazione e dettaglio tecnico

- Sullo stesso branch, `/opsx-new <nome-change>` crea la cartella del change, senza artefatti.
- `/opsx-continue` crea un artefatto alla volta: `proposal.md`, spec delta, poi `design.md`. Rileggere ogni artefatto prima di passare al successivo.
- `design.md` rimanda agli ADR del passo 1 invece di ripeterli.
- I comandi OpenSpec di questi passi producono solo documenti: nessuna modifica al codice.

### 4. Validazione

- `npx openspec validate <nome-change> --strict` deve passare.
- Aprire la PR `spec/<nome-change>` → branch di integrazione e chiedere la review di proposal, spec, design, glossario ed eventuali ADR.
- `validate` controlla la forma, non il significato: la review umana è la parte che conta.

### 5. Piano

- Solo dopo l'approvazione: `/opsx-continue` crea `tasks.md` sullo stesso branch.
- Il primo gruppo di task è sempre la scrittura dei test derivati dagli scenari.
- Merge della PR: da questo momento la spec è conclusa.

### 6. Lavorazioni

Creare il worktree dal branch di partenza aggiornato (il branch di integrazione o un `feature/*`, mai `main` se il progetto usa `develop`), con lo stesso nome del change:

```bash
# 1. Creare il worktree
git fetch origin
git worktree add ../worktrees/ai-<nome-change> -b ai/<nome-change> origin/develop

# 2. Installare le dipendenze: il worktree non eredita node_modules
#    (installazioni aggiuntive del progetto, se ci sono, in PATTERNS.md)
cd ../worktrees/ai-<nome-change>
npm ci

# 3. Aprire l'agente sulla cartella del worktree, non sulla root del repo
opencode .
# oppure: code .

# 4. Pubblicare il branch: -u serve perché il branch traccia ancora quello di partenza
git push -u origin ai/<nome-change>

# 5. A task completato e PR mergeata
git worktree remove ../worktrees/ai-<nome-change>
git branch -d ai/<nome-change>
git push origin --delete ai/<nome-change>
```

- `npm ci`, non `npm install`: installa dal lockfile senza riscriverlo.
- Nel worktree di un agente non si dà `direnv allow`: l'`.envrc` carica i secret nella shell, e l'agente non ne ha bisogno.
- Il worktree impedisce per design git lo switch di branch: non è bypassabile con flag o configurazioni.
- **Plan mode** prima di qualsiasi modifica.

Le lavorazioni sono divise in due sessioni separate:

| Sessione   | Contenuto                                                                   |
| ---------- | --------------------------------------------------------------------------- |
| Sessione 1 | test derivati dagli scenari, un test per scenario con il titolo esatto dello scenario; i test devono fallire; commit |
| Sessione 2 | `/opsx-apply`: implementazione fino al verde dei test, task spuntati in `tasks.md` |

L'agente della sessione 2 non modifica i test. Se un test sembra sbagliato, si ferma e lo segnala.

### 7. Verifica

- `/opsx-verify` confronta l'implementazione con gli artefatti del change.
- Tutti i test passano, ogni scenario ha il suo test.
- Summary obbligatorio in `docs/summaries/ai/<nome-change>.md` (vedi sotto).
- PR `ai/<nome-change>` → branch di partenza (il branch di integrazione o il `feature/*` da cui è stato creato), con review umana.

### 8. Chiusura

- Prima del merge, `npx openspec archive <nome-change> --yes` sposta il change in `openspec/changes/archive/` e fonde il delta nelle spec principali in `openspec/specs/`.
- Si usa la CLI e non `/opsx-archive`: la CLI fonde i delta in modo deterministico e si rifiuta di procedere se un `MODIFIED` perderebbe scenari esistenti. `/opsx-archive` fa riscrivere le spec all'agente.
- Se l'archive crea una capability nuova, la spec principale ha un `Purpose` segnaposto e la CI resta rossa finché l'umano non lo compila (almeno 50 caratteri) con un commit sul branch: gli agenti non possono modificare `openspec/specs/`. L'agente lo segnala nel summary, in "Domande aperte e suggerimenti".
- Il commit di archiviazione è l'ultimo dell'agente nella PR: codice e spec aggiornata entrano insieme nel branch di destinazione.

## Catene di branch

Due casi in cui un task produce più di un branch, con **una sola PR**, quella dell'ultimo anello:

- **File protetti e lavoro dell'agente nello stesso task.** Il pre-commit blocca i file protetti sui branch `ai/*`. Il developer scrive a mano i file protetti su un branch `fix/*`, l'agente lavora su un branch `ai/*`; ciascun branch è creato dal precedente (per esempio `fix/r2-tests` → `ai/r2-vault` → `fix/r2-config`).
- **Test prima dell'implementazione.** Il branch dei soli test ha la CI rossa per costruzione e non si mergia da solo: si mergia la PR del branch d'implementazione, che contiene il commit dei test.

**Merge commit o rebase, mai squash**: lo squash cancella dalla history la prova che i test sono stati committati prima del codice.

La regola sull'archive segue il summary, non il nome del branch: se l'ultimo anello è un `fix/`, la PR porta comunque il summary dell'agente e il suo change deve essere archiviato.

## Change senza comportamento nuovo

Refactor, tooling e documentazione fatti da un agente passano comunque da un change OpenSpec, ma senza spec delta: impostare `skip_specs: true` in `openspec/changes/<nome-change>/.openspec.yaml` e motivarlo nella proposal. L'eccezione resta esplicita e tracciata.

## Summary obbligatorio

Al termine del change creare `docs/summaries/ai/<nome-change>.md`: il percorso segue il nome del branch, e il nome corrisponde al change. Esempio: branch `ai/fix-header-mobile` → `docs/summaries/ai/fix-header-mobile.md`.

La PR di un branch `ai/` non passa la CI senza questo file. La CI controlla anche che ogni summary in `docs/summaries/ai/` presente in una PR abbia il suo change archiviato, qualunque sia il branch della PR.

```markdown
# <nome-change>

## Cosa è stato modificato

- ...

## Cosa non è stato modificato

- ...

## Domande aperte e suggerimenti

- ...
```

## Sessioni

- Una sessione = un passo del flusso, o una delle due sessioni del passo 6
- Nuovo obiettivo = nuova sessione
- Chiudere la sessione orientativamente al 70-80% della context window; ideale non superare il 40-50%
- Al termine di ogni sessione eseguire `/update-context` per aggiornare gli header dei file modificati

### Segnali di degrado da monitorare

- L'agente ignora vincoli espliciti nelle guidelines
- Produce file non richiesti o modifica file fuori scope
- Il codice prodotto non rispetta le convenzioni di naming o struttura
- Le risposte diventano più generiche e meno specifiche al progetto

## Azioni vietate agli agenti

- Scrivere codice prima che la spec del change sia conclusa
- Modificare i test durante l'implementazione
- Modificare a mano `openspec/specs/`: si aggiorna solo con `npx openspec archive`
- Switch di branch durante una sessione
- Amend su commit già pushati
- Push diretti su branch protetti (`main`, `develop`)
- Operazioni di merge o rebase
- `--no-verify` su commit e push
- `npm audit fix --force`
- Modifica di file protetti (lista in CORE)
