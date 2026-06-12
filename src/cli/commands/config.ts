/**
 * Config command
 */

import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { readFile, writeFile } from 'node:fs/promises';
import { loadConfig, DEFAULT_CONFIG } from '#/config/index.js';
import { exists } from '#/utils/fs.js';
import { t } from '#/i18n/index.js';
import chalk from 'chalk';

/** Supported dot-notation keys for `config set` */
const SETTABLE_KEYS: Record<string, (config: Record<string, unknown>, value: string) => void> = {
  'i18n.locale': (config, value) => {
    if (!['en', 'zh'].includes(value)) {
      throw new Error(`Invalid locale: ${value}. Must be one of: en, zh`);
    }
    ensureObject(config, 'i18n');
    (config.i18n as Record<string, unknown>).locale = value;
  },
  'ai.provider': (config, value) => {
    const valid = ['openai', 'anthropic'];
    if (!valid.includes(value)) {
      throw new Error(`Invalid provider: ${value}. Must be one of: ${valid.join(', ')}`);
    }
    ensureObject(config, 'ai');
    (config.ai as Record<string, unknown>).provider = value;
    (config.ai as Record<string, unknown>).enabled = true;
  },
  'ai.model': (config, value) => {
    ensureObject(config, 'ai');
    (config.ai as Record<string, unknown>).model = value;
    (config.ai as Record<string, unknown>).enabled = true;
  },
  'ai.apiKey': (config, value) => {
    ensureObject(config, 'ai');
    (config.ai as Record<string, unknown>).apiKey = value;
    (config.ai as Record<string, unknown>).enabled = true;
  },
  'ai.baseUrl': (config, value) => {
    ensureObject(config, 'ai');
    (config.ai as Record<string, unknown>).baseUrl = value;
  },
  'ai.timeout': (config, value) => {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1 || n > 600) {
      throw new Error(`Invalid timeout: ${value}. Must be a number between 1 and 600.`);
    }
    ensureObject(config, 'ai');
    (config.ai as Record<string, unknown>).timeout = n;
  },
  'ai.maxRetries': (config, value) => {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 0 || n > 10) {
      throw new Error(`Invalid maxRetries: ${value}. Must be a number between 0 and 10.`);
    }
    ensureObject(config, 'ai');
    (config.ai as Record<string, unknown>).maxRetries = n;
  },
};

function ensureObject(obj: Record<string, unknown>, key: string): void {
  if (!obj[key] || typeof obj[key] !== 'object') {
    obj[key] = {};
  }
}

const CONFIG_SEARCH_PLACES = [
  '.fuckucoderc.json',
  '.fuckucoderc.yaml',
  '.fuckucoderc.yml',
  '.fuckucoderc.js',
  '.fuckucoderc.cjs',
  'fuckucode.config.js',
  'fuckucode.config.cjs',
  'fuckucode.config.mjs',
];

export function createConfigCommand(): Command {
  const command = new Command('config');

  command
    .description(t('cmd_config_description'))
    .option('-g, --global', 'Use global config (~/.fuckucoderc.json) instead of local')
    .argument('[action]', 'Action: show, init, set', 'show')
    .argument('[args...]', 'Arguments for the action')
    .addHelpText(
      'after',
      `
${t('cli_examples')}
  $ fuck-u-code config show                          # ${t('cmd_config_example_show')}
  $ fuck-u-code config init                          # ${t('cmd_config_example_init')}
  $ fuck-u-code config show ./my-project             # ${t('cmd_config_example_show_project')}
  $ fuck-u-code config set i18n.locale zh            # ${t('cmd_config_example_set_locale')}
  $ fuck-u-code config set ai.apiKey sk-xxx          # ${t('cmd_config_example_set_api_key')}
  $ fuck-u-code config set ai.baseUrl https://...    # ${t('cmd_config_example_set_base_url')}
  $ fuck-u-code config set ai.model gpt-4o           # ${t('cmd_config_example_set_model')}
  $ fuck-u-code config set ai.provider openai        # ${t('cmd_config_example_set_provider')}
  $ fuck-u-code config set -g ai.timeout 300         # ${t('cmd_config_example_set_global')}
`
    )
    .action(async (action: string, args: string[], options: { global?: boolean }) => {
      switch (action) {
        case 'show': {
          const projectPath = resolve(args[0] ?? '.');
          await showConfig(projectPath);
          break;
        }
        case 'init': {
          const projectPath = resolve(args[0] ?? '.');
          await initConfig(projectPath);
          break;
        }
        case 'set': {
          const key = args[0];
          const value = args[1];
          if (!key) {
            console.error(chalk.red(t('config_set_key_required')));
            process.exit(1);
          }
          if (value === undefined) {
            console.error(chalk.red(t('config_set_value_required')));
            process.exit(1);
          }
          await setConfig(key, value, options.global ?? false);
          break;
        }
        default:
          console.error(chalk.red(t('config_unknown_action', { action })));
          process.exit(1);
      }
    });

  return command;
}

async function showConfig(projectPath: string): Promise<void> {
  const config = await loadConfig(projectPath);
  console.log(chalk.bold.cyan(`\n${t('config_current')}\n`));
  console.log(chalk.gray(JSON.stringify(config, null, 2)));
}

async function initConfig(projectPath: string): Promise<void> {
  const configPath = join(projectPath, '.fuckucoderc.json');

  if (await exists(configPath)) {
    console.log(chalk.yellow(t('config_already_exists', { path: configPath })));
    return;
  }

  await writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', 'utf-8');
  console.log(chalk.green(t('config_created', { path: configPath })));
}

/**
 * Find an existing config file in the given directory (non-recursive).
 * Returns its path, or null if no config file is found.
 */
async function findLocalConfigFile(dir: string): Promise<string | null> {
  for (const name of CONFIG_SEARCH_PLACES) {
    const p = join(dir, name);
    if (await exists(p)) {
      return p;
    }
  }
  return null;
}

/**
 * Set a config value.
 * - If `--global` is set: always writes to ~/.fuckucoderc.json.
 * - Otherwise: if a local config file exists in cwd, writes to it;
 *   falls back to ~/.fuckucoderc.json.
 */
async function setConfig(key: string, value: string, useGlobal: boolean): Promise<void> {
  const setter = SETTABLE_KEYS[key];
  if (!setter) {
    console.error(chalk.red(t('config_set_invalid_key', { key })));
    console.error(chalk.gray(`Valid keys: ${Object.keys(SETTABLE_KEYS).join(', ')}`));
    process.exit(1);
  }

  const globalPath = join(homedir(), '.fuckucoderc.json');
  let configPath: string;

  if (useGlobal) {
    configPath = globalPath;
  } else {
    const localPath = await findLocalConfigFile(process.cwd());
    configPath = localPath ?? globalPath;
  }

  let config: Record<string, unknown> = {};

  if (await exists(configPath)) {
    try {
      const content = await readFile(configPath, 'utf-8');
      config = JSON.parse(content) as Record<string, unknown>;
    } catch (error) {
      console.error(chalk.red(t('warn_config_load_failed', { error: String(error) })));
      process.exit(1);
    }
  }

  try {
    setter(config, value);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  const where = configPath === globalPath ? t('config_set_global') : t('config_set_local');
  console.log(chalk.green(`${t('config_set_success', { key, value })} (${where})`));
}
