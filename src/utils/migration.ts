import { CommandGroupSettings } from '../types/settings';
import { generateGroupId, generateCommandId, hasLegacyIds } from './id-generator';

/**
 * Migration result information
 */
export interface MigrationResult {
	migrated: boolean;
	groupsUpdated: number;
	commandsUpdated: number;
}

/**
 * Migrate settings from legacy ID format to hash-based ID format
 *
 * This function:
 * - Converts legacy group IDs (group1, group2, etc.) to hash format (xxxxxxxxxxxx)
 * - Converts legacy command IDs (command1, command2, etc.) to hash format (xxxxxxxxxxxx)
 * - Removes nextGroupId and nextCommandId fields
 * - Preserves all other data
 *
 * @param settings The settings object to migrate
 * @returns Migration result with statistics
 */
export function migrateSettingsToHashIds(settings: any): MigrationResult {
	const result: MigrationResult = {
		migrated: false,
		groupsUpdated: 0,
		commandsUpdated: 0
	};

	// Check if migration is needed
	if (!hasLegacyIds(settings)) {
		// Also check for and remove legacy fields
		if ('nextGroupId' in settings || 'nextCommandId' in settings) {
			delete settings.nextGroupId;
			delete settings.nextCommandId;
			result.migrated = true;
			console.log('Removed legacy nextGroupId and nextCommandId fields');
		}
		return result;
	}

	console.log('Starting migration from legacy IDs to hash-based IDs...');

	// Migrate groups and commands
	for (const group of settings.commandGroups) {
		// Migrate group ID if legacy
		if (/^group\d+$/.test(group.id)) {
			const oldId = group.id;
			group.id = generateGroupId();
			result.groupsUpdated++;
			console.log(`Migrated group ID: ${oldId} -> ${group.id}`);
		}

		// Migrate command IDs if legacy
		for (const command of group.commands) {
			if (/^command\d+$/.test(command.id)) {
				const oldId = command.id;
				command.id = generateCommandId();
				result.commandsUpdated++;
				console.log(`Migrated command ID: ${oldId} -> ${command.id}`);
			}
		}
	}

	// Remove legacy fields
	if ('nextGroupId' in settings) {
		delete settings.nextGroupId;
		console.log('Removed nextGroupId field');
	}

	if ('nextCommandId' in settings) {
		delete settings.nextCommandId;
		console.log('Removed nextCommandId field');
	}

	result.migrated = true;
	console.log(`Migration complete: ${result.groupsUpdated} groups and ${result.commandsUpdated} commands updated`);

	return result;
}
