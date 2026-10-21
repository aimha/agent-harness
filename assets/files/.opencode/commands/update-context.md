---
description: Aggiorna header e commenti dei file modificati in questa sessione
---

Aggiorna il contesto dei file che hai modificato in questa sessione.

1. Ricava l'elenco dei file modificati con `git diff --name-only main...HEAD` e `git status --porcelain`. Considera solo quelli: non toccare altri file.
2. Escludi i file protetti (lista in AGENTS.md, sezione "File protetti") e i file generati.
3. Per ogni file di codice rimasto, aggiorna l'header secondo la sezione "Header e commenti" di AGENTS.md:
   - aggiorna DEPENDS ON e USED BY se le dipendenze sono cambiate;
   - aggiungi a KEY DECISIONS e GOTCHAS solo ciò che non si capisce leggendo il codice;
   - aggiorna LAST UPDATED solo se la modifica è semanticamente rilevante.
4. Controlla i commenti inline dei metodi e dei gruppi di stato che hai aggiunto o cambiato.
5. Se durante la sessione hai preso una decisione architetturale, non scriverla in AGENTS.md: se c'è un change OpenSpec attivo, segnalala per `design.md`; altrimenti mettila nel summary, in "Domande aperte e suggerimenti".

Al termine elenca i file di cui hai aggiornato header o commenti.
