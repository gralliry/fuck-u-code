/**
 * MCP (Model Context Protocol) Server for fuck-u-code
 *
 * Exposes analyze and ai-review tools via stdio transport,
 * allowing AI tools to invoke code quality analysis and AI-powered code review.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolve } from 'node:path';
import { createAnalyzer } from '../analyzer/index.js';
import { loadConfig, createRuntimeConfig, loadAIConfig } from '../config/index.js';
import { createAIManager } from '../ai/index.js';
import { MarkdownOutput } from '../cli/output/markdown.js';
import { JsonOutput } from '../cli/output/json.js';
import { setLocale, type Locale } from '../i18n/index.js';
import type { RuntimeConfig } from '../config/schema.js';
import { VERSION } from '../version.js';

const SERVER_INSTRUCTIONS = `fuck-u-code is a code quality analyzer that scores projects on a 0-100 "shit mountain index".

## Available Tools

### analyze
Analyze a local project directory and return a code quality report with:
- Overall score (0-100, higher = worse)
- Per-file scores and issue breakdown
- Complexity, duplication, naming, structure, and error handling metrics
- A ranked list of the worst files

Use this tool when:
- The user asks you to review, analyze, or assess code quality
- The user mentions "code smell", "shit code", "clean code", or "refactoring"
- You want to identify problematic files before doing deeper review
- The user asks "how bad is this code" or similar questions

### ai-review
Run AI-powered code review on the worst-scoring files from a project.
This first runs the analyze step, then uses an external AI model (OpenAI or Anthropic)
to produce detailed, actionable review comments for each problem file.

Use this tool when:
- The user asks for detailed code review suggestions
- The user wants refactoring advice or security analysis
- The user says "review this code" or "find problems in this code"
- You need deeper, human-like analysis beyond metrics

Note: ai-review requires an API key configured in ~/.fuckucoderc.json (ai.apiKey, ai.model, ai.provider).

## Usage Tips
- Always pass an absolute path for reliable results
- Use format: 'json' when you need structured data to process programmatically
- Use format: 'markdown' when presenting results directly to the user
- The 'top' parameter controls how many worst files to include (default 10 for analyze, 5 for ai-review)
- Set verbose: true to get function-level detail and full issue lists`;

const server = new McpServer(
	{
		name: 'fuck-u-code',
		version: VERSION,
	},
	{
		instructions: SERVER_INSTRUCTIONS,
		capabilities: {
			tools: {},
		},
	}
);

/**
 * Build a RuntimeConfig from MCP tool parameters.
 */
async function buildRuntimeConfig(
	projectPath: string,
	options: { verbose?: boolean; locale?: string; top?: number }
): Promise<RuntimeConfig> {
	if (options.locale) {
		setLocale(options.locale as Locale);
	}

	const config = await loadConfig(projectPath);
	const overrides: Partial<import('../config/schema.js').Config> = { verbose: options.verbose };
	if (options.top !== undefined) {
		overrides.output = { top: options.top } as import('../config/schema.js').Config['output'];
	}
	return createRuntimeConfig(projectPath, config, overrides);
}

const DEFAULT_BASE_URLS: Record<string, string> = {
	openai: 'https://api.openai.com/v1',
	anthropic: 'https://api.anthropic.com',
};

