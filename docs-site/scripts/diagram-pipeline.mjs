import { existsSync, readFileSync, readdirSync } from "node:fs";
import { Buffer } from "node:buffer";
import path from "node:path";

export const EXCALIDRAW_PIPELINE = Object.freeze({
  version: 1,
  packageVersions: Object.freeze({
    "@excalidraw/excalidraw": "0.18.1",
    esbuild: "0.25.12",
    react: "19.0.0",
    "react-dom": "19.0.0",
  }),
  canaryPath: "tests/fixtures/diagrams/deterministic.excalidraw",
  exportPadding: 20,
});

export const SCORECARD_MINIMUM = 85;
export const SCORECARD_DIMENSIONS = Object.freeze({
  necessity: 20,
  technicalCorrectness: 25,
  readability: 20,
  hierarchy: 15,
  terminology: 10,
  accessibility: 5,
  maintainability: 5,
});

const COMMON_ELEMENT_FIELDS = Object.freeze([
  "id",
  "type",
  "x",
  "y",
  "width",
  "height",
  "angle",
  "strokeColor",
  "backgroundColor",
  "fillStyle",
  "strokeWidth",
  "strokeStyle",
  "roughness",
  "opacity",
  "groupIds",
  "frameId",
  "index",
  "roundness",
  "seed",
  "version",
  "versionNonce",
  "isDeleted",
  "boundElements",
  "updated",
  "link",
  "locked",
]);

const LINEAR_ELEMENT_TYPES = new Set(["arrow", "line"]);
const LOCAL_FONT_FAMILIES = new Set([1, 3, 4, 5, 6, 7, 8, 9]);
const SAFE_EMBEDDED_IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_EMBEDDED_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_EMBEDDED_IMAGE_DATA_URL_CHARS = Math.ceil(MAX_EMBEDDED_IMAGE_BYTES / 3) * 4 + 64;
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isObject = (value) => value !== null && !Array.isArray(value) && typeof value === "object";
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isInteger = (value) => Number.isInteger(value) && Number.isFinite(value);
const isStringOrNull = (value) => value === null || typeof value === "string";

export const validateDiagramScorecard = (scorecard) => {
  if (!isObject(scorecard)) {
    return [{ kind: "schema", scope: "scorecard", message: "contract field 'scorecard' must be an object" }];
  }

  const expectedFields = [...Object.keys(SCORECARD_DIMENSIONS), "total"].sort();
  const actualFields = Object.keys(scorecard).sort();
  if (actualFields.length !== expectedFields.length
    || actualFields.some((field, index) => field !== expectedFields[index])) {
    return [{
      kind: "schema",
      scope: "scorecard.fields",
      message: `scorecard must contain exactly: ${expectedFields.join(", ")}`,
    }];
  }

  const errors = [];
  for (const [field, maximum] of Object.entries(SCORECARD_DIMENSIONS)) {
    const value = scorecard[field];
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > maximum) {
      errors.push({
        kind: "schema",
        scope: `scorecard.${field}`,
        message: `scorecard.${field} must be an integer from 0 through ${maximum}`,
      });
    }
  }
  if (!Number.isFinite(scorecard.total) || !Number.isInteger(scorecard.total)) {
    errors.push({
      kind: "schema",
      scope: "scorecard.total",
      message: "scorecard.total must be a finite integer",
    });
  }
  if (errors.length) return errors;

  const calculatedTotal = Object.keys(SCORECARD_DIMENSIONS)
    .reduce((sum, field) => sum + scorecard[field], 0);
  if (scorecard.total !== calculatedTotal) {
    return [{
      kind: "quality",
      scope: "scorecard.total",
      message: `scorecard.total ${scorecard.total} does not equal the dimension sum ${calculatedTotal}`,
    }];
  }
  if (scorecard.total < SCORECARD_MINIMUM) {
    return [{
      kind: "quality",
      scope: "scorecard.total",
      message: `scorecard.total ${scorecard.total} is below the ${SCORECARD_MINIMUM}/100 acceptance threshold`,
    }];
  }
  return [];
};

