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
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(siteRoot, "..");
const docsRoot = path.join(repositoryRoot, "docs");
const diagramsRoot = path.join(docsRoot, "assets", "diagrams");
const shouldExtract = process.argv.includes("--extract");
const shouldCheck = process.argv.includes("--check");

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
  if (!executable) throw new Error("Chrome is required to render Mermaid diagrams.");
  return executable;
};

const renderDiagrams = () => {
  const mermaidBundle = path.join(siteRoot, "node_modules", "mermaid", "dist", "mermaid.min.js");
  if (!existsSync(mermaidBundle)) throw new Error("Install site dependencies before rendering diagrams.");

  const sources = walk(diagramsRoot, ".mmd").sort().map((sourcePath) => ({
    sourcePath,
    svgPath: sourcePath.replace(/\.mmd$/, ".svg"),
    source: readFileSync(sourcePath, "utf8"),
  }));
  if (!sources.length) return;

  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "archnotes-diagrams-"));
  const pagePath = path.join(temporaryRoot, "render.html");
  const definitions = JSON.stringify(sources.map(({ source }) => source)).replaceAll("<", "\\u003c");
  const page = `<!doctype html>
<html><head><meta charset="utf-8"><script src="file://${mermaidBundle}"></script></head>
<body><script>
const definitions = ${definitions};
(async () => {
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral", fontFamily: "system-ui, sans-serif" });
  for (let index = 0; index < definitions.length; index += 1) {
    const { svg } = await mermaid.render("archnotes-diagram-" + index, definitions[index]);
    const section = document.createElement("section");
    section.id = "diagram-output-" + index;
    section.innerHTML = svg;
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
      "--allow-file-access-from-files",
      `--user-data-dir=${path.join(temporaryRoot, "chrome")}`,
      "--virtual-time-budget=15000",
      "--dump-dom",
      `file://${pagePath}`,
    ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

    if (!dumped.includes('data-ready="true"')) {
      const error = dumped.match(/data-error="([^"]+)/)?.[1] || "unknown browser rendering error";
      throw new Error(`Mermaid rendering did not finish: ${error}`);
    }

    const stale = [];
    sources.forEach(({ svgPath }, index) => {
      const section = dumped.match(new RegExp(`<section id="diagram-output-${index}">([\\s\\S]*?<\\/svg>)<\\/section>`));
      if (!section) throw new Error(`Missing rendered SVG for diagram ${index + 1}`);
      const rendered = `${section[1]}\n`;
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

if (shouldExtract) extractMermaid();
renderDiagrams();
console.log(shouldCheck ? "Diagram assets are current." : "Diagram assets rendered.");
