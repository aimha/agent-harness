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
| `assets/guidelines/` | `CORE.md` e `WORKFLOW.md`, composti con il `PATTERNS.md` del progetto in `AGENTS.md`, `CLAUDE.md` e regole Cursor |
| `lib/sync.js` | Composizione, scrittura e controllo dei file gestiti |
| `assets/files/` | File copiati nel progetto allo stesso percorso: comandi e skill OpenCode, configurazione OpenSpec, CI |
| `assets/opencode/permissions.json` | Permessi di base di OpenCode, composti con quelli del progetto |
| `assets/openspec/profile.json` | Workflow OpenSpec attivi |

## Due modi di arrivare nei progetti

- **Copiati** da `agent-harness sync`: i file che gli strumenti cercano in un percorso fisso (`AGENTS.md`, `.opencode/`, `opencode.json`, la CI). Ogni copia porta la versione del pacchetto, e `sync --check` in CI fallisce se qualcuno la modifica a mano.
- **Eseguiti dal pacchetto**: hook, controllo del flusso, configurazione di commitlint. Nel progetto resta solo una riga che li richiama, e si aggiornano con la versione.

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

## Passi di costruzione

1. Struttura del repo e contenuti copiati dal template
2. `sync` e `sync --check` ← questo stato
3. Comandi eseguiti dal pacchetto: hook, controllo del flusso, aggiornamento OpenSpec, preset commitlint
4. Test e CI del pacchetto, poi tag `v0.1.0`
5. Il template passa a usare il pacchetto
