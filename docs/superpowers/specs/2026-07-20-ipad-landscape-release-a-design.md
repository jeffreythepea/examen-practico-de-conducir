# Intentional iPad Landscape and Release A Closure Design

**Status:** Approved in conversation and written-spec review

## Goal

Make the existing acceptable iPad landscape experience intentional and less
scroll-heavy without redesigning the game, then record the completed physical
offline-iPad acceptance as Release A complete.

## Scope

This is a lightweight responsive-layout pass. It does not change command
selection, scoring, surfaces, audio, persistence, offline behavior, or any
stable command/action/phrasing IDs.

The implementation will:

- widen the application shell only on landscape viewports at least 900px wide;
- retain the current two-column setup form while allowing it to use the wider
  shell;
- add one shared landscape gameplay grid used by prompt and reveal screens;
- place prompt instructions and actions beside the response surface;
- place the revealed response surface beside explanations, optional diagnosis,
  and Continue;
- cap response-surface size by viewport height so ordinary iPad landscape
  gameplay does not require scrolling merely because the shell is narrow;
- preserve the current stacked portrait and narrow-window layout unchanged.

## Alternatives Considered

### Widen the shell only

This removes excess side gutters but leaves gameplay vertically stacked, so it
does not address the principal scrolling complaint.

### Shared two-column gameplay layout — selected

This introduces one small markup boundary and one landscape media-query block.
It improves both width use and vertical fit without knowing or specializing
for individual response-surface families.

### Custom layout per response-surface family

This could optimize every diagram independently but would create substantially
more CSS, testing, and regression risk than the current issue warrants.

## Layout Structure

The setup screen retains its existing markup.

Prompt screens gain a `gameplay-layout prompt-layout` wrapper containing:

1. `gameplay-copy`, with the title, listening instruction, audio-ready status,
   Replay, Show Spanish, the optional Spanish hint, and surface-error recovery;
2. `gameplay-surface`, containing the existing rendered response surface.

Reveal screens keep progress and outcome above a
`gameplay-layout reveal-layout` wrapper containing:

1. `gameplay-surface`, containing the existing revealed response surface;
2. `gameplay-feedback`, containing answer details, optional miss diagnosis, and
   Continue.

At widths below 900px or outside landscape orientation, `gameplay-layout`
remains a normal single-column block. No visual reordering is applied to the
accessible DOM sequence.

At landscape widths of at least 900px:

- `#app` uses `width: min(100%, 1180px)`;
- gameplay grids use two columns with a bounded text/control column and a
  flexible response-surface column;
- prompt surfaces appear on the right;
- reveal surfaces appear on the left and feedback on the right;
- surfaces retain their existing aspect ratios and target coordinates;
- surface width remains capped by available viewport height;
- safe-area padding and 44px touch minimums remain unchanged.

If content such as a long incorrect-answer diagnosis still exceeds the
viewport height, normal page scrolling remains available. The design avoids
forced clipping or nested scrolling.

## Accessibility and Localization

The change adds no interface copy. Existing English and Spanish strings remain
unchanged. Heading, status, action, and surface DOM order remains logical for
screen readers. Focus management, touch targets, reduced-motion behavior, and
the bilingual AI-voice disclosure remain unchanged.

## Verification

Implementation is test-driven:

- source tests require the shared prompt and reveal layout wrappers;
- CSS tests require the wider landscape shell, two-column grids, and viewport-
  height surface cap inside the existing landscape breakpoint;
- portrait behavior remains covered by the absence of global grid rules;
- the complete `npm test` and `npm run release:check` gates must pass;
- browser inspection uses a representative 1194×834 landscape-iPad viewport
  and checks setup, prompt, correct reveal, and incorrect reveal;
- Jeffrey performs the final physical-iPad layout confirmation before Release A
  documentation is marked complete.

## Release A Bookkeeping

After Jeffrey approves the physical layout, update the active release-review
documents to record that all manual offline-iPad checks passed. The record will
include fresh installation, offline-package download, Airplane Mode cold
launch, 15-command Mixed practice, recorded audio and photographs, interrupted
session resume, update recovery, backup transfer, bilingual UI, touch targets,
and feedback sounds.

Historical changelog sections and superseded implementation ledgers remain
historical. Current status documents will no longer describe public deployment
or physical iPad acceptance as pending.

## Explicit Non-Goals

- locking iPadOS orientation beyond the existing manifest preference;
- native iPad conversion;
- per-surface visual redesign;
- new commands, audio, scoring, or practice modes;
- eliminating all possible scrolling on unusually verbose reveal screens;
- changing the accepted portrait layout.
