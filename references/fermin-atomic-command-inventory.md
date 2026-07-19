# Fermín practical-test atomic command inventory

## Purpose and status

This is the implementation reference for the atomic Garage exam corpus shipped
in v0.24. It was produced by visually reviewing pages 3–6 of the local PDF, not
solely from text extraction. It does not claim that the guide is exhaustive or
that source-derived wording is an exact DGT examiner quotation.

- **Source:** *20200303 Fermin - Practical Driving Test Student Guide.pdf*
- **Publisher/date:** Autoescuela Fermín, 2020
- **PDF SHA-256:** `9dc80c298db1e3c5f7566e7dbb69abf500f15a39d0b9acab0d19dfba9c4f615b`
- **Repository policy:** the copyrighted PDF is not committed. Verify a local
  copy against the checksum when the original layout must be inspected.
- **Wording policy:** `verbatim` reproduces a complete source phrase or
  terminology fragment. `source-derived` converts a grouped/infinitive source
  item into a natural atomic *usted* prompt; it must not be presented as a
  verbatim examiner quote.
- **Validation policy:** every physical location or procedure remains
  instructor/vehicle-unverified until Fermín confirms the training/test car and
  expected response.

## Source discrepancies requiring care

1. **Page 3, reservoir B:** Spanish says `Liquido de frenos`; English says
   `Windscreen wiper fluid`. The B marker is placed at a yellow-capped reservoir
   consistent with washer fluid, but the diagram alone is not sufficient
   authority. Withhold this atomic card until Fermín confirms the intended
   component.
2. **Page 4, lights:** Spanish lists `largo alcance, niebla delantera o trasera`.
   English additionally says `position lights`. The atomic inventory follows
   the Spanish list and does not add a position-light card without confirmation.
3. **Page 4, fuel/temperature:** Spanish joins the alternatives with `o`; the
   English translation uses `and`. They remain separate atomic prompts because
   either display may be requested independently.

## Yaris schematic provenance

The provisional Stage 2 precheck diagrams are manual-derived original schematics,
not copies of Toyota artwork or page layouts. They use the confirmed vehicle
baseline, Toyota Yaris Hybrid 2019, and official owner-manual publication
`PZ49X-52A96-EN` (`PZ49X-52A96-EN.pdf`, SHA-256
`6627e19c6dc8efee4aa1e24d8dad08594fa3a63eb62e7e437fc0d7778105b287`). The
copyrighted manual remains local and is not committed.

| Stable diagram | Manual evidence inspected visually | Stable hotspots |
|---|---|---|
| `yaris-dashboard-v2` | Monochrome and color instrument displays, pages 130 and 133-134; headlight/high-beam controls, pages 270-271; fog controls, pages 276-277 | `fuel-gauge`, `temperature-gauge`, `high-beam`, `front-fog`, `rear-fog` |
| `yaris-climate-v2` | Automatic climate panel and defogger operation, pages 434-435 and 438 | `front-demist`, `rear-demist` |
| `yaris-door-v2` | Driver-door power-window and window-lock controls, page 230 | `window-lock` |
| `yaris-body-v2` | Back-door opener, page 178; hood release, page 481; 12 V battery under the rear-right seat, page 493 | `boot-release`, `bonnet-release`, `battery-under-rear-right-seat` |
| `yaris-engine-bay-v2` | Engine overview and oil/coolant checks, pages 485-486 and 489 | `engine-oil`, `coolant` |

Pages 485-486 and 489 place the oil dipstick and the engine and power-control-unit
coolant reservoirs in the engine compartment. Page 493 places the 12 V battery
under the rear-right seat, so the battery must never appear in the engine-bay
diagram.

The manual documents different instrument displays: the color display includes
an engine coolant temperature gauge, while the monochrome version uses an
over-temperature warning. The front fog lights and their combined stalk ring are
shown only **if equipped**; pages 276-277 also show a rear-only switch. The rear
demister may additionally operate mirror defoggers on equipped vehicles. These
variants are flagged in model provenance and must be confirmed against the
actual test car instead of guessed.

Actual-vehicle photographs may later replace schematic backgrounds while
retaining every stable diagram and hotspot ID, so response history and
provenance remain comparable.

## Atomic precheck inventory (15 variants)

These 15 variants replace the seven grouped precheck cards in v0.23. Existing
IDs are retained only where the existing card is already atomic. Histories for
ambiguous grouped cards must not be assigned arbitrarily to one child variant.

