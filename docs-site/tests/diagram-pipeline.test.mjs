import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createMarkdownRenderer, disposeMdItInstance } from "vitepress";
import {
  collectMarkdownDiagramCandidates,
  validateVisibleDiagramCaption,
} from "../scripts/diagram-markdown-references.mjs";
import {
  classifyDiagramIssue,
  validateDiagramScorecard,
  validateExcalidrawScene,
  validateMermaidSourceSafety,
  validateQualityBaselinePolicy,
  validateRenderedExcalidrawSvg,
} from "../scripts/diagram-pipeline.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(siteRoot, "..");
const fixturePath = path.join(siteRoot, "tests", "fixtures", "diagrams", "deterministic.excalidraw");
const validScene = () => JSON.parse(readFileSync(fixturePath, "utf8"));
const passingScorecard = () => ({
  necessity: 20,
  technicalCorrectness: 25,
  readability: 20,
  hierarchy: 15,
  terminology: 10,
  accessibility: 5,
  maintainability: 5,
  total: 100,
});
const VALID_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" font-size="20"><rect data-diagram-background="true" x="0" y="0" width="100%" height="100%" fill="#ffffff" aria-hidden="true"></rect><defs><style>@font-face { font-family: Excalifont; src: url(data:font/woff2;base64,AA==); }</style></defs><text x="20" y="40" font-family="Excalifont" font-size="20px">Alpha to Beta</text></svg>\n';

test("accepts a complete deterministic Excalidraw scene", () => {
  assert.deepEqual(validateExcalidrawScene(validScene()), []);
});

test("rejects incomplete elements and missing random-state fields", () => {
  const scene = validScene();
  delete scene.elements[0].strokeColor;
  delete scene.elements[0].seed;
  delete scene.elements[0].versionNonce;
  delete scene.elements[0].updated;
  const message = validateExcalidrawScene(scene).join("\n");

  assert.match(message, /missing deterministic fields: .*strokeColor/);
  assert.match(message, /seed/);
  assert.match(message, /versionNonce/);
  assert.match(message, /updated/);
});

test("rejects host-dependent Excalidraw fonts", () => {
  const scene = validScene();
  scene.elements.find((element) => element.type === "text").fontFamily = 2;
  assert.match(validateExcalidrawScene(scene).join("\n"), /font shipped by the pinned Excalidraw package/);
});

test("rejects unsafe Excalidraw files and requires closed live image references", () => {
  const scene = validScene();
  Object.assign(scene.elements[0], {
    type: "image",
    fileId: "remote-image",
  });
  scene.files = {
    "remote-image": {
      id: "remote-image",
      dataURL: "https://attacker.example/pixel.png",
      mimeType: "image/png",
      created: 1,
      lastRetrieved: 1,
    },
  };

  const message = validateExcalidrawScene(scene).join("\n");
  assert.match(message, /dataURL must be canonical base64/);

  scene.elements[0].fileId = "missing-image";
  const missingReferenceMessage = validateExcalidrawScene(scene).join("\n");
  assert.match(missingReferenceMessage, /image fileId 'missing-image' has no matching scene\.files record/);
  assert.match(missingReferenceMessage, /must be referenced by a non-deleted image element/);

  scene.elements[1].link = "https://attacker.example/navigation";
  assert.match(validateExcalidrawScene(scene).join("\n"), /link must be null, empty, or an internal fragment/);
});

test("accepts a canonical embedded raster referenced by a live image", () => {
  const scene = validScene();
  Object.assign(scene.elements[0], {
    type: "image",
    fileId: "embedded-image",
  });
  scene.files = {
    "embedded-image": {
      id: "embedded-image",
      dataURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      mimeType: "image/png",
      created: 1,
      lastRetrieved: 1,
    },
  };

  assert.deepEqual(validateExcalidrawScene(scene), []);
});

test("rejects network-bearing Mermaid constructs before browser rendering", () => {
  assert.deepEqual(validateMermaidSourceSafety("flowchart LR\n  A[Safe] --> B[Done]"), []);
  assert.match(
    validateMermaidSourceSafety('flowchart LR\n  A@{ img: "https://attacker.example/pixel.png" }').join("\n"),
    /URI schemes|image shapes/,
  );
  assert.match(
    validateMermaidSourceSafety('flowchart LR\n  click A href "https://attacker.example"').join("\n"),
    /interactive Mermaid links/,
  );
  assert.match(
    validateMermaidSourceSafety('flowchart LR\n  A["h&#x74;tp://attacker.example"]').join("\n"),
    /URI schemes/,
  );
  assert.match(
    validateMermaidSourceSafety("flowchart LR\n  A[![pixel](/tmp/pixel.png)]").join("\n"),
    /Markdown images/,
  );
});

