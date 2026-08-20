# Excalidraw Integration Contract

Read this reference only when implementing or using Excalidraw in archNotes.

Excalidraw is preferred for architecture, comparison, responsibility-boundary, and teaching-oriented diagrams, but it must not bypass the repository's deterministic asset contract.

The accepted repository path is `.excalidraw` source to committed SVG through the local documentation toolchain:

1. Author a complete deterministic scene. Every element must carry fixed IDs, seeds, versions, nonces, timestamps, geometry, style, bindings, and type-specific fields; generated or missing randomness is rejected.
2. Use the exact versions recorded in `docs-site/package.json`, including `@excalidraw/excalidraw` 0.18.1. Do not load Excalidraw, React, fonts, or other render code from a CDN.
3. Run `npm run diagrams` from `docs-site/`. The renderer uses Excalidraw's official local `restore` and `exportToSvg`, embeds the pinned local Excalifont/Xiaolai fonts, adds an opaque canvas, and renders every scene twice to prove byte stability.
4. Commit the matching `.svg`. `npm run diagrams:check` rejects a stale render, unsafe or externally loaded SVG content, a missing positive viewBox, a transparent canvas, a nondeterministic export, or a broken renderer canary.
5. Keep exactly one editable source (`.excalidraw` or `.mmd`) per SVG and add a matching `.diagram.json` contract. New diagrams are full-strict: no baseline exception, passing layout metrics, score at least 85/100, and `outcome: "pass"`.
6. Verify the rendered page at desktop and mobile widths, in light and dark themes, and through the standard zoom dialog. Keep PNG export optional and non-canonical.

Do not copy a third-party Excalidraw skill into this repository unless its redistribution license is explicit. Its visual-argument, semantic-shape, and render-view-fix principles may inform this repository's independently written rules, but the local deterministic renderer remains authoritative.

For inline diagrams, favor one claim and one overview level. Put code, payloads, and detailed evidence in prose or separate detail diagrams when including them would reduce page-size legibility.
