/**
 * Uninstall command
 *
 * Removes fuck-u-code related files from local system:
 * - Global config file (~/.fuckucoderc.json)
 * - Global npm package (eff-u-code)
 */

import { Command } from 'commander';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { unlink } from 'node:fs/promises';
import { exists } from '../../utils/fs.js';
import { t } from '../../i18n/index.js';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface CleanupResult {
	globalConfig: boolean;
	npmPackage: boolean;
	errors: string[];
}

async function removeGlobalConfig(): Promise<boolean> {
	try {
		const configPath = join(homedir(), '.fuckucoderc.json');
		if (await exists(configPath)) {
			await unlink(configPath);
			return true;
		}
		return false;
	} catch (error) {
		throw new Error(
			`Failed to remove config: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

async function uninstallNpmPackage(): Promise<boolean> {
	try {
		const { stderr } = await execAsync('npm uninstall -g eff-u-code');

		if (stderr.includes('not installed')) {
			return false;
		}

		return true;
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		if (errorMsg.includes('not installed') || errorMsg.includes('ERR! 404')) {
			return false;
		}
		throw new Error(`Failed to uninstall npm package: ${errorMsg}`);
	}
}

async function performCleanup(): Promise<CleanupResult> {
	const result: CleanupResult = {
		globalConfig: false,
		npmPackage: false,
		errors: [],
	};

	try {
		result.globalConfig = await removeGlobalConfig();
	} catch (error) {
		result.errors.push(error instanceof Error ? error.message : String(error));
	}

	try {
		result.npmPackage = await uninstallNpmPackage();
	} catch (error) {
		result.errors.push(error instanceof Error ? error.message : String(error));
	}

	return result;
}

export function createUninstallCommand(): Command {
	const command = new Command('uninstall');

	command
		.description(t('cmd_uninstall_description'))
		.addHelpText(
			'after',
			`
${t('cli_examples')}
  $ fuck-u-code uninstall    # ${t('uninstall_example')}
`
		)
		.action(async () => {
			try {
				console.log(chalk.yellow(t('uninstall_warning')));
				console.log(chalk.gray(t('uninstall_items')));
				console.log(chalk.gray('  - ' + t('uninstall_item_config')));
				console.log(chalk.gray('  - ' + t('uninstall_item_npm')));
				console.log();

				const answer = await inquirer.prompt<{ confirm: boolean }>([
					{
						type: 'confirm',
						name: 'confirm',
						message: t('uninstall_confirm'),
						default: false,
					},
				]);

				if (!answer.confirm) {
					console.log(chalk.yellow(t('uninstall_cancelled')));
					return;
				}

				console.log();
				console.log(chalk.blue(t('uninstall_processing')));

				const result = await performCleanup();

				console.log();
				if (result.globalConfig) {
					console.log(chalk.green('✓ ' + t('uninstall_removed_config')));
				} else {
					console.log(chalk.gray('- ' + t('uninstall_no_config')));
				}

				if (result.npmPackage) {
					console.log(chalk.green('✓ ' + t('uninstall_removed_npm')));
				} else {
					console.log(chalk.gray('- ' + t('uninstall_no_npm')));
				}

				if (result.errors.length > 0) {
					console.log();
					console.log(chalk.yellow('⚠️  Some operations failed:'));
					for (const error of result.errors) {
						console.log(chalk.yellow('  - ' + error));
					}
				}

				console.log();
				console.log(chalk.green(t('uninstall_complete')));
			} catch (error) {
				console.error(chalk.red(error instanceof Error ? error.message : String(error)));
				process.exit(1);
			}
		});

	return command;
}
