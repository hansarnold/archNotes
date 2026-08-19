import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitepress";
import { syncNotes } from "../scripts/sync-notes.mjs";

syncNotes();

const siteRoot = path.resolve(import.meta.dirname, "..");
const contentRoot = path.join(siteRoot, "content");

const pageTitle = (relativePath) => {
  const sourcePath = path.join(contentRoot, `${relativePath}.md`);
  if (!existsSync(sourcePath)) return path.basename(relativePath).replaceAll("-", " ");
  const source = readFileSync(sourcePath, "utf8");
  return source.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] || source.match(/^#\s+(.+)$/m)?.[1] || path.basename(relativePath);
};

const item = (relativePath, title) => ({ text: title || pageTitle(relativePath), link: `/${relativePath}` });

const overviewSidebar = [
  { text: "开始", items: [item("", "总览"), item("topics", "主题矩阵"), item("notes/learning-roadmap", "学习路线")] },
  {
    text: "架构专论",
    collapsed: false,
    items: [
      item("notes/nvidia-gpu-synchronization", "NVIDIA GPU"),
      item("notes/architecture", "Groq TSP"),
      item("notes/tenstorrent-architecture", "Tenstorrent Tensix"),
      item("notes/google-tpu-architecture", "Google TPU"),
    ],
  },
  {
    text: "比较与系统",
    collapsed: true,
    items: [
      item("notes/ai-accelerator-architecture-comparison", "四类架构统一对照"),
      item("notes/lpu-vs-gpu", "LPU/TSP 与 GPU"),
      item("notes/groq-tenstorrent-comparison", "Groq、Tensix 与 GPU"),
      item("notes/tenstorrent-rethinking-gpu-sm", "从 GPU SM 到 Tensix"),
      item("notes/nvidia-groq3-heterogeneous-inference", "GPU + LPX 异构推理"),
    ],
  },
  {
    text: "软件与运行时",
    collapsed: true,
    items: [item("notes/inference-stack", "推理框架与运行时")],
  },
  {
    text: "实验",
    collapsed: true,
    items: [item("labs/static_scheduler", "静态时空调度"), item("labs/tensix_pipeline", "Tensix 流水与背压"), item("labs/systolic_array", "Systolic Array 波前")],
  },
  { text: "参考", items: [item("sources/catalog", "来源目录")] },
];

const nvidiaSidebar = [
  { text: "NVIDIA GPU", items: [item("notes/nvidia-gpu-synchronization", "Tile 流水与同步")] },
  {
    text: "横向比较",
    items: [item("notes/lpu-vs-gpu", "LPU/TSP 与 GPU"), item("notes/tenstorrent-rethinking-gpu-sm", "GPU SM 与 Tensix")],
  },
  { text: "异构系统", items: [item("notes/nvidia-groq3-heterogeneous-inference", "Rubin GPU + Groq 3 LPX")] },
  { text: "参考", items: [item("sources/catalog", "来源目录")] },
];

const groqSidebar = [
  { text: "Groq TSP", items: [item("notes/architecture", "架构概览")] },
  { text: "指令与调度", items: [item("notes/instruction-flow", "ISA 与指令流"), item("notes/compiler", "静态编译与调度")] },
  { text: "软件优化", items: [item("notes/software-optimization", "软件优化方法"), item("notes/inference-stack", "推理框架与运行时")] },
  { text: "比较与系统", items: [item("notes/lpu-vs-gpu", "LPU/TSP 与 GPU"), item("notes/groq-tenstorrent-comparison", "Groq、Tensix 与 GPU"), item("notes/nvidia-groq3-heterogeneous-inference", "GPU + LPX 异构推理")] },
  { text: "实验", items: [item("labs/static_scheduler", "静态时空调度")] },
];

const tensixSidebar = [
  { text: "Tenstorrent Tensix", items: [item("notes/tenstorrent-architecture", "架构与软件栈")] },
  { text: "机制与比较", items: [item("notes/tenstorrent-rethinking-gpu-sm", "从 GPU SM 到 Tensix"), item("notes/groq-tenstorrent-comparison", "Groq、Tensix 与 GPU")] },
  { text: "实验", items: [item("labs/tensix_pipeline", "流水线与背压")] },
  { text: "参考", items: [item("sources/catalog", "来源目录")] },
];

const tpuSidebar = [
  { text: "Google TPU", items: [item("notes/google-tpu-architecture", "Systolic Array、XLA 与 Pod")] },
  { text: "横向比较", items: [item("notes/ai-accelerator-architecture-comparison", "四类架构统一对照")] },
  { text: "实验", items: [item("labs/systolic_array", "Systolic Array 波前")] },
  { text: "参考", items: [item("sources/catalog", "来源目录")] },
];

const knownNotePaths = new Set([overviewSidebar, nvidiaSidebar, groqSidebar, tensixSidebar, tpuSidebar].flat(2).flatMap((entry) => entry?.items || []).map((entry) => entry.link));
const otherNotes = readdirSync(path.join(contentRoot, "notes"))
  .filter((name) => name.endsWith(".md"))
  .map((name) => `notes/${name.slice(0, -3)}`)
  .filter((relativePath) => !knownNotePaths.has(`/${relativePath}`))
  .sort()
  .map((relativePath) => item(relativePath));

if (otherNotes.length) {
  overviewSidebar.splice(-1, 0, { text: "待归档", collapsed: true, items: otherNotes });
}

