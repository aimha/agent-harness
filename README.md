# agent-harness

Regole e strumenti per lo sviluppo con agenti AI nei progetti Aimha: guidelines per gli agenti, skill e comandi OpenCode, flusso OpenSpec, hook e CI.

È un pacchetto npm installato direttamente da GitHub, senza registro. Ogni versione è un tag git:

```bash
npm i -D -E github:aimha/agent-harness#v0.1.0
npx agent-harness help
```

**Stato**: in costruzione, nessuna versione rilasciata. Il contenuto arriva dal template [openspec_agentsguidelines_template](https://github.com/aimha/openspec_agentsguidelines_template), che diventerà il primo progetto a usarlo.

## Struttura

| Percorso | Contenuto |
| --- | --- |
| `bin/cli.js` | Il comando `agent-harness` |
| `lib/sync.js` | Composizione, scrittura e controllo dei file gestiti |
| `lib/hooks.js` | Controlli degli hook git e commitlint |
| `lib/check-flow.sh` | Controllo del flusso OpenSpec sulle PR |
| `lib/commitlint.config.js` | Regole dei messaggi di commit |
| `lib/deps.js` | Percorsi e versioni di OpenSpec e commitlint |
| `assets/guidelines/` | `CORE.md` e `WORKFLOW.md`, composti con il `PATTERNS.md` del progetto in `AGENTS.md`, `CLAUDE.md` e regole Cursor |
| `assets/files/` | File copiati nel progetto allo stesso percorso: comandi e skill OpenCode (compresi quelli di OpenSpec), configurazione OpenSpec, hook di Husky, CI |
| `assets/opencode/permissions.json` | Permessi di base di OpenCode, composti con quelli del progetto |
| `assets/openspec/profile.json` | Workflow OpenSpec attivi, usati per generare i comandi `/opsx-*` |
| `scripts/openspec-assets.js` | Rigenera i comandi e le skill di OpenSpec negli asset (solo per chi sviluppa il pacchetto) |

## Due modi di arrivare nei progetti

- **Copiati** da `agent-harness sync`: i file che gli strumenti cercano in un percorso fisso (`AGENTS.md`, `.opencode/`, `opencode.json`, la CI). Ogni copia porta la versione del pacchetto, e `sync --check` in CI fallisce se qualcuno la modifica a mano.
- **Eseguiti dal pacchetto**: controlli degli hook, controllo del flusso, commitlint, OpenSpec. Nel progetto resta solo la riga che li chiama (gli hook in `.husky/`, i passi di `ci.yml`), e cambiano con la versione.

Il progetto tiene i file suoi, che il `sync` non tocca: `PATTERNS.md`, le aggiunte locali alle regole e ai permessi, glossario, ADR e spec.

## Il sync

```bash
npx agent-harness sync           # genera i file gestiti
npx agent-harness sync --check   # controlla senza scrivere: esce con 1 se qualcosa non è allineato
```

Funziona da qualsiasi cartella del progetto: la radice è quella che contiene il `node_modules` in cui è installato il pacchetto.

**Cosa genera**

| File nel progetto | Da dove arriva |
| --- | --- |
| `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/base.mdc` | `CORE.md` e `WORKFLOW.md` del pacchetto, poi `.agent-guidelines/PATTERNS.md` del progetto |
| `opencode.json` | permessi del pacchetto, poi `opencode.local.json` del progetto se esiste |
| tutto ciò che sta in `assets/files/` | copiato com'è, allo stesso percorso |
| `agent-harness.lock.json` | versione del pacchetto ed elenco dei file gestiti |

**Cosa scrive il progetto**

- `.agent-guidelines/PATTERNS.md`, obbligatorio: stack, struttura, naming, pattern, e le regole che valgono solo per il progetto, per esempio i file protetti dello stack (`vite.config.*`).
- `opencode.local.json`, facoltativo: permessi aggiuntivi, nello stesso formato di `opencode.json`. Le regole vengono accodate a quelle del pacchetto. In OpenCode vince l'ultima regola che corrisponde, quindi una regola locale con lo stesso pattern di una del pacchetto la sostituisce e passa in fondo. Le altre chiavi (per esempio `model`) sostituiscono quelle del pacchetto.

**Il lock** serve a due cose. Mostra quale versione ha generato i file, e `sync --check` segnala quando il pacchetto è stato aggiornato senza rilanciare il `sync`. Elenca anche i file gestiti, così quando una versione nuova smette di fornirne uno il `sync` lo rimuove dal progetto. I file che non sono mai stati nel lock non vengono mai toccati.

Ogni percorso gestito appartiene al pacchetto: il `sync` lo sovrascrive. Se un progetto ha bisogno di un workflow CI in più, lo mette in un file suo accanto a `ci.yml` (per esempio `.github/workflows/e2e.yml`), non dentro `ci.yml`.

`sync --check` controlla anche che `npx openspec` nel progetto trovi la stessa versione di OpenSpec del pacchetto: è quella che usano gli agenti e i comandi del WORKFLOW.

## Gli altri comandi

| Comando | Chi lo usa |
| --- | --- |
| `agent-harness hook pre-commit` | `.husky/pre-commit`: niente commit su `main` e `develop`, file sotto i 500KB, file gestiti allineati e in staging |
| `agent-harness hook pre-push` | `.husky/pre-push`: niente push su `main` e `develop`, anche con `git push origin HEAD:main` da un altro branch |
| `agent-harness hook commit-msg <file>` | `.husky/commit-msg`: Conventional Commits con le regole del pacchetto |
| `agent-harness commitlint --from <sha> --to <sha>` | CI: messaggi di tutti i commit della PR |
| `agent-harness check-flow <branch> <base> <head>` | CI: flusso OpenSpec in base al prefisso del branch |
| `agent-harness openspec <argomenti>` | CI: la CLI OpenSpec nella versione del pacchetto |

## Cosa serve nel progetto

- `@aimha/agent-harness` come devDependency, con versione esatta.
- `husky` come devDependency e `"prepare": "husky"` negli script: è Husky che attiva gli hook a ogni `npm ci` o `npm install`. Gli hook in `.husky/` li scrive il `sync`.
- Niente OpenSpec né commitlint tra le dipendenze del progetto: arrivano con il pacchetto, e una versione diversa nel progetto prenderebbe il posto di quella pinnata. `sync --check` lo segnala.

## Aggiornare OpenSpec o il profilo

1. Cambiare la versione esatta di `@fission-ai/openspec` in `package.json` (release di almeno 5 giorni), oppure i workflow in `assets/openspec/profile.json`.
2. `npm install`, poi `npm run openspec-assets`: rigenera `/opsx-*` e le skill `openspec-*` in `assets/files/.opencode/`, con una configurazione OpenSpec temporanea, senza toccare quella globale.
3. `npm test`: un test fallisce se gli asset non corrispondono alla CLI pinnata.

## Passi di costruzione

1. Struttura del repo e contenuti copiati dal template
2. `sync` e `sync --check`
3. Comandi eseguiti dal pacchetto: hook, controllo del flusso, commitlint, OpenSpec ← questo stato
4. Test e CI del pacchetto, poi tag `v0.1.0`
5. Il template passa a usare il pacchetto
