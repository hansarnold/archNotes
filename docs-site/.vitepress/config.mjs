import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitepress";

const siteRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(siteRoot, "..");
const contentRoot = path.join(repositoryRoot, "docs");

const pageTitle = (relativePath) => {
  const sourcePath = path.join(contentRoot, `${relativePath}.md`);
  if (!existsSync(sourcePath)) return path.basename(relativePath).replaceAll("-", " ");
  const source = readFileSync(sourcePath, "utf8");
  return source.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] || source.match(/^#\s+(.+)$/m)?.[1] || path.basename(relativePath);
};

const item = (relativePath, title) => ({ text: title || pageTitle(relativePath), link: `/${relativePath}` });

const learningTracks = [
  ["notes/model-computation-primitives", "Model Computation and Workload"],
  ["notes/model-to-hardware-mapping", "Model-to-Hardware Mapping"],
  ["notes/ai-accelerator-architecture-comparison", "Hardware Architecture"],
  ["notes/software-optimization-methodology", "Software Optimization"],
  ["notes/model-hardware-codesign", "Model–Hardware Co-design"],
  ["notes/performance-modeling", "Performance Modeling and Validation"],
];

const learningTrackItems = (prefix = "") => learningTracks.map(([relativePath, title]) => item(`${prefix}${relativePath}`, title));

const overviewSidebar = [
  { text: "开始", items: [item("", "总览"), item("curriculum", "课程蓝图"), item("topics", "主题矩阵"), item("notes/learning-roadmap", "学习路线")] },
  {
    text: "全栈主干",
    collapsed: false,
    items: learningTrackItems(),
  },
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
    text: "指令与软件栈",
    collapsed: true,
    items: [
      item("notes/instruction-flow", "ISA 与指令流"),
      item("notes/compiler", "静态编译与调度"),
      item("notes/software-optimization", "Groq 优化方法"),
      item("notes/inference-stack", "推理框架与 Runtime"),
    ],
  },
  {
    text: "实验",
    collapsed: true,
    items: [item("labs/static_scheduler", "静态时空调度"), item("labs/tensix_pipeline", "Tensix 流水与背压"), item("labs/systolic_array", "Systolic Array 波前")],
  },
  { text: "参考", items: [item("glossary", "Glossary"), item("sources/catalog", "Source Catalog")] },
];

const englishSidebar = [
  {
    text: "Start",
    items: [
      item("en", "Overview"),
      item("en/curriculum", "Curriculum"),
      item("en/topics", "Topic Matrix"),
      item("en/notes/learning-roadmap", "Learning Roadmap"),
    ],
  },
  {
    text: "Full-Stack Backbone",
    collapsed: false,
    items: learningTrackItems("en/"),
  },
  {
    text: "Architecture Monographs",
    collapsed: false,
    items: [
      item("en/notes/nvidia-gpu-synchronization", "NVIDIA GPU"),
      item("en/notes/architecture", "Groq TSP"),
      item("en/notes/tenstorrent-architecture", "Tenstorrent Tensix"),
      item("en/notes/google-tpu-architecture", "Google TPU"),
    ],
  },
  {
    text: "Comparisons and Systems",
    collapsed: true,
    items: [
      item("en/notes/ai-accelerator-architecture-comparison", "Architecture Comparison"),
      item("en/notes/lpu-vs-gpu", "LPU/TSP and GPU"),
      item("en/notes/groq-tenstorrent-comparison", "Groq, Tensix, and GPU"),
      item("en/notes/tenstorrent-rethinking-gpu-sm", "From GPU SM to Tensix"),
      item("en/notes/nvidia-groq3-heterogeneous-inference", "GPU + LPX Heterogeneous Inference"),
    ],
  },
  {
    text: "Software and Runtime",
    collapsed: true,
    items: [
      item("en/notes/instruction-flow", "ISA and Instruction Flow"),
      item("en/notes/compiler", "Static Compilation and Scheduling"),
      item("en/notes/software-optimization", "Groq Optimization Methods"),
      item("en/notes/inference-stack", "Inference Framework and Runtime"),
    ],
  },
  {
    text: "Labs",
    collapsed: true,
    items: [
      item("en/labs/static_scheduler", "Static Time-Space Scheduling"),
      item("en/labs/tensix_pipeline", "Tensix Pipeline and Backpressure"),
      item("en/labs/systolic_array", "Systolic Array Wavefront"),
    ],
  },
  {
    text: "Reference",
    items: [item("en/glossary", "Glossary"), item("en/sources/catalog", "Source Catalog")],
  },
];

