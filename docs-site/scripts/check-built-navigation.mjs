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
];

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
