#!/usr/bin/env node

import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import {
  EXCALIDRAW_PIPELINE,
  assertValidExcalidrawScene,
  assertValidMermaidSourceSafety,
  assertValidRenderedExcalidrawSvg,
  inspectExcalidrawPipeline,
} from "./diagram-pipeline.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(siteRoot, "..");
const docsRoot = path.join(repositoryRoot, "docs");
const diagramsRoot = path.join(docsRoot, "assets", "diagrams");
const shouldExtract = process.argv.includes("--extract");
const shouldCheck = process.argv.includes("--check");
const unknownArguments = process.argv.slice(2).filter((argument) => !["--extract", "--check"].includes(argument));

if (unknownArguments.length) {
  throw new Error(`Unknown argument${unknownArguments.length === 1 ? "" : "s"}: ${unknownArguments.join(", ")}`);
}
if (shouldExtract && shouldCheck) {
  throw new Error("--extract and --check are separate operations.");
}

const walk = (directory, extension) => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(target, extension);
    return entry.isFile() && entry.name.endsWith(extension) ? [target] : [];
  });

const slugify = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "") || "diagram";

const stableRenderId = (sourcePath) => {
  const relativePath = path.relative(diagramsRoot, sourcePath).replaceAll(path.sep, "/");
  const stem = slugify(relativePath.replace(/\.mmd$/, ""));
  const suffix = createHash("sha256").update(relativePath).digest("hex").slice(0, 8);
  return `archnotes-${stem}-${suffix}`;
};

// Chrome serializes XHTML void elements inside Mermaid foreignObject labels as
// HTML (for example, <br>). Canonical SVG assets are XML, so normalize those
// elements before committing or comparing the rendered output.
const normalizeSvgMarkup = (source) => source.replace(
  /<(br|hr|img|input|link|meta)(\b[^<>]*?)(?<!\/)\s*>/gi,
  "<$1$2 />",
);

const addOpaqueCanvas = (source) => source.replace(
  /(<svg\b[^>]*>)/i,
  '$1<rect data-diagram-background="true" x="0" y="0" width="100%" height="100%" fill="#ffffff" aria-hidden="true"></rect>',
);

