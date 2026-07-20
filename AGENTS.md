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

<!-- context7 -->
Use Context7 MCP to fetch current documentation whenever the user asks about a
library, framework, SDK, API, CLI tool, or cloud service. This includes API
syntax, configuration, version migration, library-specific debugging, setup
instructions, and CLI tool usage. Use whenever the answer is version-specific,
involves a library updated in the last two years, or you have any uncertainty.
Skip only for stable, foundational APIs you are certain about.
Prefer Context7 over web search for library docs. If Context7 cannot resolve a
library or the release is too recent to be indexed, fall back to the official
docs via web fetch.
Do not use for: refactoring, writing scripts from scratch, debugging business
logic, code review, general programming concepts, or unindexed libraries.
