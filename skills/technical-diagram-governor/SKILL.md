---
name: technical-diagram-governor
description: Route, create, edit, and review technical diagrams for archNotes. Use when a task touches architecture diagrams, comparisons, teaching-oriented mental models, Mermaid or Excalidraw sources, rendered diagram SVGs, diagram references in Markdown, or the diagram rendering and validation pipeline. Do not use for ordinary prose, code, UI, or unrelated image work.
---

# Technical Diagram Governor

Choose the representation from semantics, require a clear visual claim, and validate the result in the real documentation page.

## Route before drawing

Use this order:

1. Purely linear steps: use an ordered list or table.
2. Sequence or state semantics: use Mermaid.
3. Simple control flow: use Mermaid.
4. Architecture, comparison, responsibility boundaries, or a teaching mental model: prefer Excalidraw.
5. Render in the page, inspect, score, then pass, revise, split, replace, or delete.

Do not use ImageGen or another raster generator for precise technical diagrams.

## Establish the diagram contract

Before authoring, establish from the request and surrounding document:

- the single claim the diagram must communicate;
- the question, audience, and scope;
- the required entities and relationships;
- the evidence for important technical relationships;
- the diagram type and intended reading order.

If the claim or relationships are unclear, clarify the content instead of guessing a layout. Replace a diagram with prose or a table when it does not make a relationship, boundary, comparison, state change, concurrency pattern, or causal path clearer.

## Author and validate

1. Inspect nearby Markdown, terminology, and existing diagram sources.
2. Preserve the repository's canonical English technical terms.
3. Create or edit the deterministic authoring source and matching SVG.
4. Read [quality-gates.md](references/quality-gates.md) before layout work or visual review.
5. Render and inspect the actual page at desktop and mobile widths.
6. Apply the scorecard and reject correctness or legibility blockers regardless of score.
7. Run the documentation checks required by the affected pipeline.

For Excalidraw work, read [excalidraw-integration.md](references/excalidraw-integration.md) before editing sources or rendered assets. This repository has an accepted, version-pinned local Excalidraw build path; use it instead of a CDN, screenshot, or hand-edited SVG.

## Asset contract

- Keep editable sources and rendered assets under `docs/assets/diagrams/`.
- Use `.mmd` plus matching `.svg` for Mermaid.
- Use `.excalidraw` plus matching `.svg` for Excalidraw diagrams. Keep every scene deterministic and let the local renderer produce the SVG.
- Use PNG only for screenshots or social previews, not as the canonical technical-diagram format.
- Add a matching `.diagram.json` contract with a conclusion-oriented claim, reading order, presentation treatment, passing scorecard, and `outcome: "pass"`.
- Give every Markdown diagram reference a descriptive alt and a distinct, conclusion-oriented image title for the visible caption.

After Mermaid or diagram-reference changes, run from `docs-site/`:

```bash
npm run diagrams
npm run diagrams:lint
npm run test:diagrams
npm run check
npm run build
```

Local rendering does not replace technical fact review. Never invent undocumented hardware behavior, API guarantees, ordering semantics, or performance claims to complete a diagram.
