# fuck-u-code [![中文](https://img.shields.io/badge/文档-简体中文-blue?style=flat-square)](README_ZH.md) [![English](https://img.shields.io/badge/Docs-English-red?style=flat-square)](README.md)

> [!Important]
> 📢 记住这个命令：fuck-u-code - 让代码不再烂到发指！

一款专门揭露屎山代码的质量分析工具，用犀利又搞笑的方式告诉你：**你的代码到底有多烂**。

## 特性

* **多语言支持**: Go, JavaScript, TypeScript, Python, Java, C, C++, Rust, C#, Lua, PHP, Ruby, Swift, Shell（14 种语言）
* **总体评分**: 0~100 分，越高代码质量越好
* **糟糕指数**: 单文件评分，越高越烂
* **七维度检测**: 复杂度 / 代码量 / 注释率 / 错误处理 / 命名 / 重复度 / 结构
* **AST 解析**: 基于 tree-sitter 的精确语法分析
* **AI 代码审查**: 集成 OpenAI 兼容 / Anthropic（DeepSeek、Ollama 可通过自定义 base URL 使用）
* **多格式输出**: 终端彩色 / Markdown / JSON / HTML
* **i18n**: 中文 / 英文
* **灵活配置**: `.fuckucoderc.json` 等多种格式，支持项目级和全局配置

> [!Note]
> 代码分析全程本地运行，不上传代码，安全无忧。
> AI 审查需要调用外部 API。

## 与原库的区别

本 Fork 基于原版 `fuck-u-code`，重点进行了**精简和 Bug 修复**：

| 方面 | 原版 | 本 Fork |
| ---- | ------------- | ------------------- |
| **AI 提供商** | 5 种（OpenAI、Anthropic、DeepSeek、Gemini、Ollama） | **2 种格式**（openai + anthropic）。DeepSeek/Ollama 仍可通过自定义 `--base-url` 使用 |
| **AI 配置方式** | 混用：环境变量（`OPENAI_API_KEY`、`DEEPSEEK_API_KEY` 等）+ 配置文件 + CLI | **统一**：仅配置文件 + CLI，去除环境变量自动检测，更简洁、行为更可预测 |
| **mcp-install** | 独立命令，自动配置 MCP | **已移除** — 文档中的 MCP 配置说明已足够清晰 |
| **uninstall** | 移除全局配置、MCP 配置（Claude/Cursor）、npm 包 | **已移除** — 简化：无需全局包管理 |
| **MCP Server** | 基础工具注册 | **增强** — 更详细的描述、工具注解（annotations）、`instructions`、参数约束（min/max） |
| **Bug 修复** | — | 修复嵌套回调行数统计、箭头函数边界检测、SSH URL 正则、缺失目标目录的错误处理等 |

## 安装

源码构建：

```bash
git clone https://github.com/fuck-u-code/fuck-u-code.git
cd fuck-u-code && npm install && npm run build
```

或从 Releases 页面下载预构建的二进制文件。

## 使用

### 代码分析

```bash
fuck-u-code analyze              # 分析当前目录
fuck-u-code analyze ./src        # 分析指定目录
fuck-u-code analyze . -v         # 详细模式（项目概览、语言分布、函数级指标）
fuck-u-code analyze . -t 20      # 显示最差的 20 个文件
fuck-u-code analyze . -l zh      # 中文输出
fuck-u-code analyze . -f markdown              # Markdown 终端渲染
fuck-u-code analyze . -f markdown -o report.md # 导出 Markdown
fuck-u-code analyze . -f html -o report.html   # 导出 HTML
fuck-u-code analyze . -f json -o report.json   # 导出 JSON
fuck-u-code analyze . -e "**/*.test.ts"        # 排除测试文件
```

| 选项                | 简写 | 说明                             |
| ------------------- | ---- | -------------------------------- |
| `--verbose`         | `-v` | 详细输出                         |
| `--top <n>`         | `-t` | 最差前 N 个文件（默认 10）       |
| `--format <fmt>`    | `-f` | 格式: console/markdown/json/html |
| `--output <file>`   | `-o` | 输出到文件                       |
| `--exclude <glob>`  | `-e` | 额外排除模式                     |
| `--concurrency <n>` | `-c` | 并发数（默认 8）                 |
| `--locale <lang>`   | `-l` | 语言: en/zh                       |

### AI 代码审查

