# Release B: Examen Práctico de Conducir - Domain Foundation Implementation

## Summary

This implementation completes Tasks 1-4 of Release B for the Examen Práctico de Conducir application, building the additive, pure domain foundation for:
1. Readiness tracking
2. Targeted practice selection
3. Coverage-aware variant selection
4. Lesson flag management

All implementation follows test-driven development with pure functions, immutable returns, and injected dependencies for testability.

## Files Created

### Core Implementation
- `src/readiness.js` - Readiness state computation per command ID
- `src/practice-selection.js` - Practice session command selection logic
- `src/variant-coverage.js` - Coverage-aware audio variant selection
- `src/lesson-flags.js` - Lesson flag creation and management

### Test Suites
- `tests/readiness.test.js` - 29 tests covering readiness states
- `tests/practice-selection.test.js` - 36 tests covering selection algorithms
- `tests/variant-coverage.test.js` - 11 tests covering variant selection
- `tests/lesson-flags.test.js` - 32 tests covering flag lifecycle

## Implementation Details

### 1. Readiness Module (`src/readiness.js`)
**Exports:**
- `READINESS_STATES` - ['not-tested', 'needs-practice', 'in-progress', 'ready']
- `readinessForCommand(command, attempts, flags, now)` - Computes readiness for single command
- `readinessForCatalog(catalog, attempts, flags, now)` - Computes readiness for all commands

**Readiness Logic:**
- **not-tested**: No scored attempts
- **needs-practice**: Latest scored attempt was incorrect or assisted
- **in-progress**: Has unaided successes but doesn't meet ready criteria
- **ready**: Requires unaided success on 3 distinct UTC dates AND both latest attempts unaided

**Returns Frozen Record:**
```javascript
{
  state: 'not-tested' | 'needs-practice' | 'in-progress' | 'ready',
  recentOutcomes: Array<{outcome: 'unaided'|'assisted'|'incorrect', timestamp: number}> (max 5, newest first),
  lastPracticedAt: number | null,
  averageResponseMs: number | null,
  replayCount: number,
  hintCount: number,
  openLessonFlagCount: number,
  nextDueAt: number | null
}
```

### 2. Practice Selection Module (`src/practice-selection.js`)
**Exports:**
- `selectPracticeCommands(commands, {phase, length, target, attempts, flags, now, rng})`

**Selection Logic:**
1. **Phase Filtering**: Filters commands by phase ('driving', 'maneuvers', 'precheck', 'mixed') FIRST
2. **Target Selection**: Applies target filter to phase-filtered commands:
   - 'recommended': Orders by priority (unseen → needs-practice → due non-ready → in-progress → ready)
   - 'needs-practice': Only needs-practice commands
   - 'not-tested': Only not-tested commands
   - 'lesson-flags': Commands with open flags
   - 'not-ready': Needs-practice, in-progress, not-tested
   - 'free': All phase-filtered commands
   - 'command': Single specified command (validates phase match)
3. **Length Limiting**: Respects 'short' (5), 'medium' (10), 'all' semantics
4. **Shuffling**: Within equal priority groups using injected RNG
5. **Immutability**: Never mutates inputs, returns frozen array

### 3. Variant Coverage Module (`src/variant-coverage.js`)
**Exports:**
- `selectCoverageAwareVariant(candidates, attempts, rng)`

**Selection Logic:**
- Groups by `commandId + phrasingId + voiceId` (ignores speed for grouping)
- Aggregates exposure across all speeds for each group
- Selects candidate with minimum exposure count
- Uses injected RNG to break ties deterministically
- Returns frozen copy, never mutates inputs
- Throws on empty candidate list

### 4. Lesson Flags Module (`src/lesson-flags.js`)
**Exports:**
- `LESSON_FLAG_CATEGORIES` - ['wording', 'audio', 'visual', 'accepted-action', 'vehicle-control', 'other']
- `LESSON_FLAG_STATUSES` - ['open', 'resolved']
- `validateLessonFlag(flag)` - Returns true or throws
- `createLessonFlag(flags, {commandId, category, note}, deps)` - Returns new frozen array
- `updateLessonFlag(flags, id, changes, deps)` - Returns new frozen array

**Flag Properties:**
- `id`: Cryptographically unique (injected UUID source)
- `commandId`: String (matches command catalog)
- `category`: One of 6 exact categories
- `note`: 1-280 Unicode code points (trimmed for storage/display)
- `createdAt`: Timestamp (immutable)
- `updatedAt`: Timestamp (updated on change)
- `status`: 'open' or 'resolved'

**Constraints:**
- Immutable operations (returns new frozen arrays)
- Strict validation (category, status, note length, timestamps)
- Cannot modify id, commandId, or createdAt via update
- Trim whitespace from notes, validate after trimming

## Test Results

All test suites pass:
- Readiness: 29/29 tests
- Practice Selection: 36/36 tests
- Variant Coverage: 11/11 tests
- Lesson Flags: 32/32 tests
- **Constraints Verification: 406/406 total tests pass (npm test)

## Design Principles Followed

1. **Test-Driven Development**: Wrote comprehensive tests before implementation
2. **Immutability**: All functions return frozen objects/arrays, never mutate inputs
3. **Dependency Injection**: Time (`now`), randomness (`rng`/`randomUUID`), and crypto (`cryptoRef`) injected for testability
4. **Pure Functions**: No side effects, deterministic outputs for given inputs
5. **Strict Validation**: Comprehensive input validation with descriptive errors
6. **Edge Case Handling**: Empty arrays, boundary values, invalid inputs properly handled
7. **Existing Code Compliance**: Follows existing codebase patterns (ESM imports, Object.freeze, etc.)

## Verification

- All new tests pass individually and as part of full test suite
- No existing functionality was modified (per requirements)
- No prohibited files were modified (src/app.js, src/i18n.js, src/training.js, src/active-session.js, src/storage.js, CSS, data/, audio/, scripts/, package.json, lockfiles, docs)
- git status shows only new files as untracked (as expected)
- git diff --check passes (no whitespace violations)

The implementation provides a solid, testable foundation for Release B features while maintaining strict separation of concerns and functional purity.