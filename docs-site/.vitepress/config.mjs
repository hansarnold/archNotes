import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitepress";
import { configureTechnicalDiagrams } from "./markdown/technical-diagrams.mjs";

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
  { text: "硬件架构", items: [item("architecture/", "架构总览"), item("notes/learning-roadmap", "架构学习路线"), item("curriculum", "研究主线"), item("topics", "架构主题矩阵")] },
  {
    text: "全栈主干",
    collapsed: true,
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
    text: "Hardware Architecture",
    items: [
      item("en/architecture/", "Architecture Overview"),
      item("en/curriculum", "Research Tracks"),
      item("en/topics", "Architecture Topic Matrix"),
      item("en/notes/learning-roadmap", "Learning Roadmap"),
    ],
  },
  {
    text: "Full-Stack Backbone",
    collapsed: true,
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

const mlirSidebar = [
  {
    text: "AI Compiler · MLIR 专题",
    items: [item("mlir/", "MLIR 专题总览"), item("compiler/", "返回 AI Compiler 分区")],
  },
  {
    text: "IR 与变换",
    collapsed: false,
    items: [
      item("mlir/ir-foundations", "IR 核心结构与工具"),
      item("mlir/dialects", "Dialect 与 Progressive Lowering"),
      item("mlir/passes-rewrites", "Pass、Pattern 与 Rewrite"),
      item("mlir/dialect-conversion", "Dialect Conversion"),
    ],
  },
  {
    text: "Backend 与硬件",
    collapsed: false,
    items: [
      item("mlir/accelerator-mapping", "AI Accelerator 映射"),
      item("mlir/gpu-nvvm-dpx", "GPU、NVVM 与 DPX"),
    ],
  },
  {
    text: "实践",
    items: [
      item("mlir/labs", "最小可复现实验"),
      item("mlir/testing-study-plan", "测试、计划与结课项目"),
    ],
  },
];

const englishMlirSidebar = [
  {
    text: "AI Compiler · MLIR Track",
    items: [item("en/mlir/", "MLIR Track Overview"), item("en/compiler/", "Back to AI Compiler")],
  },
  {
    text: "IR and Transformation",
    collapsed: false,
    items: [
      item("en/mlir/ir-foundations", "IR Foundations and Tools"),
      item("en/mlir/dialects", "Dialects and Progressive Lowering"),
      item("en/mlir/passes-rewrites", "Passes, Patterns, and Rewrites"),
      item("en/mlir/dialect-conversion", "Dialect Conversion"),
    ],
  },
  {
    text: "Backend and Hardware",
    collapsed: false,
    items: [
      item("en/mlir/accelerator-mapping", "AI Accelerator Mapping"),
      item("en/mlir/gpu-nvvm-dpx", "GPU, NVVM, and DPX"),
    ],
  },
  {
    text: "Practice",
    items: [
      item("en/mlir/labs", "Minimal Reproducible Labs"),
      item("en/mlir/testing-study-plan", "Testing, Study Plan, and Capstone"),
    ],
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

const cppSidebar = (prefix = "") => {
  const english = prefix === "en/";
  return [
    { text: english ? "C++ Review" : "C++ 复习", items: [item(`${prefix}cpp/`, english ? "Overview and Priority Route" : "速查总览与优先路线")] },
    {
      text: english ? "84 Reminders · 7 Cheat Sheets" : "84 条易忘要点 · 7 个专题",
      collapsed: false,
      items: [
        ["types", "类型、初始化与表达式", "Types, Initialization, Expressions"],
        ["lifetime", "生命周期、所有权与 Move", "Lifetime, Ownership, Move"],
        ["classes", "类与对象模型", "Classes and Object Model"],
        ["templates", "模板、推导与回调", "Templates, Deduction, Callbacks"],
        ["stl", "容器与算法", "Containers and Algorithms"],
        ["modern", "现代 C++ 与并发", "Modern C++ and Concurrency"],
        ["tooling", "构建、错误与调试", "Builds, Errors, Debugging"],
      ].map(([slug, zh, en]) => item(`${prefix}cpp/${slug}`, english ? en : zh)),
    },
    {
      text: english ? "Practice" : "动手验证",
      items: [
        item(`${prefix}cpp/tooling#verification`, english ? "Runnable Self-Checks" : "可运行自测"),
        item(`${prefix}mlir/cpp-refresh`, english ? "Review A: Three Repairs" : "复习 A：三个修错任务"),
        item(`${prefix}mlir/cpp-labs`, english ? "Review B: Miniature Pass" : "复习 B：微型 Pass"),
      ],
    },
  ];
};

const compilerChapters = ["bootcamp", "model-to-kernel", "ir-reading", "mapping-lab", "real-world", "discussion"];
const cppPracticeChapters = ["cpp-refresh", "cpp-labs"];
const compilerSidebar = (prefix = "") => {
  const en = prefix === "en/";
  return [
    { text: "AI Compiler", items: [item(`${prefix}compiler/`, en ? "Choose a Learning Track" : "选择学习路线"), item(`${prefix}mlir/bootcamp`, en ? "Two-Day Concept Route" : "两天概念路线")] },
    { text: en ? "Concepts and CPU Experiments" : "概念与 CPU 实验", items: [
      item(`${prefix}mlir/model-to-kernel`, en ? "Model to Kernel" : "模型到 Kernel"),
      item(`${prefix}mlir/ir-reading`, en ? "Read an IR Change" : "读懂一处 IR 变化"),
      item(`${prefix}mlir/mapping-lab`, en ? "Tiles, Memory, Performance" : "Tile、Memory 与性能"),
      item(`${prefix}mlir/real-world`, en ? "Triton, TileLang, IREE" : "Triton、TileLang、IREE 对照"),
      item(`${prefix}mlir/discussion`, en ? "Discussion and Exit Check" : "讨论与验收"),
    ] },
    { text: en ? "Implementation Track" : "实现专题", items: [item(`${prefix}mlir/`, en ? "MLIR: IR, Pass, Lowering" : "MLIR：IR、Pass、Lowering")] },
  ];
};

// Preserve published article URLs while assigning each page one navigation owner.
// Exact legacy-page keys precede the equally deep /mlir/ prefix in VitePress 1.x.
const sectionSidebars = (prefix = "") => ({
  ...Object.fromEntries(cppPracticeChapters.map((chapter) => [`/${prefix}mlir/${chapter}`, cppSidebar(prefix)])),
  ...Object.fromEntries(compilerChapters.map((chapter) => [`/${prefix}mlir/${chapter}`, compilerSidebar(prefix)])),
  [`/${prefix}cpp/`]: cppSidebar(prefix),
  [`/${prefix}compiler/`]: compilerSidebar(prefix),
  [`/${prefix}mlir/`]: prefix ? englishMlirSidebar : mlirSidebar,
  [`/${prefix}`]: prefix ? englishSidebar : overviewSidebar,
});

const sectionNav = (prefix = "") => {
  const en = prefix === "en/";
  return [
    { text: en ? "Home" : "首页", link: `/${prefix}`, activeMatch: `^/${prefix}$` },
    { text: en ? "Architecture" : "硬件架构", link: `/${prefix}architecture/`, activeMatch: `^/${prefix}(?:architecture/|notes/|labs/|curriculum|topics|glossary|sources/)` },
    { text: "AI Compiler", link: `/${prefix}compiler/`, activeMatch: `^/${prefix}(?:compiler/|mlir/(?!cpp-refresh|cpp-labs))` },
    { text: en ? "C++ Review" : "C++ 复习", link: `/${prefix}cpp/`, activeMatch: `^/${prefix}(?:cpp/|mlir/(?:cpp-refresh|cpp-labs))` },
  ];
};

const rootLocaleThemeConfig = {
  nav: sectionNav(),
  sidebar: sectionSidebars(),
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
  nav: sectionNav("en/"),
  sidebar: sectionSidebars("en/"),
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
    config(markdown) {
      configureTechnicalDiagrams(markdown);
    },
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
