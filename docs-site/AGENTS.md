# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Selected product direction

- This is a documentation website, not an experiment dashboard, learning-progress app, or generic SaaS workspace.
- The selected visual target is the third VitePress Product Reference mock at `/home/hans/.codex/generated_images/01a017f7-8a79-73b1-964f-1080ccfed18d/exec-341a8afc-4920-4bef-b713-88ea43fc965c.png`.
- Use the official VitePress default theme rather than a custom visual theme. Product navigation, path-specific sidebars, outlines, search, appearance switching, code blocks, callouts, and badges should use VitePress's built-in components and configuration.
- Organize top-level navigation as Home, Hardware Architecture, AI Compiler, and C++ Review. Vendor families belong inside Architecture, not beside learning domains. AI Compiler contains a concept route and a separate MLIR implementation track; each has its own sidebar. C++ exercises belong only to C++ navigation even when their legacy URLs begin with /mlir/. Preserve published URLs and do not re-interleave these domains in reading sequences.
- Core interactions: documentation navigation, command-style search, theme switching, responsive mobile navigation, and in-page anchors.
- The implementation uses VitePress. Files under `../docs/` are the only canonical content; the site reads them directly and must never generate, copy, rewrite, or backfill Markdown during build.
- All body images and diagrams must already exist under `../docs/assets/` and be referenced directly by canonical Markdown. Mermaid authoring sources use `.mmd`; `npm run diagrams` exports the committed SVG before a normal build.
- Do not reintroduce custom fonts, theme color overrides, bespoke page chrome, or a custom layout wrapper unless the user explicitly changes direction.
- Do not classify notes with a single mixed taxonomy. The sidebar groups documents by role (orientation, architecture monograph, mechanism study, comparative/system study, experiment), while the topic matrix cross-indexes them by system layer and architecture family.
- Every page must declare its product(s), document type, and technical topics in committed frontmatter. Product attribution must be explicit in navigation labels when a short title would otherwise be ambiguous.
- Do not create a second content tree under `docs-site/`. Edit only the canonical Markdown and assets under `../docs/`.
- Debugging and review use local VitePress dev/preview only. Pushing a feature branch never authorizes a production deployment.
- Production deployment is allowed only after the change has been merged to `main`. Before deploying, fetch `origin/main`, verify the deployed revision is exactly the merged `origin/main` revision, then build and deploy that revision.
- `README.md` is English-only. Do not add an inline Chinese translation or create `README.zh-CN.md` unless the user explicitly changes this rule.
- The documentation uses Chinese as the root locale and English under `/en/`. Paired pages keep the same relative path below the locale root so the built-in language switch can map them predictably.
- Technical terminology stays in canonical English in both locales. Chinese prose explains an English term but must not replace it with a translated technical label. Preserve official capitalization, acronyms, API names, ISA names, metrics, and vendor terminology.
- `docs/glossary.md` and `docs/en/glossary.md` are the terminology contract. They use the same English term inventory and category structure; only the explanations differ by locale.
- All locale content must be committed Markdown under `docs/`. The Markdown-to-HTML build may render locale files but must never translate, generate, rewrite, or backfill them.
- C++ is a returning-developer review section, not a beginner course. Keep broad, searchable cheat sheets with easily forgotten rules, short original examples, pitfalls, version labels, and self-checks. Four hours is a priority-review route, not a cap on the reference library. Retain the default documentation theme; do not mirror third-party copyrighted articles or graphics.