test("rejects external SVG resources and non-embedded fonts", () => {
  const external = VALID_SVG.replace("</svg>", '<image href="https://example.com/a.png"></image></svg>');
  const hostFont = VALID_SVG.replace("url(data:font/woff2;base64,AA==)", "local(Helvetica)");

  assert.match(validateRenderedExcalidrawSvg(external).join("\n"), /external resource target/);
  assert.match(validateRenderedExcalidrawSvg(hostFont).join("\n"), /pinned local WOFF2 font/);
});

test("rejects scorecard arithmetic errors and category overflow", () => {
  const wrongTotal = passingScorecard();
  wrongTotal.total = 99;
  const overMaximum = passingScorecard();
  overMaximum.necessity = 21;
  overMaximum.total = 101;

  assert.match(validateDiagramScorecard(wrongTotal).map((error) => error.message).join("\n"), /does not equal/);
  assert.match(validateDiagramScorecard(overMaximum).map((error) => error.message).join("\n"), /0 through 20/);
});

test("policy 1 rejects baselines and never grandfathers a violation", () => {
  const issue = {
    stem: "strict",
    key: "TD310",
    baselinable: true,
    advisory: false,
  };
  assert.deepEqual(classifyDiagramIssue(issue, undefined), { legacy: false, level: "ERROR" });
  assert.deepEqual(classifyDiagramIssue(issue, {
    diagrams: { strict: { allowedIssues: ["TD310"] } },
  }), { legacy: false, level: "ERROR" });
  assert.equal(validateQualityBaselinePolicy(false), null);
  assert.match(validateQualityBaselinePolicy(true), /baseline-free/);
});

test("Markdown tokens ignore fences and preserve linked/reference captions", async () => {
  const markdownRenderer = await createMarkdownRenderer(path.join(repositoryRoot, "docs"));
  try {
    const markdown = `# Diagram heading

\`\`\`md
![Ignored fenced image](../assets/diagrams/ignored.svg "Ignored caption")
\`\`\`

[![Linked image explains the transfer](../assets/diagrams/linked.svg "Linked conclusion")](../assets/diagrams/linked.svg)

![Reference image explains the boundary][reference-diagram]

![Sentinel image has descriptive alt](../assets/diagrams/sentinel.svg "technical-diagram")

<TechnicalDiagram src="../assets/diagrams/html.svg" alt="HTML component describes the path" caption="HTML conclusion"></TechnicalDiagram>

[reference-diagram]: ../assets/diagrams/reference.svg "Reference conclusion"
`;
    const tokens = markdownRenderer.parse(markdown, {
      path: path.join(repositoryRoot, "docs", "fixture.md"),
      relativePath: "fixture.md",
    });
    const { images } = collectMarkdownDiagramCandidates(tokens);
    const byAlt = new Map(images.map((image) => [image.alt, image]));

    assert.equal(byAlt.has("Ignored fenced image"), false);
    assert.equal(byAlt.get("Linked image explains the transfer")?.caption, "Linked conclusion");
    assert.equal(byAlt.get("Reference image explains the boundary")?.caption, "Reference conclusion");
    assert.equal(byAlt.get("HTML component describes the path")?.caption, "HTML conclusion");
    assert.equal(
      byAlt.get("Sentinel image has descriptive alt")?.caption,
      "",
      "the technical-diagram sentinel must not become an independent caption",
    );
  } finally {
    disposeMdItInstance();
  }
});

test("visible captions must differ from alt text and the nearest heading", () => {
  assert.equal(validateVisibleDiagramCaption({ alt: "A to B", caption: "", nearestHeading: "Flow" }), "missing");
  assert.equal(validateVisibleDiagramCaption({ alt: "A to B", caption: "A—to—B", nearestHeading: "Flow" }), "matches-alt");
  assert.equal(validateVisibleDiagramCaption({ alt: "A to B", caption: "1. Flow", nearestHeading: "Flow" }), "matches-heading");
  assert.equal(validateVisibleDiagramCaption({
    alt: "A transfers work to B",
    caption: "Validation gates ownership transfer",
    nearestHeading: "Flow",
  }), null);
});