| Proposed stable ID | Page | Exact source text | Natural drill wording | Response type | Status / migration |
|---|---:|---|---|---|---|
| `c-pre-bateria` | 3 | `Localizar: Batería, Liquido de frenos, Nivel de aceite y Nivel de líquido refrigerante` | `Localice la batería` | component location | `source-derived`; new ID |
| `c-pre-deposito-b` | 3 | same grouped line | **Pending Fermín confirmation; do not seed** | component location | blocked by brake-fluid/washer-fluid conflict |
| `c-pre-aceite` | 3 | same grouped line | `Localice dónde se comprueba el nivel de aceite` | component/check location | `source-derived`; new ID |
| `c-pre-refrigerante` | 3 | same grouped line | `Localice dónde se comprueba el nivel de líquido refrigerante` | component/check location | `source-derived`; new ID |
| `c-pre-capo` | 4 | `Abrir el capo y decir qué niveles se deben revisar` | `Abra el capó y diga qué niveles se deben revisar` | multi-step demonstration/explanation | `source-derived`; preserve existing ID |
| `c-pre-combustible` | 4 | `Dónde comprobar nivel combustible o temperatura motor` | `Indique dónde se comprueba el nivel de combustible` | dashboard location | `source-derived`; new split ID |
| `c-pre-temperatura` | 4 | same grouped line | `Indique dónde se comprueba la temperatura del motor` | dashboard location | `source-derived`; new split ID |
| `c-pre-maletero` | 4 | `Abrir el maletero` | `Abra el maletero` | physical demonstration | `source-derived`; preserve existing ID |
| `c-pre-bloquear-elevalunas` | 4 | `Bloqueo o desbloqueo infantil de elevalunas traseros` | `Active el bloqueo infantil de los elevalunas traseros` | control operation | `source-derived`; new split ID |
| `c-pre-desbloquear-elevalunas` | 4 | same grouped line | `Desactive el bloqueo infantil de los elevalunas traseros` | control operation | `source-derived`; new split ID |
| `c-pre-largo-alcance` | 4 | `Encender cualquier luz: largo alcance, niebla delantera o trasera` | `Encienda las luces de largo alcance` | control operation | `source-derived`; new split ID |
| `c-pre-niebla-delantera` | 4 | same grouped line | `Encienda las luces antiniebla delanteras` | control operation | `source-derived`; new split ID |
| `c-pre-niebla-trasera` | 4 | same grouped line | `Encienda la luz antiniebla trasera` | control operation | `source-derived`; new split ID |
| `c-pre-desempanar-delantera` | 4 | `Cómo desempañar la luna delantera o trasera` | `Indique cómo desempañar la luna delantera` | control operation/explanation | `source-derived`; new split ID |
| `c-pre-desempanar-trasera` | 4 | same grouped line | `Indique cómo desempañar la luna trasera` | control operation/explanation | `source-derived`; new split ID |

Retire the grouped IDs `c-pre-ext`, `c-pre-indicadores`, `c-pre-bloqueo`,
`c-luces`, and `c-pre-desempanar`. Preserve their historical log entries, but
do not transfer their FSRS state to an arbitrary child command.

## Atomic driving inventory (16 variants)

The current driving corpus is already atomic. This table records its source
classification so implementation does not need the PDF.

| Stable ID | Page | Exact source text | Drill wording | Response type | Wording status |
|---|---:|---|---|---|---|
| `c-rot1` | 5 | `Tome la primera (segunda, tercera) salida en la glorieta` | `Tome la primera salida en la glorieta` | spoken direction | `source-derived` expansion |
| `c-rot2` | 5 | same grouped line | `Tome la segunda salida en la glorieta` | spoken direction | `source-derived` expansion |
| `c-rot3` | 5 | same grouped line | `Tome la tercera salida en la glorieta` | spoken direction | `source-derived` expansion |
| `c-der` | 5 | `Gire a la derecha (o izquierda) cuando pueda` | `Gire a la derecha cuando pueda` | spoken direction | `source-derived` expansion |
| `c-izq` | 5 | same grouped line | `Gire a la izquierda cuando pueda` | spoken direction | `source-derived` expansion |
| `c-parada` | 5 | `Realice una parada (o estacionamiento)` | `Realice una parada` | spoken maneuver | `source-derived` expansion |
| `c-est` | 5 | same grouped line | `Realice un estacionamiento` | spoken maneuver | `source-derived` expansion; preserve ID |
| `c-inmov` | 5 | `Inmovilice el vehículo` | same | spoken multi-step maneuver | `verbatim` |
| `c-final` | 5 | `Finalización del examen` | same | exam-state recognition | `verbatim` heading; spoken use unverified |
| `c-rot4` | 6 | `Primera (segunda, tercera, cuarta, quinta) salida` | `Cuarta salida` | terminology/direction recognition | `source-derived` expansion; preserve ID |
| `c-rot5` | 6 | same grouped line | `Quinta salida` | terminology/direction recognition | `source-derived` expansion |
| `c-sentido` | 6 | `Cambio de sentido` | same | terminology/maneuver recognition | `verbatim`; preserve ID |
| `c-detencion` | 6 | `Detención` | same | terminology recognition | `verbatim` |
| `c-adel` | 6 | `Adelantamiento` | same | terminology/maneuver recognition | `verbatim`; preserve ID |
| `c-adapte` | 6 | `Adapte la velocidad a la vía` | same | spoken speed instruction | `verbatim` |
| `c-volante` | 6 | `Volante recto` | same | terminology/control instruction | `verbatim` |

The page 6 terms `Parada` and `Estacionamiento` do not create extra cards: the
page 5 complete variants already test those concepts. Likewise exits 1–3 are
represented by their complete page 5 instructions rather than duplicate
terminology cards.

## Excluded procedural statements

The four informational statements on page 5 remain study notes rather than
audio-response cards:

- `El examinador guiará el recorrido`
- `Los primeros 10 minutos pueden ser libres`
- `En caso de la existencia de señales de indicación nos indicará por ellas`
- `En caso de no decir nada deberemos continuar de frente`

They describe how the test is conducted; they are not requests requiring an
immediate candidate response. If added later, they should use a separate
exam-orientation activity rather than command FSRS grading.

## Implementation count

- 16 driving variants
- 15 precheck variants, including one blocked reservoir term
- 31 total inventory entries
- 30 safe to seed before Fermín resolves the page 3 discrepancy
