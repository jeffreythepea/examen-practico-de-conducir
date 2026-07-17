# Working agreement

- Tests gate every change. Run `npm test` before asking Jeffrey to review.
- Commands and generated command audio always remain Spanish.
- Every piece of interface copy must exist in both English and Spanish.
- API keys and other credentials never enter Git or browser-delivered files.
- Command provenance and stable command/action/phrasing IDs are invariants.
- Jeffrey reviews, commits, and pushes all changes; collaborators only propose diffs.
- Before release review, run `npm test` and `git diff --check`; verify the bilingual
  AI-voice disclosure remains visible and no provider credential is present in a
  browser-delivered or repository file.
