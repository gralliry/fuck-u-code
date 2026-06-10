/**
 * Configuration loader
 */

import { cosmiconfig } from 'cosmiconfig';
import { homedir } from 'node:os';
import { configSchema, DEFAULT_CONFIG, type Config, type RuntimeConfig } from './schema.js';
import { t } from '../i18n/index.js';
import type { Locale } from '../i18n/index.js';
import { logger } from '../utils/logger.js';
import type { AIConfig } from '../ai/types.js';

const MODULE_NAME = 'fuckucode';

const CONFIG_SEARCH_PLACES = [
  'package.json',
  `.${MODULE_NAME}rc`,
  `.${MODULE_NAME}rc.json`,
  `.${MODULE_NAME}rc.yaml`,
  `.${MODULE_NAME}rc.yml`,
  `.${MODULE_NAME}rc.js`,
  `.${MODULE_NAME}rc.cjs`,
  `${MODULE_NAME}.config.js`,
  `${MODULE_NAME}.config.cjs`,
  `${MODULE_NAME}.config.mjs`,
];

/**
 * Load configuration file
 * Search order: project path upward -> global ~/.fuckucoderc.json
 */
export async function loadConfig(projectPath: string): Promise<Config> {
  const explorer = cosmiconfig(MODULE_NAME, { searchPlaces: CONFIG_SEARCH_PLACES });

  try {
    // Search from project path upward
    const result = await explorer.search(projectPath);
    if (result?.config) {
      const parsed = configSchema.safeParse(result.config);
      if (parsed.success) {
        return mergeConfig(DEFAULT_CONFIG, parsed.data);
      }
      logger.warn(t('warn_config_validation_failed', { error: parsed.error.message }));
    }

    // Fall back to global config in home directory
    const globalResult = await explorer.search(homedir());
    if (globalResult?.config) {
      const parsed = configSchema.safeParse(globalResult.config);
      if (parsed.success) {
        return mergeConfig(DEFAULT_CONFIG, parsed.data);
      }
    }
  } catch (error) {
    logger.warn(t('warn_config_load_failed', { error: String(error) }));
  }

  return DEFAULT_CONFIG;
}

/**
 * Load locale from configuration file (lightweight, for CLI pre-parsing)
 * Search order: cwd upward -> global ~/.fuckucoderc.json
 */
export async function loadLocaleFromConfig(): Promise<Locale | undefined> {
  const explorer = cosmiconfig(MODULE_NAME, { searchPlaces: CONFIG_SEARCH_PLACES });
  try {
    const result = await explorer.search();
    const configObj = result?.config as Record<string, unknown> | undefined;
    let locale = (configObj?.i18n as Record<string, unknown> | undefined)?.locale as
      | string
      | undefined;

    // Fall back to global config
    if (!locale) {
      const globalResult = await explorer.search(homedir());
      const globalConfig = globalResult?.config as Record<string, unknown> | undefined;
      locale = (globalConfig?.i18n as Record<string, unknown> | undefined)?.locale as
        | string
        | undefined;
    }

    if (locale && ['en', 'zh'].includes(locale)) {
      return locale as Locale;
    }
  } catch (error) {
    logger.warn(t('warn_config_load_failed', { error: String(error) }));
  }
  return undefined;
}

/**
 * Load AI configuration from config file only
 * CLI flags override config file values
 */
export function loadAIConfig(configAI?: Config['ai'], cliModel?: string): AIConfig {
  const providers: AIConfig['providers'] = {};

  if (!configAI?.enabled || !configAI.apiKey || !configAI.model) {
    return { providers };
  }

  const provider = configAI.provider || 'openai';
  const model = cliModel || configAI.model;
  const baseUrl = configAI.baseUrl || getDefaultBaseUrl(provider);

  providers[provider] = {
    enabled: true,
    instances: [
      {
        name: 'default',
        enabled: true,
        format: provider === 'anthropic' ? 'anthropic' : 'openai',
        baseUrl,
        apiKey: configAI.apiKey,
        models: [model],
        maxTokens: 4096,
        temperature: 0.7,
        topP: 1,
        timeout: 60,
        maxRetries: 3,
      },
    ],
  };

  return {
    providers,
    defaultProvider: provider,
  };
}

function getDefaultBaseUrl(provider: string): string {
  const urls: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com',
  };
  return urls[provider] || 'https://api.openai.com/v1';
}

/**
 * Create runtime configuration
 */
export function createRuntimeConfig(
  projectPath: string,
  config: Config,
  cliOptions: Partial<Config> = {}
): RuntimeConfig {
  const merged = mergeConfig(config, cliOptions);
  const aiConfig = merged.ai.enabled ? loadAIConfig(merged.ai, merged.ai.model) : undefined;

  return {
    ...merged,
    projectPath,
    aiConfig,
  };
}

/**
 * Merge configurations
 */
function mergeConfig(base: Config, override: Partial<Config>): Config {
  return {
    ...base,
    ...override,
    exclude: override.exclude ?? base.exclude,
    include: override.include ?? base.include,
    output: { ...base.output, ...override.output },
    metrics: {
      ...base.metrics,
      ...override.metrics,
      weights: { ...base.metrics.weights, ...override.metrics?.weights },
    },
    ai: { ...base.ai, ...override.ai },
    i18n: { ...base.i18n, ...override.i18n },
  };
}

export { DEFAULT_CONFIG, configSchema, type Config, type RuntimeConfig };