需先配置 AI 提供商（见 [AI 配置](#ai-配置)）。

```bash
fuck-u-code ai-review . -m gpt-4o                                    # OpenAI 格式
fuck-u-code ai-review . -p anthropic -m claude-sonnet-4-5-20250929   # Anthropic 格式
fuck-u-code ai-review . -m gpt-4o -t 3                               # 审查最差 3 个文件
fuck-u-code ai-review . -m gpt-4o -f markdown -o review.md           # 导出 Markdown
fuck-u-code ai-review . --timeout 300 -m gpt-4o                       # 自定义超时（思考模型建议加长）
fuck-u-code ai-review . -b https://api.deepseek.com/v1 -k sk-xxx -m deepseek-chat  # DeepSeek（OpenAI 格式）
```

| 选项                | 简写 | 说明                       |
| ------------------- | ---- | -------------------------- |
| `--model <model>`   | `-m` | 模型名称（必填）           |
| `--provider <name>` | `-p` | 格式: openai / anthropic   |
| `--base-url <url>`  | `-b` | 自定义 API 端点            |
| `--api-key <key>`   | `-k` | API 密钥                   |
| `--timeout <秒>`    |      | 请求超时秒数（默认 120）。思考模型建议调大 |
| `--top <n>`         | `-t` | 审查最差前 N 个文件（默认 5）                   |
| `--format <fmt>`    | `-f` | 格式: console/markdown/html                     |
| `--output <file>`   | `-o` | 输出到文件                                      |
| `--verbose`         | `-v` | 详细输出                                        |
| `--locale <lang>`   | `-l` | 语言: en/zh                       |

### 配置管理

```bash
fuck-u-code config init                    # 生成 .fuckucoderc.json
fuck-u-code config show                    # 查看当前配置
fuck-u-code config set i18n.locale zh      # 设置默认语言
fuck-u-code config set ai.provider openai  # 设置 AI 提供商
fuck-u-code config set ai.model gpt-4o     # 设置 AI 模型
fuck-u-code config set ai.apiKey sk-xxx    # 设置 API 密钥
```

## 配置文件

通过配置文件自动搜索，优先级：项目目录向上查找 > 全局配置 `~/.fuckucoderc.json`。

支持格式：`.fuckucoderc.json` / `.yaml` / `.js` / `fuckucode.config.js` / `package.json` 中的 `"fuckucode"` 字段。

全局配置路径：macOS/Linux `~/.fuckucoderc.json`，Windows `C:\Users\<用户名>\.fuckucoderc.json`。

完整示例（`.fuckucoderc.json`）：

```json
{
  "exclude": ["**/*.test.ts", "docs/**"],
  "include": ["**/*"],
  "concurrency": 8,
  "verbose": false,
  "output": {
    "format": "console",
    "top": 10,
    "maxIssues": 5,
    "showDetails": true
  },
  "metrics": {
    "weights": {
      "complexity": 0.32,
      "duplication": 0.20,
      "size": 0.18,
      "structure": 0.12,
      "error": 0.08,
      "documentation": 0.05,
      "naming": 0.05
    }
  },
  "ai": {
    "enabled": true,
    "provider": "openai",
    "model": "gpt-4o",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-your-api-key",
    "timeout": 300,
    "maxRetries": 2
  },
  "i18n": {
    "locale": "zh"
  }
}
```

## AI 配置

支持 2 种格式，优先级：命令行参数 > 配置文件（`~/.fuckucoderc.json`）。

| 格式         | 配置方式                               | CLI 示例                                                  |
| ------------ | -------------------------------------- | --------------------------------------------------------- |
| OpenAI 兼容  | 配置文件中设置 `ai.provider: "openai"` | `ai-review . -m gpt-4o`                                   |
| Anthropic    | 配置文件中设置 `ai.provider: "anthropic"` | `ai-review . -p anthropic -m claude-sonnet-4-5-20250929` |

> **说明：** DeepSeek、Ollama 等 OpenAI 兼容 API 可通过 `--base-url` 配合 `openai` 格式使用。

```bash
# 通过配置文件
fuck-u-code config set ai.provider openai
fuck-u-code config set ai.model gpt-4o
fuck-u-code config set ai.apiKey sk-your-key
fuck-u-code config set ai.baseUrl https://api.openai.com/v1
```

## MCP Server

fuck-u-code 提供 MCP (Model Context Protocol) Server，让 Claude Code、Cursor、Windsurf 等 AI 工具可以直接调用代码质量分析和 AI 代码审查功能。

### 配置方式

首先从源码构建，然后配置你的 AI 工具：

**Claude Code**（`~/.claude.json` 或项目 `.mcp.json`）：

```json
{
  "mcpServers": {
    "fuck-u-code": {
      "command": "fuck-u-code-mcp"
    }
  }
}
```

**Cursor**（`.cursor/mcp.json`）：

```json
{
  "mcpServers": {
    "fuck-u-code": {
      "command": "fuck-u-code-mcp"
    }
  }
}
```

### 可用工具

- **analyze** — 分析代码质量并生成评分报告
- **ai-review** — 对评分最差的文件执行 AI 代码审查

## 文件排除

工具自动读取 `.gitignore`（含子目录），遵循标准 gitignore 规则。额外排除可用 `--exclude` 或配置文件的 `exclude` 字段。

---

MIT License · ⭐ 在 GitHub 上点 Star
