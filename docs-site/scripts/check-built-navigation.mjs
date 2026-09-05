#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  {
    file: "dist/client/index.html",
    markers: ["VPSidebar", "VPDocAside", "全栈主干"],
  },
  {
    file: "dist/client/notes/model-to-hardware-mapping.html",
    markers: ["VPSidebar", "VPDocAside", "全栈主干", "架构专论", "比较与系统", "指令与软件栈", "实验", "参考"],
  },
  {
    file: "dist/client/notes/nvidia-gpu-synchronization.html",
    markers: ["VPSidebar", "VPDocAside", "全栈主干", "架构专论", "比较与系统", "指令与软件栈", "实验", "参考"],
  },
  {
    file: "dist/client/notes/architecture.html",
    markers: ["VPSidebar", "VPDocAside", "全栈主干", "架构专论", "比较与系统", "指令与软件栈", "实验", "参考"],
  },
  {
    file: "dist/client/notes/tenstorrent-architecture.html",
    markers: ["VPSidebar", "VPDocAside", "全栈主干", "架构专论", "比较与系统", "指令与软件栈", "实验", "参考"],
  },
  {
    file: "dist/client/notes/google-tpu-architecture.html",
    markers: ["VPSidebar", "VPDocAside", "全栈主干", "架构专论", "比较与系统", "指令与软件栈", "实验", "参考"],
  },
  {
    file: "dist/client/en/index.html",
    markers: ["VPSidebar", "VPDocAside", "Full-Stack Backbone"],
  },
  {
    file: "dist/client/en/notes/model-to-hardware-mapping.html",
    markers: ["VPSidebar", "VPDocAside", "Model-to-Hardware Mapping"],
  },
  {
    file: "dist/client/en/topics.html",
    markers: ["VPSidebar", "VPDocAside", "Topic Matrix"],
  },
  {
    file: "dist/client/mlir/index.html",
    markers: ["VPSidebar", "VPDocAside", "真实项目中的 MLIR", "IR 与变换", "Backend 与硬件", "实践"],
  },
  {
    file: "dist/client/en/mlir/index.html",
    markers: ["VPSidebar", "VPDocAside", "MLIR in Real Projects", "IR and Transformation", "Backend and Hardware", "Practice"],
  },
];

for (const locale of ["", "en/"]) {
  for (const chapter of ["index", "types", "lifetime", "classes", "templates", "stl", "modern", "tooling"]) {
    pages.push({
      file: `dist/client/${locale}cpp/${chapter}.html`,
      markers: ["VPSidebar", "VPDocAside", `/${locale}cpp/types`, `/${locale}cpp/tooling`,
        ...(chapter === "index" ? ["84"] : ["<details", "<summary>"])],
    });
  }
  for (const chapter of ["bootcamp", "model-to-kernel", "cpp-refresh", "ir-reading", "mapping-lab", "cpp-labs", "real-world", "discussion"]) {
    pages.push({
      file: `dist/client/${locale}mlir/${chapter}.html`,
      markers: ["VPSidebar", "VPDocAside", `/${locale}mlir/bootcamp`, `/${locale}mlir/cpp-labs`, `/${locale}mlir/discussion`,
        ...(["cpp-refresh", "cpp-labs", "mapping-lab", "discussion"].includes(chapter) ? ["<details", "<summary>"] : [])],
    });
  }
}

const errors = [];
for (const page of pages) {
  const target = path.join(siteRoot, page.file);
  if (!existsSync(target)) {
    errors.push(`${page.file}: built page is missing`);
    continue;
  }
  const source = readFileSync(target, "utf8");
  for (const marker of page.markers) {
    if (!source.includes(marker)) errors.push(`${page.file}: missing rendered navigation marker ${marker}`);
  }
  const reviewChapter = page.file.match(/\/cpp\/(types|lifetime|classes|templates|stl|modern|tooling)\.html$/)?.[1];
  if (reviewChapter) {
    const prefixes = { types: "t", lifetime: "l", classes: "c", templates: "f", stl: "s", modern: "m", tooling: "g" };
    for (let number = 1; number <= 12; number++) {
      const id = `${prefixes[reviewChapter]}${String(number).padStart(2, "0")}`;
      if (source.split(`id="${id}"`).length !== 2) errors.push(`${page.file}: expected exactly one reminder anchor ${id}`);
    }
  }
  if (/\/(?:mlir|cpp)\//.test(page.file)) {
    const pageUrl = new URL(page.file.replace("dist/client", ""), "https://course.invalid");
    for (const match of source.matchAll(/href="([^"]*#[^"]+)"/g)) {
      const targetUrl = new URL(match[1], pageUrl);
      if (targetUrl.origin !== pageUrl.origin || !targetUrl.hash) continue;
      const pathname = decodeURIComponent(targetUrl.pathname);
      const relativeFile = pathname.endsWith("/") ? `${pathname}index.html`
        : pathname.endsWith(".html") ? pathname : `${pathname}.html`;
      const target = path.join(siteRoot, "dist/client", relativeFile);
      if (!existsSync(target)) {
        errors.push(`${page.file}: anchor target does not exist: ${match[1]}`);
        continue;
      }
      const id = decodeURIComponent(targetUrl.hash.slice(1));
      if (!readFileSync(target, "utf8").includes(`id="${id}"`)) {
        errors.push(`${page.file}: anchor is missing: ${match[1]}`);
      }
    }
  }
}

const chunkDirectory = path.join(siteRoot, "dist/client/assets/chunks");
if (!existsSync(chunkDirectory)) {
  errors.push("dist/client/assets/chunks: built JavaScript chunks are missing");
} else {
  const frameworkChunks = readdirSync(chunkDirectory).filter((name) => /^framework\..+\.js$/.test(name));
  if (!frameworkChunks.length) errors.push("Framework chunk is missing");
  for (const chunk of frameworkChunks) {
    const source = readFileSync(path.join(chunkDirectory, chunk), "utf8");
    if (/from["']\.\/theme\./.test(source)) {
      errors.push(`${chunk}: framework imports the theme chunk and recreates the runtime circular dependency`);
    }
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Built navigation check passed for Chinese and English routes.");
