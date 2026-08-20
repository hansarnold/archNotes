#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMarkdownRenderer, disposeMdItInstance } from "vitepress";
import {
  classifyDiagramIssue,
  inspectExcalidrawPipeline,
  validateDiagramScorecard,
  validateExcalidrawScene,
  validateMermaidSourceSafety,
  validateQualityBaselinePolicy,
} from "./diagram-pipeline.mjs";
import {
  collectMarkdownDiagramCandidates,
  normalizeDiagramLabel as normalizeLabel,
  validateVisibleDiagramCaption,
} from "./diagram-markdown-references.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(siteRoot, "..");
const docsRoot = path.join(repositoryRoot, "docs");
const diagramsRoot = path.join(docsRoot, "assets", "diagrams");
const baselinePath = path.join(diagramsRoot, "quality-baseline.json");
const reportOnly = process.argv.includes("--report");
const unknownArguments = process.argv.slice(2).filter((argument) => ![
  "--report",
].includes(argument));

if (unknownArguments.length) {
  console.error(`Unknown argument${unknownArguments.length === 1 ? "" : "s"}: ${unknownArguments.join(", ")}`);
  process.exit(2);
}

const POLICY_VERSION = 1;
const CONTENT_WIDTH_PX = 609;
const PREFERRED_ASPECT_MIN = 0.65;
const PREFERRED_ASPECT_MAX = 2.2;
const INLINE_ASPECT_MIN = 0.5;
const INLINE_ASPECT_MAX = 4;
const PROJECTED_HEIGHT_MIN_PX = 240;
const PROJECTED_HEIGHT_MAX_PX = 720;
const PROJECTED_FONT_MIN_PX = 14;
const PRIMARY_NODE_MAX = 9;
const PRIMARY_EDGE_MAX = 12;
const SEQUENCE_PARTICIPANT_MAX = 5;
const ALT_INFORMATION_MIN_CHARS = 8;
const CONTRACT_FIELDS = [
  "kind",
  "claim",
  "question",
  "audience",
  "scope",
  "readingOrder",
  "evidence",
  "localeScope",
  "presentation",
  "outcome",
];
const CONTRACT_KINDS = new Set([
  "architecture",
  "comparison",
  "dataflow",
  "flowchart",
  "mental-model",
  "pipeline",
  "sequence",
  "state",
  "timeline",
]);
const CONTRACT_OUTCOMES = new Set([
  "pass",
  "revise",
  "split",
  "replace-with-list",
  "replace-with-table",
  "migrate-to-excalidraw",
  "delete",
]);

const RULES = Object.freeze({
  TD101: "rendered SVG has no editable source",
  TD102: "editable source has no rendered SVG",
  TD103: "diagram must have exactly one editable source",
  TD104: "Mermaid source is empty or has an unsupported declaration",
  TD105: "Excalidraw source requires the accepted local pinned render-and-check pipeline",
  TD106: "Excalidraw source is not valid JSON scene data",
  TD107: "Markdown diagram reference has no rendered SVG",
  TD108: "diagram governance contract has no editable source or rendered SVG",
  TD109: "Markdown SVG images must use the governed diagrams directory",
  TD110: "inline SVG is not allowed in canonical Markdown",
  TD111: "Mermaid source contains an external resource or interactive link",
  TD201: "rendered asset is not a structurally valid SVG document",
  TD202: "SVG requires a finite, positive four-number viewBox",
  TD203: "SVG contains a prohibited active element",
  TD204: "SVG contains an inline event-handler attribute",
  TD205: "SVG contains an external resource or link",
  TD206: "SVG contains unsafe style or executable content",
  TD207: "rendered SVG requires an explicit opaque background canvas",
  TD301: "rendered diagram is not referenced by canonical Markdown",
  TD302: "diagram reference requires non-empty alt text",
  TD303: "diagram alt text must explain purpose or conclusion instead of repeating the heading",
  TD304: "diagram reference requires a distinct visible caption",
  TD310: "inline aspect ratio is outside the preferred range",
  TD311: "projected inline height is outside the preferred range",
  TD312: "projected primary text is smaller than the readability floor",
  TD313: "projected primary text size cannot be determined",
  TD320: "diagram exceeds the preferred primary-node budget",
  TD321: "diagram exceeds the preferred primary-relationship budget",
  TD322: "sequence diagram exceeds the participant budget",
  TD401: "diagram governance contract is missing",
  TD402: "diagram governance contract is not valid JSON object data",
  TD403: "diagram governance contract has a missing or empty required field",
  TD404: "diagram governance contract uses an unsupported enum value",
  TD405: "diagram governance contract kind conflicts with its source semantics",
  TD406: "diagram governance scorecard is missing or malformed",
  TD407: "diagram governance scorecard must total at least 85 out of 100",
  TD408: "diagram governance outcome must be pass for full-strict acceptance",
  TD901: "a baselined quality metric regressed",
  TD902: "a resolved legacy issue remains in the baseline",
  TD903: "baseline contains a diagram that no longer exists",
  TD904: "a baselined quality metric improved and can be ratcheted",
  TD905: "quality baseline is forbidden by the full-strict policy",
});

