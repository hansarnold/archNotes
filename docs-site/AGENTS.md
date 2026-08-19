# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Selected product direction

- This is a documentation website, not an experiment dashboard, learning-progress app, or generic SaaS workspace.
- The selected visual target is the third VitePress Product Reference mock at `/home/hans/.codex/generated_images/01a017f7-8a79-73b1-964f-1080ccfed18d/exec-341a8afc-4920-4bef-b713-88ea43fc965c.png`.
- Use the official VitePress default theme rather than a custom visual theme. Product navigation, path-specific sidebars, outlines, search, appearance switching, code blocks, callouts, and badges should use VitePress's built-in components and configuration.
- Organize top-level navigation by architecture family, and show only the relevant product's pages in the sidebar where possible.
- Core interactions: documentation navigation, command-style search, theme switching, responsive mobile navigation, and in-page anchors.
- The implementation now uses VitePress. Files under `../notes/`, `../sources/`, and lab READMEs are the canonical content; `scripts/sync-notes.mjs` generates the VitePress content tree.
- Do not reintroduce custom fonts, theme color overrides, bespoke page chrome, or a custom layout wrapper unless the user explicitly changes direction.
- Do not classify notes with a single mixed taxonomy. The sidebar groups documents by role (orientation, architecture monograph, mechanism study, comparative/system study, experiment), while the topic matrix cross-indexes them by system layer and architecture family.
- Every generated page must visibly identify its product(s), document type, and technical topics using the shared page-context treatment. Product attribution must be explicit in navigation labels when a short title would otherwise be ambiguous.
- Do not edit generated files under `content/notes`, `content/sources`, or `content/labs`; update the canonical Markdown sources instead.
