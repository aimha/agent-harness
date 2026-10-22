# agent-harness

Regole e strumenti per lo sviluppo con agenti AI nei progetti Aimha: guidelines per gli agenti, skill e comandi OpenCode, flusso OpenSpec, hook e CI.

È un pacchetto npm installato direttamente da GitHub, senza registro. Ogni versione è un tag git:

```bash
npm i -D -E github:aimha/agent-harness#v0.1.0
npx agent-harness help
```

Il contenuto arriva dal template [openspec_agentsguidelines_template](https://github.com/aimha/openspec_agentsguidelines_template), che è il primo progetto a usarlo.

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
| `assets/files/` | File copiati nel progetto allo stesso percorso: comandi e skill per OpenCode e, per OpenSpec, anche per Cursor; configurazione OpenSpec; CI del pacchetto |
| `lib/cursor.js` | Regole Cursor: `base.mdc` e quelle per cartella |
| `lib/permissions.js` | Valutazione dei permessi come la fa OpenCode |
| `assets/opencode/permissions.json` | Permessi di base di OpenCode, composti con quelli del progetto |
| `assets/openspec/profile.json` | Workflow OpenSpec attivi, usati per generare i comandi `/opsx-*` |
| `scripts/openspec-assets.js` | Rigenera i comandi e le skill di OpenSpec negli asset (solo per chi sviluppa il pacchetto) |

## Due modi di arrivare nei progetti

- **Copiati** da `agent-harness sync`: i file che gli strumenti cercano in un percorso fisso (`AGENTS.md`, `.opencode/`, `opencode.json`, la CI). Ogni copia porta la versione del pacchetto, e `sync --check` in CI fallisce se qualcuno la modifica a mano.
- **Eseguiti dal pacchetto**: controlli degli hook, controllo del flusso, commitlint, OpenSpec. Nel progetto resta solo la riga che li chiama: una riga negli hook di `.husky/`, che restano del progetto, e i passi di `agent-harness.yml`. Cambiano con la versione.

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
| `AGENTS.md`, `CLAUDE.md` | `CORE.md` e `WORKFLOW.md` del pacchetto, poi `.agent-guidelines/PATTERNS.md` del progetto |
| `.cursor/rules/base.mdc` e le regole per cartella | come sopra, scelte da `.agent-guidelines/cursor-rules.json` se c'è |
| `opencode.json` | permessi del pacchetto, poi `opencode.local.json` del progetto se esiste |
| tutto ciò che sta in `assets/files/` | copiato com'è, allo stesso percorso |
| `agent-harness.lock.json` | versione del pacchetto ed elenco dei file gestiti |

**Cosa scrive il progetto**

- `.agent-guidelines/PATTERNS.md`, obbligatorio: stack, struttura, naming, pattern, e le regole che valgono solo per il progetto, per esempio i file protetti dello stack (`vite.config.*`).
- `opencode.local.json`, facoltativo: permessi aggiuntivi, nello stesso formato di `opencode.json`. I suoi `deny` di modifica sono anche i file protetti del progetto: il pre-commit li blocca sui branch `ai/`, e il `sync` li elenca nella sezione "File protetti" di `AGENTS.md`. Una sola lista, letta con le regole di OpenCode: i pattern partono dalla radice, quindi un file in una sottocartella si scrive con `*/` davanti (`*/vite.config.*`). Le regole vengono accodate a quelle del pacchetto. In OpenCode vince l'ultima regola che corrisponde, quindi una regola locale con lo stesso pattern di una del pacchetto la sostituisce e passa in fondo. Le altre chiavi (per esempio `model`) sostituiscono quelle del pacchetto.

- `.agent-guidelines/cursor-rules.json`, facoltativo: le regole Cursor per cartella. Senza, `base.mdc` contiene tutto `PATTERNS.md` e non ci sono altre regole. Con:

  ```json
  {
    "base": { "description": "Regole base — architettura, naming, workflow", "patterns": ["Stack", "Multi-tenancy"] },
    "rules": [
      { "file": "components.mdc", "description": "Regole per i componenti SolidJS", "globs": "frontend/src/components/**/*.jsx", "sections": ["Componenti SolidJS"] }
    ]
  }
  ```

  ogni regola diventa `.cursor/rules/<file>` con i suoi `globs` e le sezioni `## ` di `PATTERNS.md` elencate, intere. `base.patterns` dice quali sezioni entrano anche in `base.mdc`, che contiene sempre CORE e WORKFLOW; un elenco vuoto non ne mette nessuna. Una sezione rinominata in `PATTERNS.md` e non aggiornata qui fa fallire il `sync`. Una regola tolta dall'elenco viene rimossa al `sync` successivo. Le altre regole in `.cursor/rules/` che non vengono da qui restano del progetto.

**Il lock** serve a due cose. Mostra quale versione ha generato i file, e `sync --check` segnala quando il pacchetto è stato aggiornato senza rilanciare il `sync`. Elenca anche i file gestiti, così quando una versione nuova smette di fornirne uno il `sync` lo rimuove dal progetto. I file che non sono mai stati nel lock non vengono mai toccati.

Ogni percorso gestito appartiene al pacchetto: il `sync` lo sovrascrive. La CI del pacchetto è `.github/workflows/agent-harness.yml`, con solo i suoi controlli. Lint, build e test stanno in un workflow del progetto, che conosce lo stack (per esempio `ci.yml`).

**File ceduti al progetto.** Quando una versione smette di gestire un file che il progetto deve tenere, lo elenca in `assets/handed-over.json`: il `sync` lo toglie dal lock senza cancellarlo, e da lì in poi è del progetto. Con la 0.2.0 sono `ci.yml` e gli hook di `.husky/`.

`sync --check` controlla anche che `npx openspec` nel progetto trovi la stessa versione di OpenSpec del pacchetto: è quella che usano gli agenti e i comandi del WORKFLOW.

## Gli altri comandi

| Comando | Chi lo usa |
| --- | --- |
| `agent-harness hook pre-commit` | `.husky/pre-commit`: niente commit su `main` e `develop`, file sotto i 500KB, file gestiti allineati e in staging, e sui branch `ai/` nessun file protetto |
| `agent-harness hook pre-push` | `.husky/pre-push`: niente push su `main` e `develop`, anche con `git push origin HEAD:main` da un altro branch |
| `agent-harness hook commit-msg <file>` | `.husky/commit-msg`: Conventional Commits con le regole del pacchetto |
| `agent-harness commitlint --from <sha> --to <sha>` | CI: messaggi di tutti i commit della PR |
| `agent-harness check-flow <branch> <base> <head>` | CI: flusso OpenSpec in base al prefisso del branch |
| `agent-harness openspec <argomenti>` | CI: la CLI OpenSpec nella versione del pacchetto |

## Cosa serve nel progetto

- `@aimha/agent-harness` come devDependency, con versione esatta.
- `husky` come devDependency e `"prepare": "husky"` negli script: è Husky che attiva gli hook a ogni `npm ci` o `npm install`. Gli hook in `.husky/` sono del progetto: ognuno chiama per primo il pacchetto (`npx --no -- agent-harness hook pre-commit`, `hook pre-push "$@"`, `hook commit-msg "$1"`) e poi i controlli propri.
- `.nvmrc` nella radice: la CI del pacchetto prende da lì la versione di Node. `sync --check` segnala se manca.
- Niente OpenSpec né commitlint tra le dipendenze del progetto: arrivano con il pacchetto, e una versione diversa nel progetto prenderebbe il posto di quella pinnata. `sync --check` lo segnala.

## Aggiornare OpenSpec o il profilo

1. Cambiare la versione esatta di `@fission-ai/openspec` in `package.json` (release di almeno 5 giorni), oppure i workflow in `assets/openspec/profile.json`.
2. `npm install`, poi `npm run openspec-assets`: rigenera `/opsx-*` e le skill `openspec-*` in `assets/files/.opencode/` e `assets/files/.cursor/`, con una configurazione OpenSpec temporanea, senza toccare quella globale.
3. `npm test`: un test fallisce se gli asset non corrispondono alla CLI pinnata.

## Aggiornare un progetto

```bash
npm i -D -E github:aimha/agent-harness#v0.2.0   # la versione nuova
npx agent-harness sync
git add -A && git commit -m "chore(deps): update agent-harness to 0.2.0"
```

Il diff della PR mostra esattamente cosa cambia per gli agenti e per la CI del progetto: regole, permessi, comandi, hook.

## Rilasciare una versione

1. PR che porta `version` in `package.json` alla versione nuova, con `npm install --package-lock-only` per allineare il lockfile.
2. Merge su `main` con la CI verde.
3. Tag sul commit di merge: `git tag v0.2.0 && git push origin v0.2.0`. La CI controlla che il tag corrisponda a `package.json` e rilancia i test.
4. I progetti si aggiornano quando vogliono, uno per uno, con la procedura sopra.

Il numero di versione segue [semver](https://semver.org/lang/it/): una versione che obbliga i progetti a cambiare qualcosa oltre al `sync` (per esempio un file da rinominare) è una major.

## Passi di costruzione

1. Struttura del repo e contenuti copiati dal template
2. `sync` e `sync --check`
3. Comandi eseguiti dal pacchetto: hook, controllo del flusso, commitlint, OpenSpec
4. Test e CI del pacchetto, versione `0.1.0` ← questo stato
5. Il template passa a usare il pacchetto
