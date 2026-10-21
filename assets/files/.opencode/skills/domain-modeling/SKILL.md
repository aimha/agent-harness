---
name: domain-modeling
description: Build and sharpen the project's domain model during analysis. Use when discussing domain terminology, writing or editing GLOSSARY.md, or recording or editing an ADR in docs/adr/.
metadata:
  upstream: mattpocock/skills@49dd158d1076134a641b33efb035946536778336 (skills/engineering/domain-modeling)
  local-changes: single context only; Italian terms with code identifier; ADRs only for decisions beyond a single change, reviewed in the spec PR
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the *active* discipline: challenging terms, inventing edge-case scenarios, and writing the glossary and decisions down the moment they crystallise. (Merely *reading* `GLOSSARY.md` for vocabulary is not this skill: that's a one-line habit any skill can do. This skill is for when you're changing the model, not just consuming it.)

## File structure

```
/
├── GLOSSARY.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

The project has a single context and a single `GLOSSARY.md` at the root. Create `docs/adr/` lazily: only when the first ADR is needed.

Both files are written on the `spec/<change-name>` branch and reviewed in the spec PR, together with the OpenSpec change.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `GLOSSARY.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account': do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts. Good scenarios often become OpenSpec scenarios later.

### Cross-reference with code and specs

When the user states how something works, check whether the code and the specs in `openspec/specs/` agree. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"

### Update GLOSSARY.md inline

When a term is resolved, update `GLOSSARY.md` right there. Don't batch these up: capture them as they happen. Use the format in [GLOSSARY-FORMAT.md](./GLOSSARY-FORMAT.md).

`GLOSSARY.md` should be totally devoid of implementation details. Do not treat `GLOSSARY.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

Decisions local to one change belong in that change's `design.md`. Offer an ADR only for decisions that outlive the change, and only when all three are true:

1. **Hard to reverse**: the cost of changing your mind later is meaningful
2. **Surprising without context**: a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).
