import { Notice, Plugin } from 'obsidian';
import { CommandGroupSettings, DEFAULT_SETTINGS } from './types/settings';
import { migrateSettingsToHashIds } from './utils/migration';
import { ArrowKeySelectionModal, SelectionItem } from './modals/arrow-key-selection-modal';
import { CommandSettingTab } from './settings/command-setting-tab';

/**
 * Main plugin class for Command Group
 */
export class CommandGroupPlugin extends Plugin {
	settings: CommandGroupSettings;

	async onload() {
		try {
			await this.loadSettings();

			// Register commands for each command group
			this.app.workspace.onLayoutReady(() => { this.registerGroupCommands();});

			// Add settings tab
			this.addSettingTab(new CommandSettingTab(this.app, this));
		} catch (error) {
			console.error('Error loading plugin:', error);
			new Notice('Error loading Command Group plugin. Check console for details.');
		}
	}

	onunload() {
		// Cleanup when plugin is disabled
		try {
			// Clean up registered commands
			const commands = (this.app as any).commands;
			if (commands && typeof commands.removeCommand === 'function') {
				// Find commands registered by this plugin
				const pluginCommands = Object.values(this.app.commands.commands)
					.filter(cmd => cmd.id.startsWith(`${this.manifest.id}:`));

				// Remove each command
				pluginCommands.forEach(cmd => {
					try {
						commands.removeCommand(cmd.id);
					} catch (error) {
						console.error(`Error removing command ${cmd.id}:`, error);
					}
				});

				console.log(`Command Group: Cleaned up ${pluginCommands.length} commands`);
			}

			// Clean up any settings tab event listeners
			// Will be handled by CommandSettingTab when extracted
		} catch (error) {
			console.error('Error during plugin cleanup:', error);
		}
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

		// 古いデータ形式からの移行処理
		// data.jsonに古いcommandsプロパティが存在する場合は削除
		if (data && 'commands' in data) {
			// 古いcommandsプロパティを削除
			delete (this.settings as any).commands;
			console.log('Migrated from old data format (removed commands property)');
		}

		// Migrate from legacy IDs (group1, command1) to hash-based IDs
		const migrationResult = migrateSettingsToHashIds(this.settings);

		if (migrationResult.migrated) {
			// Save migrated settings
			await this.saveSettings();

			// Notify user about migration
			const message = migrationResult.groupsUpdated > 0 || migrationResult.commandsUpdated > 0
				? `Command Group: Migrated to new ID format. ${migrationResult.groupsUpdated} groups and ${migrationResult.commandsUpdated} commands updated. Please reassign hotkeys for command groups.`
				: 'Command Group: Settings updated to new format.';

			new Notice(message, 10000); // Show for 10 seconds
			console.log('Migration completed:', migrationResult);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Save settings and re-register commands
	async saveSettingsAndRegisterCommands() {
		try {
			await this.saveSettings();
			this.registerGroupCommands(); // Re-register commands
		} catch (error) {
			console.error('Error saving settings and registering commands:', error);
			new Notice('Failed to save settings. Check console for details.');
			throw error; // 呼び出し元でもエラーハンドリングできるように再スロー
		}
	}

	// Register Obsidian commands for each command group
	registerGroupCommands() {
		try {
			// Get currently registered plugin commands
			const existingCommands = Object.values(this.app.commands.commands)
				.filter(cmd => cmd.id.startsWith(`${this.manifest.id}:`));

			// List of command IDs that no longer exist in current settings
			const commandIdsToRemove = new Set(
				existingCommands.map(cmd => cmd.id.replace(`${this.manifest.id}:`, ''))
			);

			// Register commands for each group
			this.settings.commandGroups.forEach(group => {
				const commandId = `${group.id}`;

				// Remove this command from the removal list (still in use)
				commandIdsToRemove.delete(commandId);

				// Register command (existing commands will be overwritten)
				this.addCommand({
					id: commandId,
					name: `${group.name}`,
					callback: () => {
						// コマンドがない場合の処理
						if (group.commands.length === 0) {
							new Notice('No commands in this group');
							return;
						}

						// コマンドが1つの場合は直接実行
						if (group.commands.length === 1) {
							const command = group.commands[0];
							try {
								// コマンドが存在するか確認
								const obsidianCommand = this.app.commands.findCommand(command.obsidianCommand);
								if (!obsidianCommand) {
									new Notice(`Command not found: ${command.obsidianCommand}`);
									console.error(`Command not found: ${command.obsidianCommand}`);
									return;
								}

								const success = this.app.commands.executeCommandById(command.obsidianCommand);
								if (!success) {
									new Notice(`Failed to execute command: ${obsidianCommand.name}`);
									console.error(`Failed to execute command: ${command.obsidianCommand}`);
								}
							} catch (error) {
								console.error(`Error executing command ${command.obsidianCommand}:`, error);
								new Notice(`Error executing command: ${error instanceof Error ? error.message : String(error)}`);
							}
							return;
						}

						// 複数のコマンドがある場合は選択モーダルを表示
						// Convert commands to selection items
						const items: SelectionItem[] = group.commands.map(cmd => {
							const obsidianCommand = this.app.commands.findCommand(cmd.obsidianCommand);
							return {
								id: cmd.id,
								name: obsidianCommand ? obsidianCommand.name : 'Invalid command',
								commandId: cmd.obsidianCommand,
								sequenceKey: cmd.sequenceKey
							};
						});

						new ArrowKeySelectionModal(
							this.app,
							group.name,
							items,
							(selectedItem) => {
								// Execute the selected command
								try {
									const command = this.app.commands.findCommand(selectedItem.commandId);
									if (!command) {
										new Notice(`Command not found: ${selectedItem.name} (${selectedItem.commandId})`);
										console.error(`Command not found: ${selectedItem.commandId}`);
										return;
									}

									const success = this.app.commands.executeCommandById(selectedItem.commandId);
									if (!success) {
										new Notice(`Failed to execute command: ${selectedItem.name}`);
										console.error(`Failed to execute command: ${selectedItem.commandId}`);
									}
								} catch (error) {
									console.error(`Error executing command ${selectedItem.commandId}:`, error);
									new Notice(`Error executing command: ${error instanceof Error ? error.message : String(error)}`);
								}
							}
						).open();
					}
				});
			});

			// Remove unused commands
			if (commandIdsToRemove.size > 0) {
				console.log(`Command Group: ${commandIdsToRemove.size} unused commands will be removed`);

				// Actually remove the commands
				// Use Obsidian's internal API to remove commands
				// Note: This is an internal API and may change in the future
				const commands = (this.app as any).commands;
				if (commands && typeof commands.removeCommand === 'function') {
					try {
						commandIdsToRemove.forEach(commandId => {
							const fullCommandId = `${this.manifest.id}:${commandId}`;
							commands.removeCommand(fullCommandId);
						});
					} catch (error) {
						console.error('Error removing commands:', error);
					}
				}
			}
		} catch (error) {
			console.error('Error registering group commands:', error);
			new Notice('Error registering commands. Check console for details.');
		}
	}
}
