# Setup Copy Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace two unclear setup options with the exact approved English and Spanish copy without changing application behavior.

**Architecture:** Update only the existing localization dictionary and its exact-copy tests. Stable setting values continue to drive the existing scheduler and Show Spanish visibility rules.

**Tech Stack:** ES modules, existing bilingual localization dictionary, Node.js test runner

## Global Constraints

- Use exactly `Previously missed questions` and `Preguntas falladas anteriormente` for `mode.weak`.
- Use exactly `No Spanish text or Show Spanish button` and `Sin texto en español ni botón Mostrar español` for `hint.unavailable`.
- Do not change stable setting values, defaults, storage, backups, scheduling, scoring, or button visibility behavior.
- Every interface-copy change must remain symmetric in English and Spanish.
- Jeffrey reviews, commits, and pushes; leave all changes uncommitted.

---

### Task 1: Replace and Verify Setup Copy

**Files:**
- Modify: `tests/i18n.test.js`
- Modify: `src/i18n.js`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: `translate(locale, key, variables)` from `src/i18n.js`
- Produces: revised strings for existing keys `mode.weak` and `hint.unavailable`

- [x] **Step 1: Write failing exact-copy tests**

Update the written-Spanish policy assertions and add practice-order assertions:

```js
assert.equal(translate('en', 'hint.unavailable'), 'No Spanish text or Show Spanish button');
assert.equal(translate('es', 'hint.unavailable'), 'Sin texto en español ni botón Mostrar español');
assert.equal(translate('en', 'mode.weak'), 'Previously missed questions');
assert.equal(translate('es', 'mode.weak'), 'Preguntas falladas anteriormente');
```

- [x] **Step 2: Run the localization test and verify RED**

Run: `node --test tests/i18n.test.js`

Expected: FAIL because the dictionary still returns `Never shown`, `Nunca visible`, `Weak and due first`, and `Primero lo débil y pendiente`.

- [x] **Step 3: Replace the four localization values**

In `src/i18n.js`, use:

```js
// English
'hint.unavailable': 'No Spanish text or Show Spanish button',
'mode.weak': 'Previously missed questions',

// Spanish
'hint.unavailable': 'Sin texto en español ni botón Mostrar español',
'mode.weak': 'Preguntas falladas anteriormente',
```

- [x] **Step 4: Run focused and full verification**

Run:

```bash
node --test tests/i18n.test.js
npm test
git diff --check
```

Expected: localization and full suites PASS; whitespace check is silent.

- [x] **Step 5: Record the uncommitted checkpoint**

Append the exact full-suite total, whitespace result, and remaining Jeffrey review to `.superpowers/sdd/progress.md`. Do not stage, commit, or push.
