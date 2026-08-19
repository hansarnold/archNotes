#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(siteRoot, "..");
const docsRoot = path.join(repositoryRoot, "docs");
const errors = [];

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
});

for (const legacyPath of [
  path.join(repositoryRoot, "notes"),
  path.join(repositoryRoot, "sources"),
  path.join(siteRoot, "content"),
]) {
  if (existsSync(legacyPath)) errors.push(`Legacy duplicate content tree still exists: ${path.relative(repositoryRoot, legacyPath)}`);
}

const files = walk(docsRoot);
const markdownFiles = files.filter((file) => file.endsWith(".md"));
const diagramSources = files.filter((file) => file.endsWith(".mmd"));
const diagramAssets = files.filter((file) => file.endsWith(".svg"));
const duplicateParagraphs = new Map();
const cjkPattern = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const canonicalLearningTracks = [
  "Model Computation and Workload",
  "Model-to-Hardware Mapping",
  "Hardware Architecture",
  "Software Optimization",
  "Model–Hardware Co-design",
  "Performance Modeling and Validation",
];
const canonicalOwnershipTitles = [
  "Model Computation Primitives and Workload Description",
  "Model-to-Hardware Mapping",
  "AI Accelerator Architecture Comparison",
  "Cross-Architecture Software Optimization",
  "Model–Hardware Co-design",
  "Performance Modeling and Validation",
];
const pairedLocalePaths = [
  "index.md",
  "curriculum.md",
  "glossary.md",
  "notes/model-computation-primitives.md",
  "notes/model-to-hardware-mapping.md",
  "notes/ai-accelerator-architecture-comparison.md",
  "notes/software-optimization-methodology.md",
  "notes/model-hardware-codesign.md",
  "notes/performance-modeling.md",
];

const chineseLocalePaths = markdownFiles
  .filter((file) => !file.startsWith(path.join(docsRoot, "en") + path.sep))
  .map((file) => path.relative(docsRoot, file));
const englishLocalePaths = markdownFiles
  .filter((file) => file.startsWith(path.join(docsRoot, "en") + path.sep))
  .map((file) => path.relative(path.join(docsRoot, "en"), file));

for (const relativePath of chineseLocalePaths) {
  if (!englishLocalePaths.includes(relativePath)) errors.push(`Missing English route counterpart: docs/en/${relativePath}`);
}
for (const relativePath of englishLocalePaths) {
  if (!chineseLocalePaths.includes(relativePath)) errors.push(`Missing Chinese route counterpart: docs/${relativePath}`);
}

for (const relativePath of ["index.md", "curriculum.md", "topics.md", "notes/learning-roadmap.md"]) {
  const source = readFileSync(path.join(docsRoot, relativePath), "utf8");
  for (const track of canonicalLearningTracks) {
    if (!source.includes(track)) errors.push(`docs/${relativePath}: missing canonical learning track label ${track}`);
  }
}

for (const localePrefix of ["", "en/"]) {
  for (const relativePath of ["index.md", "curriculum.md", "topics.md"]) {
    const source = readFileSync(path.join(docsRoot, localePrefix, relativePath), "utf8");
    for (const title of canonicalOwnershipTitles) {
      if (!source.includes(title)) errors.push(`docs/${localePrefix}${relativePath}: missing canonical ownership document title ${title}`);
    }
  }
}

const siteConfigSource = readFileSync(path.join(siteRoot, ".vitepress", "config.mjs"), "utf8");
for (const track of canonicalLearningTracks) {
  if (!siteConfigSource.includes(track)) errors.push(`VitePress navigation is missing canonical learning track label ${track}`);
}
if (siteConfigSource.includes("i18nRouting: false")) errors.push("VitePress locale switching must preserve paired routes");

