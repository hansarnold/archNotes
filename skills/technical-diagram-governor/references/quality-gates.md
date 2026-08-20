# Technical Diagram Quality Gates

Read this reference only when planning a diagram layout, authoring a diagram, or reviewing its rendered result.

## Inline readability

The documentation content column is approximately 609 px wide at a 1280 px desktop viewport. Design for the rendered page rather than an unconstrained canvas.

- Prefer an inline aspect ratio from `0.65` through `2.2`.
- For ratios above `2.2` through `4.0`, split, wrap, or provide an explicit zoom/detail treatment.
- Reject ratios above `4.0` or below `0.5` as inline diagrams.
- Prefer a rendered height from 240 through 720 px. Split diagrams that require more than one viewport to understand.
- Keep text at least approximately 14 px after page scaling. On an approximately 960 px-wide authoring canvas, start at 22-24 px or larger.
- Prefer at most 9 primary nodes and 12 primary relationships in one overview.
- Prefer at most 5 participants in one sequence diagram.
- Keep node labels to two short lines and move explanations into the caption or prose.
- Use color only for stable semantics and never require color alone for comprehension.

Use an overview plus separate detail diagrams when a comprehensive explanation needs more content. Do not combine an overview, source code, payload examples, and every edge case in one inline image.

## Visual grammar

- Architecture: show components, boundaries, ownership, and directed dependencies; exclude detailed time ordering.
- Dataflow or pipeline: show stages, transformations, payload direction, and ownership changes.
- Flowchart: reserve diamonds for decisions and label branches.
- Sequence: advance time consistently and give every participant a clear responsibility.
- State: show legal states and labeled transitions rather than general processing steps.
- Comparison: use aligned small multiples or a matrix with consistent axes.
- Timeline: use one only when relative timing or milestones matter; otherwise use a list.

Shapes, arrows, grouping, and whitespace must communicate structure before labels are read. Avoid uniform card grids, decorative boxes, and unlabeled relationships.

## Page inspection

For every new or materially changed diagram:

1. Render the committed SVG from its editable source.
2. Open the actual documentation page at a 1280 px desktop viewport.
3. Inspect a mobile viewport around 390 px and add zoom, splitting, or an alternate layout when labels become unreadable.
4. Check dark mode when the asset or surrounding treatment is theme-sensitive.
5. Reject clipped text, overlaps, ambiguous labels, incorrect arrow targets, or unclear reading order.
6. Require the main claim to be visible within five seconds.
7. Make alt text and nearby captions explain the purpose or conclusion instead of only repeating the heading.

## Scorecard

Require at least 85 out of 100 and no correctness or legibility blocker:

- necessity: 20;
- technical correctness and evidence: 25;
- readability at the real page size: 20;
- hierarchy and five-second comprehension: 15;
- terminology and visual-semantic consistency: 10;
- accessibility: 5;
- maintainability and deterministic regeneration: 5.

Choose exactly one outcome: pass, revise, split, replace with a table/list, or delete.
