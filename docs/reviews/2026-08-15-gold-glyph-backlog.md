# Gold-Glyph Replacement Backlog

**Audit date:** 2026-08-15
**Audit command:** `npm run audit:gold-glyph`
**Scope:** Active route-backed driving commands across deterministic seeds
0–99.

The audit groups work by stable command and scene/result pair. Phrasings and
generated seeds do not create duplicate asset work.

| Command | Action | Surface | Scene/result pair | Required motion | Proposed clip reuse | Asset status | Jeffrey review |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `c-incorp` | `join-traffic` | `join-traffic-v1` | `join-traffic-photo-v1` / `join-traffic` | Leave the right curb, merge into the correct travel lane, continue away | `join-traffic-merge-v1` | Production asset registered | Approved 2026-08-15 |
| `c-sentido` | `change-direction` | `u-turn-v1` | `u-turn-photo-v1` / `change-direction` | Use the broad left-side junction to reverse direction and depart in the correct lane | `regular-u-turn-v1` | Production asset registered | Approved 2026-08-15 |

Inactive `c-rot4` and `c-rot5` remain resolvable for saved-session
compatibility but are excluded from this active normal-path backlog. The
The audit now reports zero active consumers. The obsolete animated glyph
implementation was removed after `npm run audit:gold-glyph -- --check`
succeeded; non-playable and historical paths retain the static-route fallback.
