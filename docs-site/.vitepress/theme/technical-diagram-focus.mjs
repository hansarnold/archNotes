export const getReturnFocusTarget = (activeElement, documentObject) => {
  const HTMLElementType = documentObject?.defaultView?.HTMLElement;
  if (
    typeof HTMLElementType !== "function"
    || !(activeElement instanceof HTMLElementType)
    || activeElement === documentObject.body
    || activeElement === documentObject.documentElement
  ) return null;

  return activeElement;
};

export const restoreDiagramScrollPosition = (documentObject, position) => {
  const rootStyle = documentObject?.documentElement?.style;
  const view = documentObject?.defaultView;
  if (!position || !rootStyle || typeof view?.scrollTo !== "function") return;
  const previousScrollBehavior = rootStyle.scrollBehavior;
  rootStyle.scrollBehavior = "auto";
  view.scrollTo(position.scrollX, position.scrollY);
  rootStyle.scrollBehavior = previousScrollBehavior;
};

export const setDiagramScrollLocked = (documentObject, locked) => {
  const root = documentObject?.documentElement;
  const body = documentObject?.body;
  const view = documentObject?.defaultView;
  if (!root?.classList || !body?.style) return;

  if (locked) {
    if (root.dataset.technicalDiagramScrollY !== undefined) return null;
    const scrollX = Number(view?.scrollX || 0);
    const scrollY = Number(view?.scrollY || 0);
    root.dataset.technicalDiagramScrollX = String(scrollX);
    root.dataset.technicalDiagramScrollY = String(scrollY);
    body.style.setProperty("--technical-diagram-scroll-left", `${-scrollX}px`);
    body.style.setProperty("--technical-diagram-scroll-top", `${-scrollY}px`);
    root.classList.toggle("technical-diagram-dialog-open", true);
    return null;
  }

  if (root.dataset.technicalDiagramScrollY === undefined) return null;
  const scrollX = Number(root.dataset.technicalDiagramScrollX || 0);
  const scrollY = Number(root.dataset.technicalDiagramScrollY || 0);
  root.classList.toggle("technical-diagram-dialog-open", false);
  body.style.removeProperty("--technical-diagram-scroll-left");
  body.style.removeProperty("--technical-diagram-scroll-top");
  delete root.dataset.technicalDiagramScrollX;
  delete root.dataset.technicalDiagramScrollY;
  const position = { scrollX, scrollY };
  restoreDiagramScrollPosition(documentObject, position);
  return position;
};