const sidebarForRoutes = (routes, sidebar) => Object.fromEntries(routes.map((route) => [route, sidebar]));
const sidebars = {
  ...sidebarForRoutes(["/notes/nvidia-gpu-synchronization"], nvidiaSidebar),
  ...sidebarForRoutes(["/notes/architecture", "/notes/instruction-flow", "/notes/compiler", "/notes/software-optimization", "/labs/static_scheduler"], groqSidebar),
  ...sidebarForRoutes(["/notes/tenstorrent-architecture", "/labs/tensix_pipeline"], tensixSidebar),
  ...sidebarForRoutes(["/notes/google-tpu-architecture", "/labs/systolic_array"], tpuSidebar),
  "/": overviewSidebar,
};

const sourceRoots = [path.resolve(siteRoot, "../notes"), path.resolve(siteRoot, "../sources"), path.resolve(siteRoot, "../labs")];

export default defineConfig({
  title: "archNotes",
  description: "Learning notes and executable ideas for AI accelerator architecture.",
  lang: "zh-CN",
  srcDir: "content",
  outDir: "dist/client",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["meta", { name: "theme-color", content: "#ffffff" }],
  ],
  transformHead({ pageData }) {
    const title = pageData.title ? `${pageData.title} | archNotes` : "archNotes — AI Accelerator Architecture";
    const description = pageData.description || "Learning notes for GPU, Groq TSP, Tenstorrent Tensix, and Google TPU.";
    const tags = [
      ["meta", { property: "og:type", content: "article" }],
      ["meta", { property: "og:title", content: title }],
      ["meta", { property: "og:description", content: description }],
      ["meta", { name: "twitter:card", content: "summary_large_image" }],
      ["meta", { name: "twitter:title", content: title }],
      ["meta", { name: "twitter:description", content: description }],
    ];
    if (pageData.relativePath === "index.md") {
      tags[0][1].content = "website";
      tags.push(["meta", { property: "og:image", content: "__ARCHNOTES_ORIGIN__/og.png" }]);
      tags.push(["meta", { name: "twitter:image", content: "__ARCHNOTES_ORIGIN__/og.png" }]);
    }
    return tags;
  },
  vite: {
    plugins: [
      {
        name: "archnotes-source-sync",
        configureServer(server) {
          server.watcher.add(sourceRoots);
          server.watcher.on("change", (changedPath) => {
            if (!changedPath.endsWith(".md") || !sourceRoots.some((root) => changedPath.startsWith(root))) return;
            syncNotes();
            server.ws.send({ type: "full-reload" });
          });
        },
      },
    ],
  },
  markdown: {
    theme: { light: "github-light", dark: "github-dark" },
    lineNumbers: true,
    config(md) {
      const fallbackFence = md.renderer.rules.fence?.bind(md.renderer.rules);
      md.renderer.rules.fence = (tokens, index, options, env, self) => {
        if (tokens[index].info.trim() === "mermaid") {
          const encoded = Buffer.from(tokens[index].content, "utf8").toString("base64");
          return `<ClientOnly><MermaidDiagram code="${encoded}" /></ClientOnly>`;
        }
        return fallbackFence ? fallbackFence(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
      };
    },
  },
  themeConfig: {
    siteTitle: "archNotes",
    logo: false,
    nav: [
      { text: "总览", link: "/", activeMatch: "^/(?:topics|notes/(?:learning-roadmap|ai-accelerator-architecture-comparison|inference-stack))?$" },
      { text: "NVIDIA GPU", link: "/notes/nvidia-gpu-synchronization", activeMatch: "^/notes/nvidia" },
      { text: "Groq TSP", link: "/notes/architecture", activeMatch: "^/(?:notes/(?:architecture|instruction-flow|compiler|software-optimization|lpu-vs-gpu)|labs/static_scheduler)" },
      { text: "Tensix", link: "/notes/tenstorrent-architecture", activeMatch: "^/(?:notes/tenstorrent|labs/tensix_pipeline)" },
      { text: "TPU", link: "/notes/google-tpu-architecture", activeMatch: "^/(?:notes/google-tpu|labs/systolic_array)" },
      {
        text: "实验",
        items: [
          { text: "静态时空调度", link: "/labs/static_scheduler" },
          { text: "Tensix 流水与背压", link: "/labs/tensix_pipeline" },
          { text: "Systolic Array 波前", link: "/labs/systolic_array" },
        ],
      },
    ],
    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "搜索", buttonAriaLabel: "搜索文档" },
          modal: {
            displayDetails: "Display detailed list",
            resetButtonTitle: "Reset search",
            backButtonTitle: "Close search",
            noResultsText: "没有找到相关文档：",
            footer: { selectText: "Select", navigateText: "Navigate", closeText: "Close" },
          },
        },
      },
    },
    sidebar: sidebars,
    outline: { level: [2, 3], label: "本页目录" },
    docFooter: { prev: "上一篇", next: "下一篇" },
    lastUpdated: { text: "最后更新" },
    editLink: {
      pattern: ({ filePath }) => {
        const sourcePath = filePath.startsWith("notes/") || filePath.startsWith("sources/")
          ? filePath
          : filePath.startsWith("labs/")
            ? `labs/${filePath.split("/").at(-1).replace(/\.md$/, "")}/README.md`
            : "README.md";
        return `https://github.com/hansarnold/archNotes/edit/main/${sourcePath}`;
      },
      text: "在 GitHub 上编辑此页",
    },
    socialLinks: [{ icon: "github", link: "https://github.com/hansarnold/archNotes" }],
    darkModeSwitchLabel: "外观",
    sidebarMenuLabel: "文档导航",
    returnToTopLabel: "返回顶部",
  },
});