export const classifyDiagramIssue = (issue) => {
  const level = issue.advisory ? "NOTE" : "ERROR";
  return { legacy: false, level };
};

export const validateQualityBaselinePolicy = (baselinePresent) => (
  baselinePresent
    ? "policy 1 is baseline-free; remove quality-baseline.json instead of grandfathering diagram debt"
    : null
);

const decodeSourceEscapes = (source) => source
  .replace(/&#x([0-9a-f]+);?/gi, (match, value) => {
    const codePoint = Number.parseInt(value, 16);
    return Number.isInteger(codePoint) && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : match;
  })
  .replace(/&#([0-9]+);?/g, (match, value) => {
    const codePoint = Number.parseInt(value, 10);
    return Number.isInteger(codePoint) && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : match;
  })
  .replace(/\\([0-9a-f]{1,6})\s?/gi, (match, value) => {
    const codePoint = Number.parseInt(value, 16);
    return Number.isInteger(codePoint) && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : match;
  });

const MERMAID_SOURCE_SAFETY_RULES = Object.freeze([
  {
    pattern: /(?:^|[^\w])(?:(?:https?|ftp|ws|wss):\/\/|file:(?:\/\/|\/)|(?:data|blob|javascript|vbscript):)/i,
    message: "URI schemes are not allowed in Mermaid sources",
  },
  {
    pattern: /(?:^|["'(\s=:])\/\/(?:[a-z0-9.-]+|\[[0-9a-f:]+\])(?::\d+)?(?:[/?#]|$)/im,
    message: "protocol-relative URLs are not allowed in Mermaid sources",
  },
  {
    pattern: /\bimg\s*:/i,
    message: "Mermaid image shapes are not allowed; diagrams must be self-contained SVG",
  },
  {
    pattern: /^\s*(?:click|link|links)\b/im,
    message: "interactive Mermaid links are not allowed",
  },
  {
    pattern: /!\[[^\]\n]*\]\s*(?:\([^\n)]*\)|\[[^\n\]]*\])/i,
    message: "Markdown images are not allowed inside Mermaid labels",
  },
  {
    pattern: /<\s*(?:a|audio|embed|iframe|image|img|link|object|script|style|video)\b/i,
    message: "resource-loading or active HTML is not allowed in Mermaid labels",
  },
  {
    pattern: /\bon[a-z][\w:.-]*\s*=|@import\b|\burl\s*\(|expression\s*\(|image-set\s*\(|-moz-binding\s*:|\bbehavior\s*:/i,
    message: "active or resource-loading CSS/HTML is not allowed in Mermaid sources",
  },
]);

export const validateMermaidSourceSafety = (source) => {
  const variants = [...new Set([String(source ?? ""), decodeSourceEscapes(String(source ?? ""))])];
  return MERMAID_SOURCE_SAFETY_RULES
    .filter(({ pattern }) => variants.some((variant) => pattern.test(variant)))
    .map(({ message }) => message);
};

export const assertValidMermaidSourceSafety = (source, label = "Mermaid source") => {
  const errors = validateMermaidSourceSafety(source);
  if (errors.length) throw new Error(`${label}: ${errors.join("; ")}`);
};

const decodeEmbeddedImage = (dataUrl) => {
  const match = String(dataUrl ?? "").match(
    /^data:(image\/(?:gif|jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/,
  );
  if (!match || match[2].length % 4 !== 0) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.toString("base64") !== match[2]) return null;
  return { bytes, mimeType: match[1] };
};

const hasMatchingImageSignature = ({ bytes, mimeType }) => {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/gif") {
    const signature = bytes.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12
      && bytes.subarray(0, 4).toString("ascii") === "RIFF"
      && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
};

export const validateExcalidrawScene = (scene) => {
  const errors = [];
  if (!isObject(scene)) return ["scene must be a JSON object"];
  if (scene.type !== "excalidraw") errors.push("scene.type must be 'excalidraw'");
  if (scene.version !== 2) errors.push("scene.version must be 2");
  if (!Array.isArray(scene.elements) || scene.elements.length === 0) {
    errors.push("scene.elements must be a non-empty array");
    return errors;
  }
  if (!isObject(scene.appState)) errors.push("scene.appState must be an object");
  if (!isObject(scene.files)) errors.push("scene.files must be an object");

  const files = isObject(scene.files) ? scene.files : {};
  const liveImageFileIds = new Set();
  const allImageFileIds = new Set();

  const elementIds = new Set();
  for (const [index, element] of scene.elements.entries()) {
    const prefix = `elements[${index}]`;
    if (!isObject(element)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    const missing = COMMON_ELEMENT_FIELDS.filter((field) => !hasOwn(element, field));
    if (missing.length) errors.push(`${prefix} is missing deterministic fields: ${missing.join(", ")}`);

    if (typeof element.id !== "string" || !element.id.trim()) {
      errors.push(`${prefix}.id must be a non-empty string`);
    } else if (elementIds.has(element.id)) {
      errors.push(`${prefix}.id '${element.id}' is duplicated`);
    } else {
      elementIds.add(element.id);
    }
    if (typeof element.type !== "string" || !element.type.trim()) errors.push(`${prefix}.type must be a non-empty string`);
    for (const field of ["x", "y", "width", "height", "angle", "strokeWidth", "roughness", "opacity"]) {
      if (!isFiniteNumber(element[field])) errors.push(`${prefix}.${field} must be finite`);
    }
    if (isFiniteNumber(element.width) && element.width < 0) errors.push(`${prefix}.width cannot be negative`);
    if (isFiniteNumber(element.height) && element.height < 0) errors.push(`${prefix}.height cannot be negative`);
    for (const field of ["seed", "version", "versionNonce", "updated"]) {
      if (!isInteger(element[field])) errors.push(`${prefix}.${field} must be a finite integer`);
    }
    if (typeof element.index !== "string" || !element.index) errors.push(`${prefix}.index must be explicit`);
    if (!Array.isArray(element.groupIds) || element.groupIds.some((id) => typeof id !== "string")) {
      errors.push(`${prefix}.groupIds must be a string array`);
    }
    if (!isStringOrNull(element.frameId)) errors.push(`${prefix}.frameId must be a string or null`);
    if (!isStringOrNull(element.link)) errors.push(`${prefix}.link must be a string or null`);
    if (typeof element.link === "string" && element.link.trim() && !element.link.trim().startsWith("#")) {
      errors.push(`${prefix}.link must be null, empty, or an internal fragment`);
    }
    if (typeof element.isDeleted !== "boolean") errors.push(`${prefix}.isDeleted must be boolean`);
    if (typeof element.locked !== "boolean") errors.push(`${prefix}.locked must be boolean`);
    if (element.boundElements !== null && !Array.isArray(element.boundElements)) {
      errors.push(`${prefix}.boundElements must be an array or null`);
    }

    if (element.type === "text") {
      for (const field of ["text", "originalText", "textAlign", "verticalAlign"]) {
        if (typeof element[field] !== "string") errors.push(`${prefix}.${field} must be a string`);
      }
      for (const field of ["fontSize", "lineHeight"]) {
        if (!isFiniteNumber(element[field]) || element[field] <= 0) errors.push(`${prefix}.${field} must be positive and finite`);
      }
      if (!LOCAL_FONT_FAMILIES.has(element.fontFamily)) {
        errors.push(`${prefix}.fontFamily must use a font shipped by the pinned Excalidraw package`);
      }
      if (!isStringOrNull(element.containerId)) errors.push(`${prefix}.containerId must be a string or null`);
      if (typeof element.autoResize !== "boolean") errors.push(`${prefix}.autoResize must be boolean`);
    }

    if (LINEAR_ELEMENT_TYPES.has(element.type)) {
      if (!Array.isArray(element.points)
        || element.points.length < 2
        || element.points.some((point) => !Array.isArray(point)
          || point.length !== 2
          || point.some((coordinate) => !isFiniteNumber(coordinate)))) {
        errors.push(`${prefix}.points must contain at least two finite [x, y] pairs`);
      }
      for (const field of ["startBinding", "endBinding", "startArrowhead", "endArrowhead"]) {
        if (!hasOwn(element, field)) errors.push(`${prefix}.${field} must be explicit`);
      }
    }

    if (element.type === "freedraw") {
      if (!Array.isArray(element.points) || !Array.isArray(element.pressures)) {
        errors.push(`${prefix} freedraw points and pressures must be explicit arrays`);
      }
    }
    if (element.type === "image") {
      if (typeof element.fileId !== "string" || !element.fileId) {
        errors.push(`${prefix}.fileId must identify an embedded scene file`);
      } else {
        allImageFileIds.add(element.fileId);
        if (!element.isDeleted) liveImageFileIds.add(element.fileId);
      }
    }
  }

  for (const [fileId, file] of Object.entries(files)) {
    const prefix = `files[${JSON.stringify(fileId)}]`;
    if (!isObject(file)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    if (file.id !== fileId) errors.push(`${prefix}.id must exactly match its files key`);
    if (!SAFE_EMBEDDED_IMAGE_MIME_TYPES.has(file.mimeType)) {
      errors.push(`${prefix}.mimeType must be a supported raster image MIME type`);
    }
    if (!isInteger(file.created) || file.created < 0) {
      errors.push(`${prefix}.created must be a non-negative finite integer`);
    }
    if (hasOwn(file, "lastRetrieved")
      && (!isInteger(file.lastRetrieved) || file.lastRetrieved < 0)) {
      errors.push(`${prefix}.lastRetrieved must be a non-negative finite integer when present`);
    }

    const dataUrlTooLarge = typeof file.dataURL === "string"
      && file.dataURL.length > MAX_EMBEDDED_IMAGE_DATA_URL_CHARS;
    const decoded = dataUrlTooLarge ? null : decodeEmbeddedImage(file.dataURL);
    if (dataUrlTooLarge) {
      errors.push(`${prefix}.dataURL exceeds the ${MAX_EMBEDDED_IMAGE_BYTES}-byte limit`);
    } else if (!decoded) {
      errors.push(`${prefix}.dataURL must be canonical base64 for PNG, JPEG, GIF, or WebP`);
    } else {
      if (decoded.mimeType !== file.mimeType) {
        errors.push(`${prefix}.dataURL MIME type must match mimeType`);
      }
      if (decoded.bytes.length > MAX_EMBEDDED_IMAGE_BYTES) {
        errors.push(`${prefix}.dataURL exceeds the ${MAX_EMBEDDED_IMAGE_BYTES}-byte limit`);
      }
      if (!hasMatchingImageSignature(decoded)) {
        errors.push(`${prefix}.dataURL bytes do not match the declared raster image type`);
      }
    }
    if (!liveImageFileIds.has(fileId)) {
      errors.push(`${prefix} must be referenced by a non-deleted image element`);
    }
  }

  for (const fileId of allImageFileIds) {
    if (!hasOwn(files, fileId)) {
      errors.push(`image fileId '${fileId}' has no matching scene.files record`);
    }
  }

  return [...new Set(errors)];
};

export const assertValidExcalidrawScene = (scene, label = "Excalidraw scene") => {
  const errors = validateExcalidrawScene(scene);
  if (errors.length) throw new Error(`${label}: ${errors.join("; ")}`);
};

export const validateRenderedExcalidrawSvg = (source) => {
  const errors = [];
  const viewBox = source.match(/<svg\b[^>]*\bviewBox=(['"])([^'"]+)\1/i)?.[2]
    ?.trim()
    ?.split(/[\s,]+/)
    ?.map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value))
    || viewBox[2] <= 0 || viewBox[3] <= 0) {
    errors.push("rendered SVG requires a finite positive viewBox");
  }
  if (!/<svg\b[^>]*><rect\s+data-diagram-background="true"\s+x="0"\s+y="0"\s+width="100%"\s+height="100%"\s+fill="#ffffff"/i.test(source)) {
    errors.push("rendered SVG requires the explicit opaque canvas as its first child");
  }
  if (/<text\b/i.test(source) && !/url\(data:font\/woff2;base64,/i.test(source)) {
    errors.push("rendered text requires a pinned local WOFF2 font embedded as data");
  }
  if (/<(?:script|iframe|object|embed|audio|video)\b/i.test(source)
    || /\son[a-z][\w:.-]*\s*=/i.test(source)
    || /(?:javascript\s*:|@import\b|expression\s*\()/i.test(source)) {
    errors.push("rendered SVG contains active or executable content");
  }
  const resourceTargets = [
    ...source.matchAll(/\b(?:href|xlink:href|src)\s*=\s*(['"])([\s\S]*?)\1/gi),
    ...source.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi),
  ].map((match) => match[2].trim());
  const unsafeTarget = resourceTargets.find((target) => !target.startsWith("#")
    && !/^data:(?:font\/woff2|image\/(?:png|jpeg|gif|webp));base64,/i.test(target));
  if (unsafeTarget) errors.push(`rendered SVG contains an external resource target: ${unsafeTarget}`);
  return errors;
};

export const assertValidRenderedExcalidrawSvg = (source, label = "Excalidraw SVG") => {
  const errors = validateRenderedExcalidrawSvg(source);
  if (errors.length) throw new Error(`${label}: ${errors.join("; ")}`);
};

const readJsonIfPresent = (target) => {
  if (!existsSync(target)) return null;
  try {
    return JSON.parse(readFileSync(target, "utf8"));
  } catch {
    return null;
  }
};

export const inspectExcalidrawPipeline = (siteRoot) => {
  const errors = [];
  const sitePackage = readJsonIfPresent(path.join(siteRoot, "package.json"));
  if (!sitePackage) return { available: false, errors: ["docs-site/package.json is missing or invalid"] };

  for (const [packageName, version] of Object.entries(EXCALIDRAW_PIPELINE.packageVersions)) {
    if (sitePackage.devDependencies?.[packageName] !== version) {
      errors.push(`${packageName} must be pinned exactly to ${version}`);
    }
    const installedPackage = readJsonIfPresent(path.join(siteRoot, "node_modules", packageName, "package.json"));
    if (installedPackage?.version !== version) errors.push(`installed ${packageName}@${version} is required`);
  }

  if (sitePackage.scripts?.["diagrams:check"] !== "node scripts/render-diagrams.mjs --check") {
    errors.push("diagrams:check must execute the deterministic renderer in --check mode");
  }
  const canaryPath = path.join(siteRoot, EXCALIDRAW_PIPELINE.canaryPath);
  if (!existsSync(canaryPath)) errors.push(`pipeline canary is missing: ${EXCALIDRAW_PIPELINE.canaryPath}`);

  const fontRoot = path.join(
    siteRoot,
    "node_modules",
    "@excalidraw",
    "excalidraw",
    "dist",
    "prod",
    "fonts",
    "Excalifont",
  );
  if (!existsSync(fontRoot)
    || !readdirSync(fontRoot).some((filename) => filename.endsWith(".woff2"))) {
    errors.push("pinned local Excalifont WOFF2 assets are missing");
  }
  return { available: errors.length === 0, errors };
};
