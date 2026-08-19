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

const normalizeTarget = (target) => decodeURIComponent(target.split("#", 1)[0].split("?", 1)[0]);
const isExternal = (target) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target);

for (const markdownPath of markdownFiles) {
  const relativePath = path.relative(repositoryRoot, markdownPath);
  const source = readFileSync(markdownPath, "utf8");

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
