# Setup Copy Clarity Design

**Date:** 2026-07-19
**Status:** Approved and implemented; visual review pending

## Goal

Make two setup choices understandable without requiring knowledge of the
training scheduler or inferring why the Show Spanish button is absent.

## Approved Copy

Replace the English practice-order option `Weak and due first` with:

- `Previously missed questions`

Replace its Spanish equivalent with:

- `Preguntas falladas anteriormente`

Replace the English written-Spanish option `Never shown` with:

- `No Spanish text or Show Spanish button`

Replace its Spanish equivalent with:

- `Sin texto en español ni botón Mostrar español`

## Behavior

This is a copy-only cleanup. Stable setting values, persistence, backups,
question-selection logic, scoring, and Show Spanish visibility behavior remain
unchanged. Selecting the unavailable written-Spanish option continues to hide
the Show Spanish button. The practice-order option continues to use the
existing `weakest-first` scheduler.

## Testing

Localization tests will require the exact English and Spanish strings. The full
repository test suite and `git diff --check` remain the release gates.

## Scope Boundary

This change does not add a disabled hint button, alter scheduler behavior,
change defaults, or rewrite existing saved settings.
