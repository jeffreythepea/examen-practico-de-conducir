# Composite command selection, 2026-07-20

This ledger records how `spanish_driving_exam_commands.json` was used during
the first phrasing expansion. The supplied file has SHA-256
`332a6762b7b5d407d50132d12f763a0e3300f2596dfca8ec67697e4dcf7a614b`.
Its own metadata names the Fermín guide as its source, but many variants are not
present in the Fermín PDF. They are therefore supplementary candidates, not
verbatim Fermín evidence.

## Added atomic commands

| Stable ID | Selected Spanish | Composite location | Reason |
|---|---|---|---|
| `c-recto` | `Siga todo recto` | `route_guidance.rg_04` | common route instruction; existing photographed junction tests left/straight/right |
| `c-intermitente` | `Ponga el intermitente` | `safety_corrections` | frequent, urgent, and maps to a recognizable physical control |
| `c-pre-posicion` | `Encienda las luces de posición` | `pre_check_commands.pc_06` | Fermín says any light; native stalk symbol supports an unambiguous response |
| `c-pre-cruce` | `Encienda las luces de cruce` | `pre_check_commands.pc_06` | everyday light command; native stalk symbol supports an unambiguous response |

Brake fluid and washer fluid are recorded in the Fermín inventory because
their authority is the supplied PDF plus Jeffrey's explicit source decision.

## Added alternative phrasings

One alternative was selected for turns, each roundabout ordinal, change of
direction, stopping, parking, immobilization, exam completion, and six common
prechecks. Each catalog record retains its exact composite location and text.
The selection favors words that change the listening surface without changing
the action: `en la próxima`, short ordinal forms, direct questions, `Aparque`,
and `Ha terminado`.

## Deliberately rejected or deferred

- Ambiguous phrases whose action changes with context: `Adelante`, `Tome esta
  salida`, `La de la izquierda`, and `Ya puede aparcar`.
- Wrong-action mappings inside the composite, including `Siga recto` as a
  variant of `Volante recto` and `Cambie de sentido` as a third-exit synonym.
- Informal forms such as `Haga un U-turn` until the initial variant set is
  useful in practice.
- Safety barks other than the indicator correction. `¡Frene!`, `¡Cuidado!`,
  mirror, shoulder, and lane-position corrections need a fast-response mode.
- All `trick_instructions`; illegal or contradictory requests need an
  instructor-gated design where waiting for a legal opportunity can be correct.
