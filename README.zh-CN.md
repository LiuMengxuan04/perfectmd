# PerfectMD

[English](./README.md) | [简体中文](./README.zh-CN.md)

一个现代化 Markdown 编辑器，结合了 Typora 的简洁体验与 Word 风格的富文本能力。
欢迎访问 [PerfectMD 的 DeepWiki 页面](https://deepwiki.com/ssbsunshengbo/perfectmd) 了解更多项目详情。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## ✨ 功能特性

- **富文本格式**：加粗、斜体、下划线、删除线、行内代码
- **文本样式**：文字颜色、高亮颜色、字号调整
- **标题**：支持 H1、H2、H3，可视化识别
- **列表**：无序列表与有序列表
- **块级元素**：引用块、分隔线
- **链接**：便捷插入链接
- **深色模式**：完整的深浅色主题支持
- **自动保存**：防抖自动保存
- **文档管理**：新建、删除、置顶文档
- **搜索**：快速检索文档
- **导出**：导出为 Markdown 格式
- **备份/恢复**：完整的数据备份与恢复
- **本地存储**：所有数据保存在浏览器本地（IndexedDB）

## 📝 Markdown 自动转换

PerfectMD 支持在编辑器中直接输入 Markdown 语法，并自动转换为富文本。

### 块级语法（触发后自动转换）

- `# ` -> H1
- `## ` -> H2
- `### ` -> H3
- `> ` -> 引用块
- `- ` / `* ` -> 无序列表
- `1. ` -> 有序列表
- `---` / `***` + `Enter` -> 分隔线

### 行内语法（空格触发自动转换）

- `**text**` -> 加粗
- `*text*` / `_text_` -> 斜体
- `~~text~~` / `～～text～～` -> 删除线
- `` `text` `` -> 行内代码
- `++text++` / `<u>text</u>` -> 下划线
- `[label](https://example.com)` -> 链接

### 编辑稳定性说明

- 颜色和高亮仅作用于选中文本，避免样式状态泄漏到后续输入。
- 行内转换并换行后，光标会被归一化到干净段落上下文，防止样式继承到下一行。
- 标题快捷语法（如 `##`）按“当前行块”解析，避免误回落到上一行。

### Enter 与 Shift+Enter 的行为差异

- `Enter`：创建新段落（新块）。常规写作以及继续使用 `##`、`>`、列表等块级 Markdown 语法时推荐使用。
- `Shift+Enter`：在当前段落/块内插入软换行（不会创建新块）。
- 若希望下一行应用不同块级格式（如切换为标题），请使用 `Enter` 而不是 `Shift+Enter`。

## 📥 下载与安装

### 下载桌面应用

前往 [Releases](https://github.com/ssbsunshengbo/perfectmd/releases) 页面下载对应平台安装包：

| 平台 | 下载 |
|----------|----------|
| Windows | `.msi` 或 `.exe` 安装包 |
| macOS | `.dmg` 安装包 |
| Linux | `.deb` 或 `.AppImage` |

### 从源码运行

```bash
# 克隆仓库
git clone https://github.com/ssbsunshengbo/perfectmd.git
cd perfectmd

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 浏览器打开 http://localhost:3000
```

## 🚀 自行部署

### 部署到 Vercel（在线版本）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ssbsunshengbo/perfectmd)

### 本地构建桌面应用

**前置依赖：**
- Node.js 18+
- Rust（安装地址：https://rustup.rs）

```bash
# 安装依赖
npm install

# 构建桌面应用
npm run tauri:build
```

安装包输出目录：`src-tauri/target/release/bundle/`。

## 🔧 技术栈

- **框架**：[Next.js 16](https://nextjs.org/)
- **语言**：[TypeScript 5](https://www.typescriptlang.org/)
- **样式**：[Tailwind CSS 4](https://tailwindcss.com/)
- **UI 组件**：[shadcn/ui](https://ui.shadcn.com/)
- **状态管理**：[Zustand](https://zustand-demo.pmnd.rs/)
- **存储**：IndexedDB（浏览器本地存储）
- **桌面端**：[Tauri 2.0](https://tauri.app/)
- **图标**：[Lucide React](https://lucide.dev/)

## 💾 数据存储

本应用使用 **IndexedDB** 进行本地存储：
- 所有数据存储在你的浏览器/设备中
- 无需服务器
- 支持离线使用
- 支持导出/备份

## ⌨️ 快捷键

| 快捷键 | 功能 |
|----------|--------|
| `Ctrl/Cmd + B` | 加粗 |
| `Ctrl/Cmd + I` | 斜体 |
| `Ctrl/Cmd + U` | 下划线 |
| `Ctrl/Cmd + S` | 保存文档 |
| `Tab` | 插入缩进 |

## 🤝 参与贡献

欢迎贡献！欢迎提交 Pull Request。

## 📝 许可证

本项目基于 MIT License 开源。

---

Made with ❤️
