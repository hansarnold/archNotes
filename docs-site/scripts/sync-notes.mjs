import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(siteRoot, "..");
const contentRoot = path.join(siteRoot, "content");

const pageMetadata = {
  "notes/learning-roadmap.md": {
    products: ["跨架构"],
    documentType: "学习导览",
    topics: ["学习路径", "研究方法"],
  },
  "notes/ai-accelerator-architecture-comparison.md": {
    products: ["NVIDIA GPU", "Groq LPU/TSP", "Tenstorrent Tensix", "Google TPU"],
    documentType: "比较研究",
    topics: ["计算组织", "调度", "数据移动", "软件栈"],
  },
  "notes/nvidia-gpu-synchronization.md": {
    products: ["NVIDIA GPU"],
    documentType: "架构专论",
    topics: ["Tile 流水", "同步", "数据移动"],
  },
  "notes/architecture.md": {
    products: ["Groq TSP"],
    documentType: "架构专论",
    topics: ["Functional slicing", "静态调度", "Stream"],
  },
  "notes/tenstorrent-architecture.md": {
    products: ["Tenstorrent Tensix"],
    documentType: "架构专论",
    topics: ["Dataflow core", "NoC", "TT-Metalium"],
  },
  "notes/google-tpu-architecture.md": {
    products: ["Google TPU"],
    documentType: "架构专论",
    topics: ["Systolic array", "XLA", "TPU Pod"],
  },
  "notes/instruction-flow.md": {
    products: ["Groq TSP"],
    documentType: "机制专题",
    topics: ["ISA", "指令流", "静态调度"],
  },
  "notes/compiler.md": {
    products: ["Groq TSP"],
    documentType: "机制专题",
    topics: ["编译器", "时空调度", "资源规划"],
  },
  "notes/inference-stack.md": {
    products: ["跨架构"],
    documentType: "机制专题",
    topics: ["推理框架", "Runtime", "编译边界"],
  },
  "notes/software-optimization.md": {
    products: ["Groq TSP"],
    documentType: "机制专题",
    topics: ["Fusion", "Memory planning", "量化"],
  },
  "notes/lpu-vs-gpu.md": {
    products: ["Groq LPU/TSP", "NVIDIA GPU"],
    documentType: "比较研究",
    topics: ["执行模型", "调度责任", "存储系统"],
  },
  "notes/groq-tenstorrent-comparison.md": {
    products: ["Groq LPU/TSP", "Tenstorrent Tensix", "NVIDIA GPU"],
    documentType: "比较研究",
    topics: ["执行模型", "SRAM-first", "多芯片"],
  },
  "notes/tenstorrent-rethinking-gpu-sm.md": {
    products: ["Tenstorrent Tensix", "NVIDIA GPU"],
    documentType: "比较研究",
    topics: ["Core 设计", "调度", "Memory hierarchy"],
  },
  "notes/nvidia-groq3-heterogeneous-inference.md": {
    products: ["NVIDIA Rubin GPU", "Groq 3 LPX"],
    documentType: "系统研究",
    topics: ["异构推理", "负载分配", "在线路由"],
  },
  "labs/static_scheduler.md": {
    products: ["Groq TSP 教学模型"],
    documentType: "可运行实验",
    topics: ["静态调度", "资源冲突", "确定性"],
  },
  "labs/tensix_pipeline.md": {
    products: ["Tenstorrent Tensix 教学模型"],
    documentType: "可运行实验",
    topics: ["流水线", "Circular buffer", "背压"],
  },
  "labs/systolic_array.md": {
    products: ["Google TPU 教学模型"],
    documentType: "可运行实验",
    topics: ["Systolic array", "Wavefront", "利用率"],
  },
  "sources/catalog.md": {
    products: ["跨架构"],
    documentType: "资料索引",
    topics: ["论文", "官方文档", "证据边界"],
  },
};