for (const relativePath of pairedLocalePaths) {
  const chinesePath = path.join(docsRoot, relativePath);
  const englishPath = path.join(docsRoot, "en", relativePath);
  if (!existsSync(chinesePath)) errors.push(`Missing Chinese locale page: docs/${relativePath}`);
  if (!existsSync(englishPath)) errors.push(`Missing English locale page: docs/en/${relativePath}`);
  if (existsSync(chinesePath) && existsSync(englishPath)) {
    const chineseSource = readFileSync(chinesePath, "utf8");
    const englishSource = readFileSync(englishPath, "utf8");
    const chineseTitle = chineseSource.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1];
    const englishTitle = englishSource.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1];
    if (chineseTitle !== englishTitle) {
      errors.push(`Locale pair must share one canonical English title: docs/${relativePath}`);
    }

    const frontmatter = chineseSource.match(/^---[\s\S]*?---\s*/)?.[0] ?? "";
    const bodyLineOffset = frontmatter ? frontmatter.split("\n").length - 1 : 0;
    const bodyLines = chineseSource.slice(frontmatter.length).split("\n");
    let insideFence = false;
    for (const [lineIndex, line] of bodyLines.entries()) {
      if (/^\s*```/.test(line)) {
        insideFence = !insideFence;
        continue;
      }
      if (insideFence) continue;

      const secondLevelHeading = line.match(/^##\s+(.+)/)?.[1];
      if (relativePath !== "glossary.md" && secondLevelHeading && !cjkPattern.test(secondLevelHeading)) {
        errors.push(`docs/${relativePath}:${bodyLineOffset + lineIndex + 1}: Chinese locale section heading must use Chinese narrative`);
      }

      if (
        !line.trim()
        || cjkPattern.test(line)
        || /^\s*(?:#|\||!\[|<!--|<)/.test(line)
      ) continue;

      const latinLetterCount = line.match(/[A-Za-z]/g)?.length ?? 0;
      if (latinLetterCount >= 20 && /[.?!:]\s*$/.test(line)) {
        errors.push(`docs/${relativePath}:${bodyLineOffset + lineIndex + 1}: Chinese locale contains a full English sentence`);
      }
    }
  }
}

const readmeSource = readFileSync(path.join(repositoryRoot, "README.md"), "utf8");
if (cjkPattern.test(readmeSource)) errors.push("README.md must remain English-only");

const normalizeTarget = (target) => decodeURIComponent(target.split("#", 1)[0].split("?", 1)[0]);
const isExternal = (target) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target);

for (const markdownPath of markdownFiles) {
  const relativePath = path.relative(repositoryRoot, markdownPath);
  const source = readFileSync(markdownPath, "utf8");

  if (markdownPath.startsWith(path.join(docsRoot, "en") + path.sep) && cjkPattern.test(source)) {
    errors.push(`${relativePath}: English locale page contains CJK text`);
  }

  if (!source.startsWith("---\n") || !/^title:/m.test(source) || !/^description:/m.test(source)) {
    errors.push(`${relativePath}: missing committed title/description frontmatter`);
  }
  if (/```mermaid\b/.test(source)) errors.push(`${relativePath}: Mermaid must be exported and referenced as SVG`);
  if (/<Badge\b/.test(source)) errors.push(`${relativePath}: generated Badge markup is not allowed in canonical Markdown`);

  for (const match of source.matchAll(/(!?)\[([^\]]*)\]\(([^)]+)\)/g)) {
    const [, imageMarker, label, rawTarget] = match;
    const target = rawTarget.trim().replace(/^<|>$/g, "");
    if (isExternal(target)) continue;
    if (imageMarker && !label.trim()) errors.push(`${relativePath}: image is missing alt text (${target})`);

    const normalized = normalizeTarget(target);
    if (!normalized) continue;
    const resolved = path.resolve(path.dirname(markdownPath), normalized);
    if (!resolved.startsWith(repositoryRoot + path.sep)) {
      errors.push(`${relativePath}: link escapes the repository (${target})`);
    } else if (!existsSync(resolved)) {
      errors.push(`${relativePath}: missing local target (${target})`);
    } else if (imageMarker && !resolved.startsWith(path.join(docsRoot, "assets") + path.sep)) {
      errors.push(`${relativePath}:正文图片必须位于 docs/assets (${target})`);
    }
  }

  const withoutFrontmatter = source.replace(/^---[\s\S]*?---\s*/, "");
  for (const paragraph of withoutFrontmatter.split(/\n\s*\n/)) {
    const normalized = paragraph.replace(/\s+/g, " ").trim();
    if (normalized.length < 180 || /^(?:#|\||```|[-*]\s)/.test(normalized)) continue;
    const owners = duplicateParagraphs.get(normalized) || new Set();
    owners.add(relativePath);
    duplicateParagraphs.set(normalized, owners);
  }
}

const glossaryTerms = (glossaryPath) => new Set(
  [...readFileSync(glossaryPath, "utf8").matchAll(/^\| \*\*(.+?)\*\* \|/gm)].map((match) => match[1]),
);
const chineseGlossaryTerms = glossaryTerms(path.join(docsRoot, "glossary.md"));
const englishGlossaryTerms = glossaryTerms(path.join(docsRoot, "en", "glossary.md"));
for (const term of chineseGlossaryTerms) {
  if (!englishGlossaryTerms.has(term)) errors.push(`English Glossary is missing canonical term: ${term}`);
}
for (const term of englishGlossaryTerms) {
  if (!chineseGlossaryTerms.has(term)) errors.push(`Chinese Glossary is missing canonical term: ${term}`);
}

for (const owners of duplicateParagraphs.values()) {
  if (owners.size > 1) errors.push(`Duplicate long paragraph: ${[...owners].join(", ")}`);
}

for (const sourcePath of diagramSources) {
  const svgPath = sourcePath.replace(/\.mmd$/, ".svg");
  if (!existsSync(svgPath)) errors.push(`Missing rendered diagram: ${path.relative(repositoryRoot, svgPath)}`);
}
for (const svgPath of diagramAssets) {
  const sourcePath = svgPath.replace(/\.svg$/, ".mmd");
  if (!existsSync(sourcePath)) errors.push(`Missing editable diagram source: ${path.relative(repositoryRoot, sourcePath)}`);
  if (statSync(svgPath).size < 200 || !readFileSync(svgPath, "utf8").includes("<svg")) {
    errors.push(`Invalid rendered diagram: ${path.relative(repositoryRoot, svgPath)}`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Content check passed: ${markdownFiles.length} Markdown files, ${diagramAssets.length} rendered diagrams.`);
