# archNotes

一套研究 NVIDIA GPU、Groq LPU/TSP、Tenstorrent Tensix 与 Google TPU 的架构笔记和可执行教学实验。

内容入口：

- [文档首页](docs/index.md)
- [主题矩阵](docs/topics.md)
- [多架构学习路线](docs/notes/learning-roadmap.md)
- [四类加速器统一对照](docs/notes/ai-accelerator-architecture-comparison.md)
- [资料目录](docs/sources/catalog.md)
- [术语表](docs/glossary.md)

## 内容与发布边界

`docs/` 是唯一内容源。标题、描述、链接、正文图片和图表都必须在 Markdown 中完成；`docs-site/` 只负责确定性地把这些文件渲染为网站，不生成或回写内容。

正文图表使用 `docs/assets/diagrams/*.svg`，可编辑源文件使用同名 `.mmd`。修改 `.mmd` 后运行图表导出命令，再提交 Markdown、`.mmd` 和 `.svg`。

## 教学实验

```bash
python3 labs/static_scheduler/scheduler.py \
  labs/static_scheduler/programs/vector_add.json

python3 labs/tensix_pipeline/simulator.py \
  labs/tensix_pipeline/programs/eltwise_tiles.json

python3 labs/systolic_array/simulator.py \
  labs/systolic_array/programs/matmul_partial_tile.json

python3 -m unittest discover -s tests -v
```

这些实验基于公开机制建立简化模型，不是厂商 simulator，也不能预测真实芯片的 wall-clock performance。

## 站点检查

在 `docs-site/` 中执行：

```bash
npm run check
npm run build
```

需要修改图表时执行：

```bash
npm run diagrams
```
