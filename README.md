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
| `assets/files/` | File copiati nel progetto allo stesso percorso: comandi e skill OpenCode, CI |
| `assets/opencode/permissions.json` | Permessi di base di OpenCode, composti con quelli del progetto |
| `assets/openspec/profile.json` | Workflow OpenSpec attivi |

## Due modi di arrivare nei progetti

- **Copiati** da `agent-harness sync`: i file che gli strumenti cercano in un percorso fisso (`AGENTS.md`, `.opencode/`, `opencode.json`, la CI). Ogni copia porta la versione del pacchetto, e `sync --check` in CI fallisce se qualcuno la modifica a mano.
- **Eseguiti dal pacchetto**: hook, controllo del flusso, configurazione di commitlint. Nel progetto resta solo una riga che li richiama, e si aggiornano con la versione.

Il progetto tiene i file suoi, che il `sync` non tocca: `PATTERNS.md`, le aggiunte locali alle regole e ai permessi, glossario, ADR e spec.

## Passi di costruzione

1. Struttura del repo e contenuti copiati dal template ← questo stato
2. `sync` e `sync --check`
3. Comandi eseguiti dal pacchetto: hook, controllo del flusso, aggiornamento OpenSpec, preset commitlint
4. Test e CI del pacchetto, poi tag `v0.1.0`
5. Il template passa a usare il pacchetto