const extractMermaid = () => {
  mkdirSync(diagramsRoot, { recursive: true });

  for (const markdownPath of walk(docsRoot, ".md")) {
    const source = readFileSync(markdownPath, "utf8");
    let diagramIndex = 0;
    const migrated = source.replace(/```mermaid\n([\s\S]*?)\n```/g, (block, diagramSource, offset) => {
      diagramIndex += 1;
      const stem = slugify(path.basename(markdownPath, ".md"));
      const name = `${stem}-${String(diagramIndex).padStart(2, "0")}`;
      const mermaidPath = path.join(diagramsRoot, `${name}.mmd`);
      const svgPath = path.join(diagramsRoot, `${name}.svg`);
      const normalizedSource = `${diagramSource.trim()}\n`;

      if (existsSync(mermaidPath) && readFileSync(mermaidPath, "utf8") !== normalizedSource) {
        throw new Error(`Diagram source conflict: ${path.relative(repositoryRoot, mermaidPath)}`);
      }
      writeFileSync(mermaidPath, normalizedSource);

      const before = source.slice(0, offset);
      const heading = [...before.matchAll(/^#{2,6}\s+(.+)$/gm)].at(-1)?.[1]
        ?.replace(/[`*_]/g, "")
        ?.trim() || "Architecture diagram";
      let relativeSvg = path.relative(path.dirname(markdownPath), svgPath).replaceAll(path.sep, "/");
      if (!relativeSvg.startsWith(".")) relativeSvg = `./${relativeSvg}`;
      return `![${heading}](${relativeSvg})`;
    });

    if (migrated !== source) writeFileSync(markdownPath, migrated);
  }
};

const findChrome = () => {
  const candidates = [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
  ].filter(Boolean);
  const executable = candidates.find(existsSync);
  if (!executable) throw new Error("Chrome is required to render technical diagrams.");
  return executable;
};

const readExcalidrawScene = (sourcePath) => {
  let scene;
  try {
    scene = JSON.parse(readFileSync(sourcePath, "utf8"));
  } catch (error) {
    throw new Error(`${path.relative(repositoryRoot, sourcePath)} is not valid JSON: ${error.message}`);
  }
  assertValidExcalidrawScene(scene, path.relative(repositoryRoot, sourcePath));
  return scene;
};

const buildExcalidrawBrowserBundle = async (bundlePath) => {
  const result = await build({
    absWorkingDir: siteRoot,
    entryPoints: [path.join(siteRoot, "scripts", "excalidraw-renderer-entry.js")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "chrome120",
    conditions: ["browser", "production"],
    define: { "process.env.NODE_ENV": '"production"' },
    legalComments: "none",
    logLevel: "silent",
    minify: false,
    sourcemap: false,
  });
  if (result.outputFiles.length !== 1) throw new Error("Unexpected Excalidraw browser bundle output.");
  writeFileSync(bundlePath, result.outputFiles[0].contents);
};

const renderDiagrams = async () => {
  const pipeline = inspectExcalidrawPipeline(siteRoot);
  if (!pipeline.available) {
    throw new Error(`Excalidraw pipeline is unavailable:\n${pipeline.errors.join("\n")}`);
  }

  const mermaidBundle = path.join(siteRoot, "node_modules", "mermaid", "dist", "mermaid.min.js");
  if (!existsSync(mermaidBundle)) throw new Error("Install site dependencies before rendering diagrams.");

  const mermaidSources = walk(diagramsRoot, ".mmd").sort().map((sourcePath) => {
    const source = readFileSync(sourcePath, "utf8");
    assertValidMermaidSourceSafety(source, path.relative(repositoryRoot, sourcePath));
    return {
      sourcePath,
      svgPath: sourcePath.replace(/\.mmd$/, ".svg"),
      source,
      renderId: stableRenderId(sourcePath),
    };
  });
  const canonicalExcalidrawSources = walk(diagramsRoot, ".excalidraw").sort().map((sourcePath) => ({
    sourcePath,
    svgPath: sourcePath.replace(/\.excalidraw$/, ".svg"),
    scene: readExcalidrawScene(sourcePath),
    canary: false,
  }));
  const canaryPath = path.join(siteRoot, EXCALIDRAW_PIPELINE.canaryPath);
  const excalidrawSources = [
    ...canonicalExcalidrawSources,
    {
      sourcePath: canaryPath,
      svgPath: null,
      scene: readExcalidrawScene(canaryPath),
      canary: true,
    },
  ];

  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "archnotes-diagrams-"));
  const pagePath = path.join(temporaryRoot, "render.html");
  const excalidrawBundlePath = path.join(temporaryRoot, "excalidraw-renderer.js");
  await buildExcalidrawBrowserBundle(excalidrawBundlePath);

  const mermaidDefinitions = JSON.stringify(
    mermaidSources.map(({ source, renderId }) => ({ source, renderId })),
  ).replaceAll("<", "\\u003c");
  const excalidrawDefinitions = JSON.stringify(
    excalidrawSources.map(({ scene, sourcePath }) => ({
      label: path.relative(repositoryRoot, sourcePath).replaceAll(path.sep, "/"),
      scene,
    })),
  ).replaceAll("<", "\\u003c");
  const excalidrawAssetRoot = path.join(
    siteRoot,
    "node_modules",
    "@excalidraw",
    "excalidraw",
    "dist",
    "prod",
    path.sep,
  );
  const page = `<!doctype html>
<html><head><meta charset="utf-8">
<script>window.EXCALIDRAW_ASSET_PATH = ${JSON.stringify(pathToFileURL(excalidrawAssetRoot).href)};</script>
<script src=${JSON.stringify(pathToFileURL(mermaidBundle).href)}></script>
<script src=${JSON.stringify(pathToFileURL(excalidrawBundlePath).href)}></script>
</head><body><script>
const mermaidDefinitions = ${mermaidDefinitions};
const excalidrawDefinitions = ${excalidrawDefinitions};
(async () => {
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral", fontFamily: "system-ui, sans-serif" });
  for (let index = 0; index < mermaidDefinitions.length; index += 1) {
    const definition = mermaidDefinitions[index];
    const { svg } = await mermaid.render(definition.renderId, definition.source);
    const section = document.createElement("section");
    section.id = "mermaid-output-" + index;
    section.innerHTML = svg;
    document.body.append(section);
  }
  for (let index = 0; index < excalidrawDefinitions.length; index += 1) {
    const definition = excalidrawDefinitions[index];
    const first = await globalThis.__ARCHNOTES_RENDER_EXCALIDRAW__(definition.scene, ${EXCALIDRAW_PIPELINE.exportPadding});
    const second = await globalThis.__ARCHNOTES_RENDER_EXCALIDRAW__(definition.scene, ${EXCALIDRAW_PIPELINE.exportPadding});
    if (first !== second) throw new Error(definition.label + " produced different SVG bytes on repeated render");
    const section = document.createElement("section");
    section.id = "excalidraw-output-" + index;
    section.innerHTML = first;
    document.body.append(section);
  }
  document.documentElement.dataset.ready = "true";
})().catch((error) => {
  document.documentElement.dataset.error = error.stack || error.message;
});
</script></body></html>`;
  writeFileSync(pagePath, page);

  try {
    const dumped = execFileSync(findChrome(), [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-crash-reporter",
      "--disable-domain-reliability",
      "--disable-sync",
      "--metrics-recording-only",
      "--no-first-run",
      "--no-pings",
      "--host-resolver-rules=MAP * ~NOTFOUND",
      "--proxy-server=http://127.0.0.1:9",
      "--proxy-bypass-list=<-loopback>",
      "--allow-file-access-from-files",
      `--user-data-dir=${path.join(temporaryRoot, "chrome")}`,
      "--virtual-time-budget=30000",
      "--dump-dom",
      pathToFileURL(pagePath).href,
    ], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

    if (!dumped.includes('data-ready="true"')) {
      const error = dumped.match(/data-error="([^"]+)/)?.[1] || "unknown browser rendering error";
      throw new Error(`Technical diagram rendering did not finish: ${error}`);
    }

    const stale = [];
    mermaidSources.forEach(({ svgPath }, index) => {
      const section = dumped.match(new RegExp(`<section id="mermaid-output-${index}">([\\s\\S]*?<\\/svg>)<\\/section>`));
      if (!section) throw new Error(`Missing rendered Mermaid SVG for diagram ${index + 1}`);
      const rendered = `${addOpaqueCanvas(normalizeSvgMarkup(section[1]))}\n`;
      if (shouldCheck) {
        if (!existsSync(svgPath) || readFileSync(svgPath, "utf8") !== rendered) stale.push(svgPath);
      } else {
        writeFileSync(svgPath, rendered);
      }
    });

    excalidrawSources.forEach(({ svgPath, sourcePath, canary }, index) => {
      const section = dumped.match(new RegExp(`<section id="excalidraw-output-${index}">([\\s\\S]*?<\\/svg>)<\\/section>`));
      if (!section) throw new Error(`Missing rendered Excalidraw SVG for ${path.relative(repositoryRoot, sourcePath)}`);
      const rendered = `${addOpaqueCanvas(normalizeSvgMarkup(section[1]))}\n`;
      assertValidRenderedExcalidrawSvg(rendered, path.relative(repositoryRoot, sourcePath));
      if (canary) return;
      if (shouldCheck) {
        if (!existsSync(svgPath) || readFileSync(svgPath, "utf8") !== rendered) stale.push(svgPath);
      } else {
        writeFileSync(svgPath, rendered);
      }
    });

    if (stale.length) {
      throw new Error(`Stale diagram assets:\n${stale.map((file) => path.relative(repositoryRoot, file)).join("\n")}`);
    }
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
};

if (shouldExtract) {
  extractMermaid();
  console.log("Inline Mermaid sources extracted. Run `npm run diagrams` to render them.");
} else {
  await renderDiagrams();
  console.log(shouldCheck ? "Mermaid and Excalidraw assets are current." : "Mermaid and Excalidraw assets rendered.");
}
