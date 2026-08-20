import { exportToSvg, restore } from "@excalidraw/excalidraw";

globalThis.__ARCHNOTES_RENDER_EXCALIDRAW__ = async (scene, exportPadding) => {
  const restored = restore(scene, null, null, {
    refreshDimensions: false,
    repairBindings: false,
  });
  const svg = await exportToSvg({
    elements: restored.elements.filter((element) => !element.isDeleted),
    appState: {
      ...restored.appState,
      exportBackground: true,
      exportEmbedScene: false,
      exportWithDarkMode: false,
      viewBackgroundColor: "#ffffff",
    },
    files: restored.files,
    exportPadding,
    renderEmbeddables: false,
    reuseImages: true,
  });
  return svg.outerHTML;
};