const NON_BASELINABLE_RULES = new Set([
  "TD101",
  "TD102",
  "TD103",
  "TD104",
  "TD105",
  "TD106",
  "TD107",
  "TD108",
  "TD109",
  "TD110",
  "TD111",
  "TD201",
  "TD202",
  "TD203",
  "TD204",
  "TD205",
  "TD206",
  "TD207",
  "TD302",
  "TD304",
  "TD313",
  "TD402",
  "TD403",
  "TD404",
  "TD405",
  "TD406",
  "TD407",
  "TD901",
  "TD902",
  "TD903",
  "TD904",
  "TD905",
]);

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
});

const relativeRepositoryPath = (target) => path.relative(repositoryRoot, target).replaceAll(path.sep, "/");
const round = (value, digits = 2) => Number(value.toFixed(digits));
const formatMetric = (value) => Number.isFinite(value) ? round(value).toString() : "n/a";
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const issueKey = (code, scope) => scope ? `${code}:${scope}` : code;
const issues = [];
const addIssue = (diagram, code, message, scope = "", options = {}) => {
  if (!RULES[code]) throw new Error(`Unknown diagram lint rule: ${code}`);
  issues.push({
    stem: diagram?.stem ?? "@repository",
    code,
    key: issueKey(code, scope),
    message,
    scope,
    baselinable: options.baselinable ?? !NON_BASELINABLE_RULES.has(code),
    advisory: options.advisory ?? false,
  });
};

const readJson = (target) => JSON.parse(readFileSync(target, "utf8"));

const excalidrawPipeline = inspectExcalidrawPipeline(siteRoot);
const excalidrawPipelineAvailable = excalidrawPipeline.available;

