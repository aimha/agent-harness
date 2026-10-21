# GLOSSARY.md Format

## Structure

The glossary is written in Italian, like the rest of the documentation. Each term carries the identifier used in the code, which is in English.

```md
# Glossario di dominio

{Una o due frasi su cosa copre il progetto e perché esiste.}

## Linguaggio

**Ordine** (`Order`):
Una richiesta di acquisto confermata da un cliente.
_Evitare_: acquisto, transazione

**Fattura** (`Invoice`):
Una richiesta di pagamento inviata al cliente dopo la consegna.
_Evitare_: conto, richiesta di pagamento

**Cliente** (`Customer`):
Una persona o organizzazione che effettua ordini.
_Evitare_: utente, account
```

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others under `_Evitare_`.
- **One code identifier per term.** The identifier in backticks is the name used for the matching type, class, or module in the code. If the code uses a different name, surface the conflict instead of recording both.
- **Keep definitions tight.** One or two sentences max. Define what it IS, not what it does.
- **Only include terms specific to this project's context.** General programming concepts (timeouts, error types, utility patterns) don't belong even if the project uses them extensively. Before adding a term, ask: is this a concept unique to this context, or a general programming concept? Only the former belongs.
- **Group terms under subheadings** when natural clusters emerge. If all terms belong to a single cohesive area, a flat list is fine.
- **Replace the template placeholder.** When the first term is added, remove the `<!-- PROJECT: ... -->` comment.
