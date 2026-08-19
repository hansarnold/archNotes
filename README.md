# archNotes

archNotes is a learning repository for AI compute full-stack co-design. It connects model workloads, compiler and runtime mapping, accelerator architecture, software optimization, model–hardware co-design, and performance validation.

The architecture case studies cover NVIDIA GPU, Groq LPU/TSP, Tenstorrent Tensix, and Google TPU. They are used to compare execution models and software contracts rather than to rank peak specifications.

## Documentation

- [Chinese documentation](docs/index.md)
- [English documentation](docs/en/index.md)
- [Curriculum blueprint](docs/en/curriculum.md)
- [Topic matrix](docs/topics.md)
- [Learning roadmap](docs/notes/learning-roadmap.md)
- [Architecture comparison](docs/notes/ai-accelerator-architecture-comparison.md)
- [Glossary](docs/en/glossary.md)
- [Source catalog](docs/sources/catalog.md)

## Content and Publishing Contract

`docs/` is the only canonical content tree. Titles, descriptions, links, body images, and diagrams must be complete in Markdown before the site build starts. `docs-site/` deterministically renders those files and must not generate, translate, rewrite, or backfill content.

Chinese is the root documentation locale and English lives under `docs/en/`. Paired pages use the same relative path below their locale root.

Technical terminology remains in canonical English in both locales. Chinese prose may explain a term, but it does not replace the term with a translated technical label. The two Glossary pages define the shared term inventory.

Diagrams referenced by documentation live under `docs/assets/diagrams/` as committed SVG files. Their editable Mermaid sources use the same file name with the `.mmd` extension. After changing a Mermaid source, export the diagram and commit the Markdown, `.mmd`, and `.svg` together.

## Teaching Labs

```bash
python3 labs/static_scheduler/scheduler.py \
  labs/static_scheduler/programs/vector_add.json

python3 labs/tensix_pipeline/simulator.py \
  labs/tensix_pipeline/programs/eltwise_tiles.json

python3 labs/systolic_array/simulator.py \
  labs/systolic_array/programs/matmul_partial_tile.json

python3 -m unittest discover -s tests -v
```

The labs are simplified models of publicly documented mechanisms. They are not vendor simulators and do not predict wall-clock performance for real hardware.

## Documentation Checks

Run the following commands from `docs-site/`:

```bash
npm run check
npm run build
```

To regenerate committed diagrams after editing Mermaid sources:

```bash
npm run diagrams
```

Production publishing is allowed only after a reviewed change has been merged into `main` and the exact `origin/main` revision has passed the full site build.