const knownNotePaths = new Set(overviewSidebar.flatMap((entry) => entry.items || []).map((entry) => entry.link));
const otherNotes = readdirSync(path.join(contentRoot, "notes"))
  .filter((name) => name.endsWith(".md"))
  .map((name) => `notes/${name.slice(0, -3)}`)
  .filter((relativePath) => !knownNotePaths.has(`/${relativePath}`))
  .sort()
  .map((relativePath) => item(relativePath));

if (otherNotes.length) {
  overviewSidebar.splice(-1, 0, { text: "待归档", collapsed: true, items: otherNotes });
}

const sidebars = { "/": overviewSidebar };

const rootLocaleThemeConfig = {
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
  sidebar: sidebars,
  outline: { level: [2, 3], label: "本页目录" },
  docFooter: { prev: "上一篇", next: "下一篇" },
  lastUpdated: { text: "最后更新" },
  editLink: {
    pattern: ({ filePath }) => `https://github.com/hansarnold/archNotes/edit/main/docs/${filePath}`,
    text: "在 GitHub 上编辑此页",
  },
  darkModeSwitchLabel: "外观",
  langMenuLabel: "切换语言",
  sidebarMenuLabel: "文档导航",
  returnToTopLabel: "返回顶部",
};

const englishLocaleThemeConfig = {
  nav: [
    { text: "Overview", link: "/en/" },
    { text: "Curriculum", link: "/en/curriculum" },
    { text: "Architecture", link: "/en/notes/ai-accelerator-architecture-comparison" },
    { text: "Glossary", link: "/en/glossary" },
  ],
  sidebar: { "/en/": englishSidebar },
  outline: { level: [2, 3], label: "On this page" },
  docFooter: { prev: "Previous", next: "Next" },
  lastUpdated: { text: "Last updated" },
  editLink: {
    pattern: ({ filePath }) => `https://github.com/hansarnold/archNotes/edit/main/docs/${filePath}`,
    text: "Edit this page on GitHub",
  },
  darkModeSwitchLabel: "Appearance",
  langMenuLabel: "Change language",
  sidebarMenuLabel: "Documentation navigation",
  returnToTopLabel: "Return to top",
};

export default defineConfig({
  title: "archNotes",
  description: "Learning notes and executable ideas for AI accelerator architecture.",
  locales: {
    root: { label: "简体中文", lang: "zh-CN", link: "/", themeConfig: rootLocaleThemeConfig },
    en: { label: "English", lang: "en-US", link: "/en/", themeConfig: englishLocaleThemeConfig },
  },
  srcDir: "../docs",
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
    if (pageData.relativePath === "index.md" || pageData.relativePath === "en/index.md") {
      tags[0][1].content = "website";
      tags.push(["meta", { property: "og:image", content: "__ARCHNOTES_ORIGIN__/og.png" }]);
      tags.push(["meta", { name: "twitter:image", content: "__ARCHNOTES_ORIGIN__/og.png" }]);
    }
    return tags;
  },
  vite: {
    resolve: {
      alias: [
        {
          find: "vue/server-renderer",
          replacement: path.join(siteRoot, "node_modules", "vue", "server-renderer", "index.mjs"),
        },
        {
          find: "vue",
          replacement: path.join(siteRoot, "node_modules", "vue", "dist", "vue.runtime.esm-bundler.js"),
        },
      ],
    },
  },
  markdown: {
    theme: { light: "github-light", dark: "github-dark" },
    lineNumbers: true,
  },
  themeConfig: {
    siteTitle: "archNotes",
    logo: false,
    i18nRouting: true,
    search: {
      provider: "local",
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: "搜索", buttonAriaLabel: "搜索文档" },
              modal: {
                displayDetails: "显示详细列表",
                resetButtonTitle: "重置搜索",
                backButtonTitle: "关闭搜索",
                noResultsText: "没有找到相关文档：",
                footer: { selectText: "选择", navigateText: "导航", closeText: "关闭" },
              },
            },
          },
          en: {
            translations: {
              button: { buttonText: "Search", buttonAriaLabel: "Search documentation" },
              modal: {
                displayDetails: "Display detailed list",
                resetButtonTitle: "Reset search",
                backButtonTitle: "Close search",
                noResultsText: "No results found for",
                footer: { selectText: "Select", navigateText: "Navigate", closeText: "Close" },
              },
            },
          },
        },
      },
    },
    socialLinks: [{ icon: "github", link: "https://github.com/hansarnold/archNotes" }],
  },
});
