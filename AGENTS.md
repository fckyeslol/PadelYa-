<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Development process: AIDLC

This project follows the **AI-Driven Development Lifecycle** (AWS AI-DLC, adapted to Claude Code).
For any non-trivial feature, drive it through the phases — **Inception → Construction → Operations** —
crossing each human-approved **gate** and working in small, verifiable units.

Read **`docs/aidlc/README.md`** before planning a feature; it defines the phases, gates, agent map,
templates, and the project's hard-won operational lessons (migration drift, silent-catch,
PostgREST embed ambiguity, duplicated secrets). Per-feature artifacts live in
`docs/aidlc/features/<slug>/` (templates in `docs/aidlc/templates/`).