const resolveLocalSvg = (markdownPath, rawTarget) => {
  const targetWithoutQuery = rawTarget.trim().replace(/^<|>$/g, "").split(/[?#]/, 1)[0];
  if (!targetWithoutQuery || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(targetWithoutQuery)) return null;

  let decodedTarget;
  try {
    decodedTarget = decodeURIComponent(targetWithoutQuery);
  } catch {
    decodedTarget = targetWithoutQuery;
  }
  const resolved = decodedTarget.startsWith("/")
    ? path.resolve(docsRoot, decodedTarget.slice(1))
    : path.resolve(path.dirname(markdownPath), decodedTarget);
  return path.extname(resolved).toLowerCase() === ".svg" ? resolved : null;
};

const parseHtmlAttributes = (source) => {
  const attributes = new Map();
  const attributePattern = /\s([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of source.matchAll(attributePattern)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
};

const parseMarkdownImages = (markdownPath, markdownRenderer) => {
  const source = readFileSync(markdownPath, "utf8");
  const relativeMarkdownPath = relativeRepositoryPath(markdownPath);
  const tokens = markdownRenderer.parse(source, {
    path: markdownPath,
    relativePath: path.relative(docsRoot, markdownPath).replaceAll(path.sep, "/"),
  });
  const images = [];

  const addImage = (alt, caption, rawTarget, nearestHeading, line = null) => {
    const resolved = resolveLocalSvg(markdownPath, rawTarget);
    if (!resolved) return;
    if (!resolved.startsWith(diagramsRoot + path.sep)) {
      const location = `${relativeMarkdownPath}${line ? `:${line}` : ""}`;
      addIssue(null, "TD109", `${location} references SVG image outside docs/assets/diagrams (${rawTarget})`, location);
      return;
    }
    images.push({
      alt: alt.trim(),
      caption: caption.trim(),
      line,
      markdownPath,
      nearestHeading,
      resolved,
    });
  };
  const candidates = collectMarkdownDiagramCandidates(tokens);
  for (const line of candidates.inlineSvgLines) {
    const location = `${relativeMarkdownPath}${line ? `:${line}` : ""}`;
    addIssue(null, "TD110", `${location} contains inline SVG; use a governed source/render pair`, location);
  }
  for (const image of candidates.images) {
    addImage(image.alt, image.caption, image.rawTarget, image.nearestHeading, image.line);
  }

  const occurrences = new Map();
  for (const image of images) {
    const fingerprint = createHash("sha256").update([
      relativeRepositoryPath(image.resolved),
      normalizeLabel(image.alt),
      normalizeLabel(image.nearestHeading),
    ].join("\0")).digest("hex").slice(0, 12);
    const occurrence = (occurrences.get(fingerprint) ?? 0) + 1;
    occurrences.set(fingerprint, occurrence);
    image.referenceScope = `${relativeMarkdownPath}#${fingerprint}-${occurrence}`;
  }
  return images;
};

const isGenericAlt = (alt, heading) => {
  const normalizedAlt = normalizeLabel(alt);
  const normalizedHeading = normalizeLabel(heading);
  if (!normalizedAlt) return false;
  if (normalizedHeading && normalizedAlt === normalizedHeading) return true;
  return new Set([
    "architecture diagram",
    "diagram",
    "flowchart",
    "架构图",
    "流程图",
    "示意图",
  ]).has(normalizedAlt);
};

const isLowInformationAlt = (alt) => {
  const meaningfulCharacters = [...normalizeLabel(alt).replace(/\s/g, "")];
  return meaningfulCharacters.length < ALT_INFORMATION_MIN_CHARS;
};

const inspectXmlTagSyntax = (token) => {
  const isClosing = token.startsWith("/");
  const isSelfClosing = !isClosing && token.endsWith("/");
  let content = isClosing ? token.slice(1).trim() : token;
  if (isSelfClosing) content = content.slice(0, -1).trimEnd();
  const name = content.match(/^([A-Za-z_][\w:.-]*)/)?.[1];
  if (!name) return "invalid XML tag name";
  let cursor = name.length;
  if (isClosing) return content.slice(cursor).trim() ? `unexpected content in closing tag </${name}>` : "";

  const attributeNames = new Set();
  while (cursor < content.length) {
    if (!/\s/.test(content[cursor])) return `expected whitespace before an attribute on <${name}>`;
    while (/\s/.test(content[cursor] ?? "")) cursor += 1;
    if (cursor >= content.length) break;

    const attributeName = content.slice(cursor).match(/^([A-Za-z_][\w:.-]*)/)?.[1];
    if (!attributeName) return `invalid attribute syntax on <${name}>`;
    if (attributeNames.has(attributeName)) return `duplicate attribute '${attributeName}' on <${name}>`;
    attributeNames.add(attributeName);
    cursor += attributeName.length;
    while (/\s/.test(content[cursor] ?? "")) cursor += 1;
    if (content[cursor] !== "=") return `attribute '${attributeName}' on <${name}> requires '='`;
    cursor += 1;
    while (/\s/.test(content[cursor] ?? "")) cursor += 1;
    const quote = content[cursor];
    if (quote !== "\"" && quote !== "'") return `attribute '${attributeName}' on <${name}> must be quoted`;
    const closingQuote = content.indexOf(quote, cursor + 1);
    if (closingQuote === -1) return `attribute '${attributeName}' on <${name}> has no closing quote`;
    if (content.slice(cursor + 1, closingQuote).includes("<")) {
      return `attribute '${attributeName}' on <${name}> contains an unescaped '<'`;
    }
    cursor = closingQuote + 1;
  }
  return "";
};

const inspectXmlStructure = (source) => {
  const stack = [];
  const roots = [];
  let cursor = 0;

  while (cursor < source.length) {
    const opening = source.indexOf("<", cursor);
    if (opening === -1) {
      if (stack.length === 0 && source.slice(cursor).trim()) {
        return "non-whitespace content appears outside the SVG root";
      }
      break;
    }
    if (stack.length === 0 && source.slice(cursor, opening).trim()) {
      return "non-whitespace content appears outside the SVG root";
    }

    if (source.startsWith("<!--", opening)) {
      const closing = source.indexOf("-->", opening + 4);
      if (closing === -1) return "unterminated XML comment";
      cursor = closing + 3;
      continue;
    }
    if (source.startsWith("<![CDATA[", opening)) {
      if (stack.length === 0) return "CDATA is not allowed outside the SVG root";
      const closing = source.indexOf("]]>", opening + 9);
      if (closing === -1) return "unterminated CDATA section";
      cursor = closing + 3;
      continue;
    }
    if (source.startsWith("<?", opening)) {
      const closing = source.indexOf("?>", opening + 2);
      if (closing === -1) return "unterminated processing instruction";
      cursor = closing + 2;
      continue;
    }
    if (/^<!DOCTYPE\b/i.test(source.slice(opening))) return "DOCTYPE is not allowed";
    if (/^<!ENTITY\b/i.test(source.slice(opening))) return "ENTITY is not allowed";
    if (source.startsWith("<!", opening)) return "unsupported XML declaration";

    let quote = "";
    let closing = -1;
    for (let index = opening + 1; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (character === quote) quote = "";
      } else if (character === "\"" || character === "'") {
        quote = character;
      } else if (character === ">") {
        closing = index;
        break;
      }
    }
    if (closing === -1) return "unterminated XML tag";

    const token = source.slice(opening + 1, closing).trim();
    if (!token.startsWith("!")) {
      const isClosing = token.startsWith("/");
      const isSelfClosing = token.endsWith("/");
      const name = token.match(/^\/?\s*([A-Za-z_][\w:.-]*)/)?.[1];
      if (!name) return `invalid XML tag near byte ${opening}`;
      const syntaxError = inspectXmlTagSyntax(token);
      if (syntaxError) return `${syntaxError} near byte ${opening}`;

      if (isClosing) {
        const expected = stack.pop();
        if (expected !== name) return `closing tag </${name}> does not match <${expected ?? "none"}>`;
      } else {
        if (stack.length === 0) roots.push(name);
        if (!isSelfClosing) stack.push(name);
      }
    }
    cursor = closing + 1;
  }

  if (stack.length) return `unclosed XML tag <${stack.at(-1)}>`;
  if (roots.length !== 1 || roots[0].toLowerCase().split(":").at(-1) !== "svg") {
    return "document must contain exactly one SVG root";
  }
  return "";
};

const parseRootSvg = (source) => {
  const root = source.match(/<svg\b([^>]*)>/i);
  if (!root) return null;
  const attributes = new Map();
  for (const match of root[1].matchAll(/([A-Za-z_][\w:.-]*)\s*=\s*(["'])([\s\S]*?)\2/g)) {
    attributes.set(match[1].toLowerCase(), match[3]);
  }
  return attributes;
};

const parseInlineStyle = (source) => new Map(source.split(";").flatMap((declaration) => {
  const separator = declaration.indexOf(":");
  if (separator === -1) return [];
  return [[declaration.slice(0, separator).trim().toLowerCase(), declaration.slice(separator + 1).trim()]];
}));

const isExplicitOpaqueColor = (value) => {
  const color = value.trim().toLowerCase();
  if (!color || ["none", "transparent", "currentcolor", "inherit"].includes(color)) return false;
  if (/^#[0-9a-f]{3}$/i.test(color) || /^#[0-9a-f]{6}$/i.test(color)) return true;
  if (/^(?:rgb|hsl)\([^/]+\)$/i.test(color)) return true;
  return /^[a-z]+$/i.test(color);
};

const hasOpaqueBackgroundCanvas = (source) => {
  const root = source.match(/<svg\b[^>]*>/i);
  if (!root) return false;
  const afterRoot = source.slice((root.index ?? 0) + root[0].length)
    .replace(/^(?:\s|<!--[\s\S]*?-->)+/, "");
  const rect = afterRoot.match(/^<rect\b([^>]*)>/i);
  if (!rect) return false;
  const attributes = parseHtmlAttributes(` ${rect[1]}`);
  const style = parseInlineStyle(attributes.get("style") ?? "");
  const fill = attributes.get("fill") ?? style.get("fill") ?? "";
  const opacity = Number(attributes.get("opacity") ?? style.get("opacity") ?? "1");
  const fillOpacity = Number(attributes.get("fill-opacity") ?? style.get("fill-opacity") ?? "1");
  return attributes.get("x") === "0"
    && attributes.get("y") === "0"
    && attributes.get("width") === "100%"
    && attributes.get("height") === "100%"
    && isExplicitOpaqueColor(fill)
    && Number.isFinite(opacity)
    && opacity === 1
    && Number.isFinite(fillOpacity)
    && fillOpacity === 1;
};

const parseViewBox = (attributes) => {
  const raw = attributes?.get("viewbox");
  if (!raw) return null;
  const values = raw.trim().split(/[\s,]+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return null;
  if (values[2] <= 0 || values[3] <= 0) return null;
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
};

const getPrimaryFontSize = (svgSource, rootAttributes) => {
  const candidates = [];
  const direct = rootAttributes?.get("font-size");
  if (direct && Number.isFinite(Number.parseFloat(direct))) candidates.push(Number.parseFloat(direct));

  const withoutNonContentRules = svgSource
    .replace(/[^{}]*(?:mermaidTooltip|flowchartTitleText)[^{}]*\{[^{}]*\}/gi, "")
    .replace(/<title\b[\s\S]*?<\/title>/gi, "");
  for (const match of withoutNonContentRules.matchAll(/font-size\s*[:=]\s*["']?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:px)?/gi)) {
    const value = Number(match[1]);
    if (value > 0) candidates.push(value);
  }
  return candidates.length ? Math.min(...candidates) : null;
};

const decodeCodePoint = (match, value, radix) => {
  const codePoint = Number.parseInt(value, radix);
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : match;
};
const decodeSafetyEscapes = (source) => source
  .replace(/&#x([0-9a-f]+);?/gi, (match, value) => decodeCodePoint(match, value, 16))
  .replace(/&#([0-9]+);?/g, (match, value) => decodeCodePoint(match, value, 10))
  .replace(/\\([0-9a-f]{1,6})\s?/gi, (match, value) => decodeCodePoint(match, value, 16))
  .replace(/\\([^\n\r\f])/g, "$1");

const inspectSvgSafety = (diagram, source) => {
  const prohibited = [...source.matchAll(/<(script|iframe|object|embed|audio|video)\b/gi)]
    .map((match) => match[1].toLowerCase());
  if (prohibited.length) {
    addIssue(diagram, "TD203", `prohibited element(s): ${[...new Set(prohibited)].join(", ")}`);
  }
  if (/\son[a-z][\w:.-]*\s*=/i.test(source)) {
    addIssue(diagram, "TD204", "inline event handlers are not allowed");
  }

  const unsafeLinks = [];
  const safetySources = [...new Set([source, decodeSafetyEscapes(source)])];
  const isEmbeddedResource = (target) => /^data:(?:font\/woff2|image\/(?:png|jpeg|gif|webp));base64,/i.test(target);
  for (const safetySource of safetySources) {
    for (const match of safetySource.matchAll(/\b(?:href|xlink:href|src)\s*=\s*(["'])([\s\S]*?)\1/gi)) {
      const target = match[2].trim();
      if (target.startsWith("#") || isEmbeddedResource(target)) continue;
      unsafeLinks.push(target || "(empty target)");
    }
    for (const match of safetySource.matchAll(/url\(\s*(["']?)([^)'"\s]+)\1\s*\)/gi)) {
      const target = match[2].trim();
      if (target.startsWith("#") || isEmbeddedResource(target)) continue;
      unsafeLinks.push(target);
    }
  }
  if (unsafeLinks.length) {
    addIssue(diagram, "TD205", `external target(s): ${[...new Set(unsafeLinks)].slice(0, 3).join(", ")}`);
  }
  if (safetySources.some((safetySource) =>
    /(?:javascript\s*:|@import\b|expression\s*\(|image-set\s*\(|-moz-binding\s*:|\bbehavior\s*:)/i.test(safetySource),
  )) {
    addIssue(diagram, "TD206", "executable URL or unsafe CSS construct is not allowed");
  }
};

const detectMermaidKind = (source) => {
  const firstDeclaration = source.split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("%%") && !line.startsWith("---"));
  if (/^sequenceDiagram\b/i.test(firstDeclaration ?? "")) return "sequence";
  if (/^stateDiagram(?:-v2)?\b/i.test(firstDeclaration ?? "")) return "state";
  if (/^(?:flowchart|graph)\b/i.test(firstDeclaration ?? "")) return "flowchart";
  return "unknown";
};

const countArrowTokens = (source, kind) => {
  const withoutComments = source.replace(/^\s*%%.*$/gm, "");
  if (kind === "sequence") return [...withoutComments.matchAll(/(?:--|-|==)>{1,2}|(?:--|-|==)x/g)].length;
  return [...withoutComments.matchAll(/<-->|<==>|-\.->|==>|-->|---/g)].length;
};

const collectFlowchartNodes = (source) => {
  const identifiers = new Set();
  const subgraphs = new Set(
    [...source.matchAll(/^\s*subgraph\s+([A-Za-z_][\w-]*)/gmi)].map((match) => match[1]),
  );
  const withoutComments = source.replace(/^\s*%%.*$/gm, "");
  for (const match of withoutComments.matchAll(/\b([A-Za-z_][\w-]*)\s*(?=\[\[|\[\(|\[|\(\(|\(|\{\{|\{|>)/g)) {
    const identifier = match[1];
    if (!["flowchart", "graph", "subgraph"].includes(identifier.toLowerCase())) identifiers.add(identifier);
  }
  const arrow = "(?:<-->|<==>|-\\.->|==>|-->|---)";
  for (const match of withoutComments.matchAll(new RegExp(`\\b([A-Za-z_][\\w-]*)\\s*(?=${arrow})`, "g"))) {
    identifiers.add(match[1]);
  }
  for (const match of withoutComments.matchAll(new RegExp(`${arrow}\\s*(?:\\|[^|]*\\|\\s*)?([A-Za-z_][\\w-]*)`, "g"))) {
    identifiers.add(match[1]);
  }
  for (const subgraph of subgraphs) identifiers.delete(subgraph);
  return identifiers.size;
};

const collectStateNodes = (source) => {
  const identifiers = new Set();
  for (const line of source.split("\n")) {
    if (!line.includes("-->")) continue;
    const [left, right = ""] = line.split("-->", 2);
    const sourceNode = left.trim().split(/\s+/).at(-1);
    const targetNode = right.trim().split(/[:\s]/, 1)[0];
    for (const identifier of [sourceNode, targetNode]) {
      if (identifier && identifier !== "[*]") identifiers.add(identifier);
    }
  }
  return identifiers.size;
};

const collectSequenceParticipants = (source) => {
  const participants = new Set();
  for (const match of source.matchAll(/^\s*(?:participant|actor)\s+([^\s]+)(?:\s+as\s+.+)?$/gmi)) {
    participants.add(match[1]);
  }
  if (participants.size) return participants.size;
  for (const match of source.matchAll(/^\s*([^\s:]+)\s*(?:--|-|==)>{1,2}\s*([^\s:]+)\s*:/gm)) {
    participants.add(match[1]);
    participants.add(match[2]);
  }
  return participants.size;
};

const sourceMetrics = (source, kind) => {
  const sequenceParticipants = kind === "sequence" ? collectSequenceParticipants(source) : 0;
  const nodes = kind === "flowchart"
    ? collectFlowchartNodes(source)
    : kind === "state"
      ? collectStateNodes(source)
      : kind === "sequence"
        ? sequenceParticipants
        : 0;
  return {
    nodes,
    edges: countArrowTokens(source, kind),
    sequenceParticipants,
  };
};

const excalidrawSourceMetrics = (scene) => {
  const elements = scene.elements.filter((element) => !element.isDeleted);
  const relationshipTypes = new Set(["arrow"]);
  const nonNodeTypes = new Set(["arrow", "line", "freedraw", "text"]);
  return {
    nodes: elements.filter((element) => !nonNodeTypes.has(element.type)).length,
    edges: elements.filter((element) => relationshipTypes.has(element.type)).length,
    sequenceParticipants: 0,
  };
};

const validateScorecard = (diagram, scorecard) => {
  for (const error of validateDiagramScorecard(scorecard)) {
    addIssue(diagram, error.kind === "quality" ? "TD407" : "TD406", error.message, error.scope);
  }
};

const validateContract = (diagram) => {
  if (!diagram.contractPath) {
    addIssue(diagram, "TD401", `missing ${diagram.stem}.diagram.json`);
    return;
  }

  let contract;
  try {
    contract = readJson(diagram.contractPath);
  } catch (error) {
    addIssue(diagram, "TD402", `${relativeRepositoryPath(diagram.contractPath)}: ${error.message}`);
    return;
  }
  if (!contract || Array.isArray(contract) || typeof contract !== "object") {
    addIssue(diagram, "TD402", `${relativeRepositoryPath(diagram.contractPath)} must contain one JSON object`);
    return;
  }
  diagram.contract = contract;

  for (const field of CONTRACT_FIELDS) {
    const value = contract[field];
    let valid = isNonEmptyString(value);
    if (field === "evidence") {
      valid = Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
    } else if (field === "localeScope") {
      valid = isNonEmptyString(value)
        || (Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString));
    } else if (field === "presentation") {
      valid = isNonEmptyString(value)
        || (value && !Array.isArray(value) && typeof value === "object" && Object.keys(value).length > 0);
    }
    if (!valid) {
      addIssue(diagram, "TD403", `contract field '${field}' must be present and non-empty`, field);
    }
  }

  if (isNonEmptyString(contract.kind) && !CONTRACT_KINDS.has(contract.kind)) {
    addIssue(diagram, "TD404", `unsupported kind '${contract.kind}'`, "kind");
  }
  if (isNonEmptyString(contract.outcome) && !CONTRACT_OUTCOMES.has(contract.outcome)) {
    addIssue(diagram, "TD404", `unsupported outcome '${contract.outcome}'`, "outcome");
  } else if (isNonEmptyString(contract.outcome) && contract.outcome !== "pass") {
    addIssue(
      diagram,
      "TD408",
      `outcome '${contract.outcome}' is legacy debt; full-strict acceptance requires 'pass'`,
      "outcome",
    );
  }
  validateScorecard(diagram, contract.scorecard);
  if (diagram.kind === "sequence" && contract.kind !== "sequence") {
    addIssue(diagram, "TD405", `sequenceDiagram source requires contract kind 'sequence'`);
  }
  if (diagram.kind === "state" && contract.kind !== "state") {
    addIssue(diagram, "TD405", `stateDiagram source requires contract kind 'state'`);
  }
  if (diagram.kind === "flowchart" && ["sequence", "state"].includes(contract.kind)) {
    addIssue(diagram, "TD405", `flowchart source cannot use contract kind '${contract.kind}'`);
  }
};

const hasExplicitDetailTreatment = (contract) => {
  const presentation = contract?.presentation;
  const acceptedModes = new Set(["detail", "split", "wrapped", "zoom", "scroll"]);
  if (isNonEmptyString(presentation)) return acceptedModes.has(presentation.trim().toLowerCase());
  if (!presentation || Array.isArray(presentation) || typeof presentation !== "object") return false;
  if (presentation.detail === true || presentation.zoom === true) return true;
  return isNonEmptyString(presentation.mode)
    && acceptedModes.has(presentation.mode.trim().toLowerCase());
};

const diagramFiles = existsSync(diagramsRoot)
  ? walk(diagramsRoot).map((target) => path.relative(diagramsRoot, target).replaceAll(path.sep, "/"))
  : [];
const diagramByStem = new Map();
const ensureDiagram = (stem) => {
  if (!diagramByStem.has(stem)) {
    diagramByStem.set(stem, {
      stem,
      sources: [],
      svgPath: null,
      contractPath: null,
      references: [],
      kind: "unknown",
      metrics: {},
    });
  }
  return diagramByStem.get(stem);
};

for (const filename of diagramFiles) {
  const target = path.join(diagramsRoot, filename);
  if (target === baselinePath) continue;
  const extension = filename.endsWith(".diagram.json")
    ? ".diagram.json"
    : path.extname(filename).toLowerCase();
  if (![".mmd", ".excalidraw", ".svg", ".diagram.json"].includes(extension)) continue;
  const stem = filename.slice(0, -extension.length);
  const diagram = ensureDiagram(stem);
  if (extension === ".svg") diagram.svgPath = target;
  else if (extension === ".diagram.json") diagram.contractPath = target;
  else diagram.sources.push({ extension, path: target });
}

const markdownPaths = existsSync(docsRoot) ? walk(docsRoot).filter((target) => target.endsWith(".md")) : [];
const markdownRenderer = await createMarkdownRenderer(docsRoot);
for (const markdownPath of markdownPaths) {
  for (const reference of parseMarkdownImages(markdownPath, markdownRenderer)) {
    const stem = path.relative(diagramsRoot, reference.resolved)
      .replaceAll(path.sep, "/")
      .replace(/\.svg$/i, "");
    ensureDiagram(stem).references.push(reference);
  }
}
disposeMdItInstance();

const diagrams = [...diagramByStem.values()].sort((left, right) => left.stem.localeCompare(right.stem));

for (const diagram of diagrams) {
  if (diagram.references.length && !diagram.svgPath) {
    addIssue(diagram, "TD107", `${relativeRepositoryPath(diagram.references[0].markdownPath)} references missing ${diagram.stem}.svg`);
  }
  if (!diagram.sources.length && diagram.svgPath) {
    addIssue(diagram, "TD101", `${relativeRepositoryPath(diagram.svgPath)} has no .mmd or .excalidraw source`);
  }
  if (diagram.sources.length && !diagram.svgPath) {
    addIssue(diagram, "TD102", `${relativeRepositoryPath(diagram.sources[0].path)} has no matching SVG`);
  }
  if (diagram.sources.length > 1) {
    addIssue(diagram, "TD103", `found sources: ${diagram.sources.map((source) => path.basename(source.path)).join(", ")}`);
  }
  if (diagram.contractPath && !diagram.sources.length && !diagram.svgPath) {
    addIssue(diagram, "TD108", `${relativeRepositoryPath(diagram.contractPath)} has no editable source or rendered SVG`);
  }

  const editableSource = diagram.sources.length === 1 ? diagram.sources[0] : null;
  let editableSourceText = "";
  if (editableSource) {
    editableSourceText = readFileSync(editableSource.path, "utf8");
    if (editableSource.extension === ".mmd") {
      diagram.kind = detectMermaidKind(editableSourceText);
      for (const error of validateMermaidSourceSafety(editableSourceText)) {
        addIssue(
          diagram,
          "TD111",
          `${relativeRepositoryPath(editableSource.path)}: ${error}`,
        );
      }
      if (!editableSourceText.trim() || diagram.kind === "unknown") {
        addIssue(diagram, "TD104", `${relativeRepositoryPath(editableSource.path)} does not start with a supported Mermaid declaration`);
      } else {
        Object.assign(diagram.metrics, sourceMetrics(editableSourceText, diagram.kind));
      }
    } else if (editableSource.extension === ".excalidraw") {
      diagram.kind = "excalidraw";
      if (!excalidrawPipelineAvailable) {
        addIssue(
          diagram,
          "TD105",
          `pipeline unavailable: ${excalidrawPipeline.errors.join("; ")}`,
        );
      }
      try {
        const scene = JSON.parse(editableSourceText);
        const sceneErrors = validateExcalidrawScene(scene);
        if (sceneErrors.length) throw new Error(sceneErrors.join("; "));
        Object.assign(diagram.metrics, excalidrawSourceMetrics(scene));
      } catch (error) {
        addIssue(diagram, "TD106", `${relativeRepositoryPath(editableSource.path)}: ${error.message}`);
      }
    }
  }

  validateContract(diagram);

  if (diagram.svgPath) {
    const svgSource = readFileSync(diagram.svgPath, "utf8");
    const structureError = inspectXmlStructure(svgSource);
    if (structureError) addIssue(diagram, "TD201", `${relativeRepositoryPath(diagram.svgPath)}: ${structureError}`);

    const rootAttributes = parseRootSvg(svgSource);
    if (!rootAttributes) {
      if (!structureError) addIssue(diagram, "TD201", `${relativeRepositoryPath(diagram.svgPath)} has no SVG root`);
    } else {
      const viewBox = parseViewBox(rootAttributes);
      if (!viewBox) {
        addIssue(diagram, "TD202", `${relativeRepositoryPath(diagram.svgPath)} has invalid or missing viewBox`);
      } else {
        const aspectRatio = viewBox.width / viewBox.height;
        const projectedHeightPx = CONTENT_WIDTH_PX / aspectRatio;
        const primaryFontPx = getPrimaryFontSize(svgSource, rootAttributes);
        diagram.metrics.aspectRatio = aspectRatio;
        diagram.metrics.projectedHeightPx = projectedHeightPx;
        diagram.metrics.sourceFontPx = primaryFontPx;
        diagram.metrics.projectedFontPx = Number.isFinite(primaryFontPx)
          ? primaryFontPx * CONTENT_WIDTH_PX / viewBox.width
          : null;

        const outsidePreferredAspect = aspectRatio < PREFERRED_ASPECT_MIN || aspectRatio > PREFERRED_ASPECT_MAX;
        const outsideInlineAspect = aspectRatio < INLINE_ASPECT_MIN || aspectRatio > INLINE_ASPECT_MAX;
        if (outsidePreferredAspect && (outsideInlineAspect || !hasExplicitDetailTreatment(diagram.contract))) {
          const disposition = outsideInlineAspect
            ? "rejected for direct inline use"
            : "requires split, wrap, or explicit detail treatment";
          addIssue(diagram, "TD310", `aspect ${formatMetric(aspectRatio)} is outside ${PREFERRED_ASPECT_MIN}-${PREFERRED_ASPECT_MAX}; ${disposition}`);
        }
        if (projectedHeightPx < PROJECTED_HEIGHT_MIN_PX || projectedHeightPx > PROJECTED_HEIGHT_MAX_PX) {
          addIssue(diagram, "TD311", `projected height ${formatMetric(projectedHeightPx)}px is outside ${PROJECTED_HEIGHT_MIN_PX}-${PROJECTED_HEIGHT_MAX_PX}px`);
        }
        if (Number.isFinite(diagram.metrics.projectedFontPx)
          && diagram.metrics.projectedFontPx < PROJECTED_FONT_MIN_PX) {
          addIssue(diagram, "TD312", `projected primary text ${formatMetric(diagram.metrics.projectedFontPx)}px is below ${PROJECTED_FONT_MIN_PX}px`);
        } else if (!Number.isFinite(diagram.metrics.projectedFontPx)) {
          addIssue(diagram, "TD313", "add an explicit SVG font-size so projected readability can be checked");
        }
      }
    }
    inspectSvgSafety(diagram, svgSource);
    if (editableSource && !hasOpaqueBackgroundCanvas(svgSource)) {
      addIssue(diagram, "TD207", `${relativeRepositoryPath(diagram.svgPath)} must begin with an opaque full-canvas background rect`);
    }
  }

  if (!diagram.references.length && diagram.svgPath) {
    addIssue(diagram, "TD301", `${relativeRepositoryPath(diagram.svgPath)} is not used by any docs/**/*.md page`);
  }
  for (const reference of diagram.references) {
    const scope = reference.referenceScope;
    const location = `${relativeRepositoryPath(reference.markdownPath)}${reference.line ? `:${reference.line}` : ""}`;
    if (!reference.alt) {
      addIssue(diagram, "TD302", `${location} references the diagram without alt text`, scope);
    } else if (isGenericAlt(reference.alt, reference.nearestHeading)) {
      addIssue(diagram, "TD303", `${location} alt '${reference.alt}' repeats the nearest heading`, scope);
    } else if (isLowInformationAlt(reference.alt)) {
      addIssue(diagram, "TD303", `${location} alt '${reference.alt}' has fewer than ${ALT_INFORMATION_MIN_CHARS} meaningful characters`, scope);
    }
    const captionIssue = validateVisibleDiagramCaption(reference);
    if (captionIssue === "missing") {
      addIssue(diagram, "TD304", `${location} requires a visible caption title`, scope);
    } else if (captionIssue === "matches-alt") {
      addIssue(diagram, "TD304", `${location} caption must add a conclusion beyond the alt text`, scope);
    } else if (captionIssue === "matches-heading") {
      addIssue(diagram, "TD304", `${location} caption must not repeat the nearest heading`, scope);
    }
  }

  if (Number.isFinite(diagram.metrics.nodes) && diagram.metrics.nodes > PRIMARY_NODE_MAX) {
    addIssue(diagram, "TD320", `${diagram.metrics.nodes} primary nodes exceeds ${PRIMARY_NODE_MAX}`);
  }
  if (Number.isFinite(diagram.metrics.edges) && diagram.metrics.edges > PRIMARY_EDGE_MAX) {
    addIssue(diagram, "TD321", `${diagram.metrics.edges} primary relationships exceeds ${PRIMARY_EDGE_MAX}`);
  }
  if (Number.isFinite(diagram.metrics.sequenceParticipants)
    && diagram.metrics.sequenceParticipants > SEQUENCE_PARTICIPANT_MAX) {
    addIssue(diagram, "TD322", `${diagram.metrics.sequenceParticipants} participants exceeds ${SEQUENCE_PARTICIPANT_MAX}`);
  }
}

const baselinePolicyError = validateQualityBaselinePolicy(existsSync(baselinePath));
if (baselinePolicyError) {
  addIssue(null, "TD905", `${relativeRepositoryPath(baselinePath)}: ${baselinePolicyError}`);
}

const classifications = issues.map((issue) => {
  const classification = classifyDiagramIssue(issue);
  return { ...issue, ...classification };
});

console.log(`Diagram governance ${reportOnly ? "report" : "lint"} (policy ${POLICY_VERSION})`);
console.log(`Content projection: ${CONTENT_WIDTH_PX}px wide; Excalidraw pipeline: ${excalidrawPipelineAvailable ? "available" : "not configured"}`);
console.log(`Quality baseline: ${existsSync(baselinePath) ? `${relativeRepositoryPath(baselinePath)} (forbidden)` : "absent (full strict mode)"}`);
for (const diagram of diagrams) {
  const metrics = diagram.metrics;
  const source = diagram.sources.length === 1 ? diagram.sources[0].extension.slice(1) : `${diagram.sources.length} sources`;
  console.log(`\n${diagram.stem} [${source}/${diagram.kind}] refs=${diagram.references.length}`);
  const height = Number.isFinite(metrics.projectedHeightPx) ? `${formatMetric(metrics.projectedHeightPx)}px` : "n/a";
  const font = Number.isFinite(metrics.projectedFontPx) ? `${formatMetric(metrics.projectedFontPx)}px` : "n/a";
  console.log(`  aspect=${formatMetric(metrics.aspectRatio)} height=${height} font=${font} nodes=${formatMetric(metrics.nodes)} edges=${formatMetric(metrics.edges)} participants=${formatMetric(metrics.sequenceParticipants)}`);
  for (const issue of classifications.filter((candidate) => candidate.stem === diagram.stem)) {
    console.log(`  ${reportOnly && !issue.legacy && !issue.advisory ? "NEW" : issue.level} ${issue.key} ${issue.message}`);
  }
}
for (const issue of classifications.filter((candidate) => candidate.stem === "@repository")) {
  console.log(`\n${reportOnly && !issue.legacy && !issue.advisory ? "NEW" : issue.level} ${issue.key} ${issue.message}`);
}

const legacyCount = classifications.filter((issue) => issue.legacy).length;
const advisoryCount = classifications.filter((issue) => issue.advisory).length;
const errorCount = classifications.filter((issue) => !issue.legacy && !issue.advisory).length;
const referenceCount = diagrams.reduce((sum, diagram) => sum + diagram.references.length, 0);
console.log(`\nSummary: ${diagrams.length} diagrams, ${referenceCount} Markdown references, ${legacyCount} legacy warnings, ${advisoryCount} notes, ${errorCount} errors.`);

if (!reportOnly && errorCount) process.exit(1);
console.log(reportOnly ? "Report completed (issues do not fail --report)." : "Diagram lint passed without new debt or regressions.");
