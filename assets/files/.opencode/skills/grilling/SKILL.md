---
name: grilling
description: Interview the user relentlessly about a plan, decision, or idea, one decision at a time, until every branch of the design tree is resolved. Use for step 1 (analysis) of the OpenSpec flow, or when the user wants to stress-test their thinking or uses any 'grill' trigger phrase.
metadata:
  upstream: mattpocock/skills@49dd158d1076134a641b33efb035946536778336 (skills/productivity/grilling)
  local-changes: one question per round; questions in the user's language; output feeds an OpenSpec change
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet.

**Ask exactly one question per round.** From the frontier, pick the decision that unblocks the most of the remaining tree. Give your recommended answer, then wait for the user's answer before the next round. Mention how many questions are still open on the frontier, without listing them.

Format a round like so:

```
❓ **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

(<n> other open questions on the frontier)
```

Word each question so "yes" accepts your recommended answer. Ask in the language the user writes in.

Each answer reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (code, specs in `openspec/specs/`, configuration), look it up yourself before asking, using a sub-agent if the search is broad. Don't ask the user for anything you could look up yourself. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.

When the session is done, close with a short summary of the settled decisions, grouped by branch of the tree. It is the input for `/opsx-new` and `/opsx-continue`. Do not create OpenSpec artifacts and do not write code.