server.registerTool(
	'analyze',
	{
		title: 'Analyze Code Quality',
		description:
			'Analyze a local code project and generate a code quality report with a 0-100 score (higher = worse), per-file breakdowns, metric analysis (complexity, duplication, naming, structure, error handling), and a ranked list of the worst files. Use this whenever you need to assess code quality, find problematic files, or check for code smells.',
		inputSchema: {
			path: z
				.string()
				.describe(
					'Absolute path to the project directory to analyze. Always resolve relative paths to absolute before passing.'
				),
			verbose: z
				.boolean()
				.optional()
				.default(false)
				.describe(
					'When true, returns full detail: function-level metrics, all issues per file, and extended statistics. Set to true for deep analysis, false for summary.'
				),
			format: z
				.enum(['console', 'markdown', 'json'])
				.optional()
				.default('json')
				.describe(
					'Output format. Use "json" for programmatic processing (full structured data), "markdown" for human-readable presentation, "console" for terminal display.'
				),
			top: z
				.number()
				.min(1)
				.max(50)
				.optional()
				.default(10)
				.describe(
					'How many of the worst-scoring files to include in the report. Higher values give more coverage but larger output.'
				),
			locale: z
				.enum(['en', 'zh'])
				.optional()
				.default('en')
				.describe('Output language: en (English), zh (Chinese).'),
		},
		annotations: {
			title: 'Analyze Code Quality',
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async ({ path: projectPath, verbose, format, top, locale }) => {
		const resolvedPath = resolve(projectPath);
		const runtimeConfig = await buildRuntimeConfig(resolvedPath, { verbose, locale, top });

		const analyzer = createAnalyzer(runtimeConfig);
		const result = await analyzer.analyze();

		let text: string;
		switch (format) {
			case 'json':
				text = new JsonOutput().render(result);
				break;
			case 'markdown':
			case 'console':
			default:
				text = new MarkdownOutput(runtimeConfig).render(result);
				break;
		}

		return { content: [{ type: 'text' as const, text }] };
	}
);

server.registerTool(
	'ai-review',
	{
		title: 'AI-Powered Code Review',
		description:
			'Run AI-powered code review on the worst-scoring files in a project. First analyzes the codebase to find problem files, then uses an external LLM (OpenAI/Anthropic) to generate detailed, actionable review comments for each file — including severity assessment, refactoring suggestions, security concerns, and maintainability recommendations. Use this when the user wants specific, human-quality feedback on their code.',
		inputSchema: {
			path: z
				.string()
				.describe(
					'Absolute path to the project directory to review. Always resolve relative paths to absolute before passing.'
				),
			model: z
				.string()
				.optional()
				.describe(
					'AI model name to use for review (e.g. gpt-4o, claude-3-opus). If omitted, uses the model from config file.'
				),
			provider: z
				.enum(['openai', 'anthropic'])
				.optional()
				.default('openai')
				.describe(
					'API format to use. "openai" works with OpenAI, DeepSeek, Ollama, and any OpenAI-compatible API. "anthropic" for Anthropic Claude models.'
				),
			baseUrl: z
				.string()
				.optional()
				.describe(
					'Custom API endpoint URL. Use for OpenAI-compatible services like DeepSeek (https://api.deepseek.com/v1) or local Ollama (http://localhost:11434/v1).'
				),
			apiKey: z
				.string()
				.optional()
				.describe(
					'API key for the AI service. If omitted, reads from config file (~/.fuckucoderc.json).'
				),
			top: z
				.number()
				.min(1)
				.max(20)
				.optional()
				.default(5)
				.describe(
					'How many of the worst files to review. Fewer files = faster. AI review is slower than plain analysis, so start small.'
				),
			locale: z
				.enum(['en', 'zh'])
				.optional()
				.default('en')
				.describe('Output language for review comments: en (English), zh (Chinese).'),
			verbose: z
				.boolean()
				.optional()
				.default(false)
				.describe(
					'When true, includes detailed per-function metrics in the prompt sent to the AI for richer context.'
				),
		},
		annotations: {
			title: 'AI-Powered Code Review',
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: true,
		},
	},
	async ({ path: projectPath, model, provider, baseUrl, apiKey, top, locale, verbose }) => {
		const resolvedPath = resolve(projectPath);
		setLocale(locale as Locale);

		const config = await loadConfig(resolvedPath);
		const runtimeConfig = createRuntimeConfig(resolvedPath, config, {
			verbose,
			ai: { enabled: true, provider, model },
		});

		const analyzer = createAnalyzer(runtimeConfig);
		const analysisResult = await analyzer.analyze();

		const worstFiles = analysisResult.fileResults
			.sort((a, b) => a.score - b.score)
			.slice(0, top);

		if (worstFiles.length === 0) {
			return {
				content: [
					{ type: 'text' as const, text: 'No files to review — all scores are clean.' },
				],
			};
		}

		const aiConfig = loadAIConfig(
			{
				enabled: true,
				provider,
				model,
				baseUrl: baseUrl || DEFAULT_BASE_URLS[provider],
				apiKey: apiKey || config.ai?.apiKey || '',
			},
			model
		);

		if (Object.keys(aiConfig.providers).length === 0) {
			return {
				content: [
					{
						type: 'text' as const,
						text: 'Error: No AI provider configured. Set ai.apiKey, ai.model, and ai.provider in ~/.fuckucoderc.json, or pass apiKey + model parameters.',
					},
				],
			};
		}

		const aiManager = createAIManager(aiConfig);
		const reviewParts: string[] = [];

		for (const [i, file] of worstFiles.entries()) {
			const score = 100 - file.score;
			const review = await aiManager.reviewCode(file);
			reviewParts.push(
				`## ${i + 1}. ${file.filePath}\n\n**Score: ${score.toFixed(1)}/100**\n\n${review}`
			);
		}

		const text = `# AI Code Review\n\n${reviewParts.join('\n\n---\n\n')}`;
		return { content: [{ type: 'text' as const, text }] };
	}
);

async function main(): Promise<void> {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((error: unknown) => {
	console.error('MCP server failed to start:', error);
	process.exit(1);
});