const firstParagraph = (source) => {
  const withoutFrontmatter = source.replace(/^---[\s\S]*?---\s*/, "");
  return withoutFrontmatter
    .split(/\n\s*\n/)
    .map((part) => part.replace(/^#+\s+.*$/gm, "").replace(/[`*_>\[\]()]/g, "").trim())
    .find((part) =>
      part.length > 30 &&
      !part.startsWith("|") &&
      !part.startsWith("- ") &&
      !/^(最后核对日期|最后更新|核对日期|Last (updated|reviewed))/i.test(part),
    )
    ?.replace(/\s+/g, " ")
    .slice(0, 180) || "AI accelerator architecture learning notes.";
};

const escapeAttribute = (value) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

const addDefaultThemeBadges = (content, metadata) => {
  const badges = [
    ...(metadata.products || []).map((product) => `<Badge type="tip" text="${escapeAttribute(product)}" />`),
    metadata.documentType && `<Badge type="info" text="${escapeAttribute(metadata.documentType)}" />`,
  ].filter(Boolean);

  if (!badges.length) return content;
  return content.replace(/^#\s+.+$/m, (heading) => `${heading}\n\n${badges.join(" ")}`);
};

const prepareMarkdown = (source, fallbackTitle, metadata = {}) => {
  const frontmatterMatch = source.match(/^---\n([\s\S]*?)\n---\s*/);
  const existingFrontmatter = frontmatterMatch?.[1]?.trim() || "";
  let content = (frontmatterMatch ? source.slice(frontmatterMatch[0].length) : source)
    .replace(/\]\(\.\.\/sources\/catalog\.md(?:#[^)]+)?\)/g, "](/sources/catalog)")
    .replace(/\]\(sources\/catalog\.md(?:#[^)]+)?\)/g, "](/sources/catalog)")
    .replace(/\]\(notes\/([^)#]+)\.md(?:#[^)]+)?\)/g, "](/notes/$1)");

  const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallbackTitle;
  const description = firstParagraph(content);
  const generatedFrontmatter = [
    existingFrontmatter,
    !/^title:/m.test(existingFrontmatter) && `title: ${JSON.stringify(title)}`,
    !/^description:/m.test(existingFrontmatter) && `description: ${JSON.stringify(description)}`,
    !/^outline:/m.test(existingFrontmatter) && "outline: deep",
    metadata.products && !/^products:/m.test(existingFrontmatter) && `products: ${JSON.stringify(metadata.products)}`,
    metadata.documentType && !/^documentType:/m.test(existingFrontmatter) && `documentType: ${JSON.stringify(metadata.documentType)}`,
    metadata.topics && !/^topics:/m.test(existingFrontmatter) && `topics: ${JSON.stringify(metadata.topics)}`,
  ].filter(Boolean).join("\n");
  return `---\n${generatedFrontmatter}\n---\n\n${addDefaultThemeBadges(content, metadata).trimEnd()}\n`;
};

const syncDirectory = (sourceDirectory, destinationDirectory, contentPrefix) => {
  rmSync(destinationDirectory, { recursive: true, force: true });
  mkdirSync(destinationDirectory, { recursive: true });

  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const sourcePath = path.join(sourceDirectory, entry.name);
    const destinationPath = path.join(destinationDirectory, entry.name);
    const fallbackTitle = path.basename(entry.name, ".md").replaceAll("-", " ");
    const contentPath = `${contentPrefix}/${entry.name}`;
    writeFileSync(destinationPath, prepareMarkdown(readFileSync(sourcePath, "utf8"), fallbackTitle, pageMetadata[contentPath]));
  }
};

export function syncNotes() {
  mkdirSync(contentRoot, { recursive: true });
  syncDirectory(path.join(repositoryRoot, "notes"), path.join(contentRoot, "notes"), "notes");
  syncDirectory(path.join(repositoryRoot, "sources"), path.join(contentRoot, "sources"), "sources");

  const labsDestination = path.join(contentRoot, "labs");
  rmSync(labsDestination, { recursive: true, force: true });
  mkdirSync(labsDestination, { recursive: true });
  const labsRoot = path.join(repositoryRoot, "labs");
  for (const lab of readdirSync(labsRoot, { withFileTypes: true })) {
    if (!lab.isDirectory()) continue;
    const readme = path.join(labsRoot, lab.name, "README.md");
    if (!existsSync(readme)) continue;
    const source = readFileSync(readme, "utf8");
    const destination = path.join(labsDestination, `${lab.name}.md`);
    writeFileSync(destination, prepareMarkdown(source, lab.name.replaceAll("_", " "), pageMetadata[`labs/${lab.name}.md`]));
  }

  const assetSource = path.join(siteRoot, "public", "assets", "tile-execution-models.png");
  const assetDestination = path.join(contentRoot, "public", "assets", "tile-execution-models.png");
  if (existsSync(assetSource)) {
    mkdirSync(path.dirname(assetDestination), { recursive: true });
    cpSync(assetSource, assetDestination);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncNotes();
  console.log("Synced Markdown notes into the VitePress content tree.");
}
