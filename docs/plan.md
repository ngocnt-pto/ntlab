# Gõ Mây Implementation Plan

**Goal:** Deliver a polished, lightweight local Vietnamese typing demo with honest trial/Plus previews.
**Architecture:** Buildless HTML, CSS, classic JavaScript; pure core + lesson data + local adapter + DOM controller.
**Spec:** design.md

## Constraints and review focus
- No runtime dependencies, remote fonts, real payments, or fake Google login.
- Handle combining Vietnamese accents, provisional words, deletion, repeat errors, IME boundaries, paste, and extra words.
- Malformed or unavailable storage must not break practice; paid preview must be reversible and explicitly local.
- Prevent duplicate completion history, timer inflation in hidden tabs, locked-lesson bypass through selectors, and inaccessible dialogs.

## Tasks
1. Write failing behavior tests; implement normalized word evaluation, mistake tracking, metrics, storage recovery, and lesson access.
2. Implement static UI, original SVG illustrations, animated progress, lesson selection, keyboard feedback, settings and responsive styles.
3. Wire practice, timer, IME/paste behavior, results, roadmap, progress, and reversible Plus/account dialogs through the local adapter.
4. Add loopback server, Windows launcher and usage/Firebase integration documentation; run tests and browser QA; fix observed failures.

## Execution ledger
- Repository starts empty and is not a Git checkout; work directly in the supplied writable workspace. No commits/worktrees apply.
- User explicitly requested implementation now; proceed with the established design and record it here instead of another approval round.
- Skills applied: Sites (local-only path), writing-plans, executing-plans, test-driven-development, verification-before-completion.
