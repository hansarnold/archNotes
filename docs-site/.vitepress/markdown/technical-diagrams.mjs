const escapeAttribute = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const cleanPath = (source) => String(source || "")
  .split(/[?#]/, 1)[0]
  .replaceAll("\\", "/");

export const isTechnicalDiagramSource = (source) => {
  const value = String(source || "").trim().replaceAll("\\", "/");
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return false;

  const pathname = cleanPath(value);
  const match = pathname.match(/(?:^|\/)assets\/diagrams\/(.+)$/i);
  if (!match) return false;
  const segments = match[1].split("/");
  return segments.every((segment) => segment && segment !== "." && segment !== "..")
    && segments.at(-1).toLowerCase().endsWith(".svg");
};

export const toPublicAssetUrl = (source) => {
  const value = String(source || "").replaceAll("\\", "/");
  if (/^(?:[a-z]+:)?\/\//i.test(value) || /^(?:data|blob):/i.test(value)) return value;

  const suffixIndex = value.search(/[?#]/);
  const pathname = suffixIndex === -1 ? value : value.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : value.slice(suffixIndex);
  const assetIndex = pathname.lastIndexOf("/assets/");

  if (assetIndex !== -1) return `${pathname.slice(assetIndex)}${suffix}`;
  if (pathname.startsWith("assets/")) return `/${pathname}${suffix}`;
  return value;
};

const diagramFromInline = (inlineToken) => {
  const children = inlineToken.children || [];
  let imageToken;

  if (children.length === 1 && children[0].type === "image") {
    [imageToken] = children;
  } else if (
    children.length === 3
    && children[0].type === "link_open"
    && children[1].type === "image"
    && children[2].type === "link_close"
  ) {
    imageToken = children[1];
  } else {
    return null;
  }

  const source = imageToken.attrGet("src");
  if (!isTechnicalDiagramSource(source)) return null;

  const publicSource = toPublicAssetUrl(source);
  const alt = imageToken.content?.trim() || "Technical diagram";
  const title = imageToken.attrGet("title")?.trim();
  const caption = title || alt;

  return {
    alt,
    caption,
    source: publicSource,
  };
};

export const renderTechnicalDiagram = ({ alt, caption, source }) => (
  `<TechnicalDiagram src="${escapeAttribute(source)}" alt="${escapeAttribute(alt)}" caption="${escapeAttribute(caption)}"></TechnicalDiagram>\n`
);

export const configureTechnicalDiagrams = (markdown) => {
  markdown.core.ruler.after("inline", "technical-diagram-figures", (state) => {
    for (let index = 0; index <= state.tokens.length - 3; index += 1) {
      const paragraphOpen = state.tokens[index];
      const inlineToken = state.tokens[index + 1];
      const paragraphClose = state.tokens[index + 2];

      if (
        paragraphOpen.type !== "paragraph_open"
        || inlineToken.type !== "inline"
        || paragraphClose.type !== "paragraph_close"
      ) continue;

      const diagram = diagramFromInline(inlineToken);
      if (!diagram) continue;

      const block = new state.Token("html_block", "", 0);
      block.content = renderTechnicalDiagram(diagram);
      block.map = paragraphOpen.map;
      state.tokens.splice(index, 3, block);
    }
  });
};
