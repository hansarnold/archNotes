const parseHtmlAttributes = (source) => {
  const attributes = new Map();
  const attributePattern = /\s([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of source.matchAll(attributePattern)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
};

const normalizeMarkdownCaption = (value) => {
  const caption = (value ?? "").trim();
  return caption.toLowerCase() === "technical-diagram" ? "" : caption;
};

export const normalizeDiagramLabel = (value) => value
  .replace(/<[^>]+>/g, " ")
  .replace(/[`*_~]/g, "")
  .replace(/^\s*\d+(?:\.\d+)*[.)、:]?\s*/, "")
  .replace(/[\s\p{P}\p{S}]+/gu, " ")
  .trim()
  .toLocaleLowerCase("en");

export const validateVisibleDiagramCaption = ({ alt, caption, nearestHeading }) => {
  const normalizedCaption = normalizeDiagramLabel(caption);
  if (!normalizedCaption) return "missing";
  if (normalizedCaption === normalizeDiagramLabel(alt)) return "matches-alt";
  const normalizedHeading = normalizeDiagramLabel(nearestHeading);
  if (normalizedHeading && normalizedCaption === normalizedHeading) return "matches-heading";
  return null;
};

const parseHtmlDiagramImages = (html) => {
  const images = [];
  const withoutComments = html.replace(/<!--[\s\S]*?(?:-->|$)/g, "");
  let cursor = 0;
  while (cursor < withoutComments.length) {
    const opening = withoutComments.indexOf("<", cursor);
    if (opening === -1) break;
    const nameMatch = withoutComments.slice(opening + 1).match(/^\s*(img|TechnicalDiagram)\b/i);
    if (!nameMatch) {
      cursor = opening + 1;
      continue;
    }

    let quote = "";
    let closing = -1;
    for (let index = opening + 1; index < withoutComments.length; index += 1) {
      const character = withoutComments[index];
      if (quote) {
        if (character === quote) quote = "";
      } else if (character === "\"" || character === "'") {
        quote = character;
      } else if (character === ">") {
        closing = index;
        break;
      }
    }
    if (closing === -1) break;
    const attributes = parseHtmlAttributes(withoutComments.slice(opening, closing + 1));
    const technicalDiagram = nameMatch[1].toLowerCase() === "technicaldiagram";
    images.push({
      alt: (attributes.get("alt") ?? "").trim(),
      caption: technicalDiagram ? (attributes.get("caption") ?? "").trim() : "",
      rawTarget: attributes.get("src") ?? "",
    });
    cursor = closing + 1;
  }
  return images;
};

export const collectMarkdownDiagramCandidates = (tokens) => {
  const images = [];
  const inlineSvgLines = [];
  let nearestHeading = "";

  const addHtml = (html, line) => {
    const withoutComments = html.replace(/<!--[\s\S]*?(?:-->|$)/g, "");
    if (/<svg\b/i.test(withoutComments)) inlineSvgLines.push(line);
    for (const image of parseHtmlDiagramImages(html)) {
      images.push({ ...image, line, nearestHeading });
    }
  };

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];
    if (token.type === "heading_open") {
      const headingInline = tokens.slice(tokenIndex + 1).find((candidate) =>
        candidate.type === "inline" || candidate.type === "heading_close",
      );
      nearestHeading = headingInline?.type === "inline" ? headingInline.content.trim() : "";
      continue;
    }

    const line = token.map ? token.map[0] + 1 : null;
    if (token.type === "html_block" || token.type === "html_inline") addHtml(token.content, line);
    if (token.type !== "inline" || !token.children) continue;
    for (const child of token.children) {
      if (child.type === "image") {
        images.push({
          alt: child.content.trim(),
          caption: normalizeMarkdownCaption(child.attrGet("title")),
          line,
          nearestHeading,
          rawTarget: child.attrGet("src") ?? "",
        });
      } else if (child.type === "html_inline") {
        addHtml(child.content, line);
      }
    }
  }

  return { images, inlineSvgLines };
};
