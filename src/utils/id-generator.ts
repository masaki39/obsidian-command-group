/**
 * Lightweight nanoid implementation for generating unique IDs
 * No external dependencies required
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 12;

/**
 * Generate a random ID using nanoid-style approach
 * @param length Length of the ID (default: 12)
 * @returns Random string ID
 */
function nanoid(length: number = ID_LENGTH): string {
	let id = '';
	const randomValues = new Uint8Array(length);
	crypto.getRandomValues(randomValues);

	for (let i = 0; i < length; i++) {
		// Use modulo to map random byte to alphabet index
		id += ALPHABET[randomValues[i] % ALPHABET.length];
	}

	return id;
}

/**
 * Generate a unique group ID with hash format
 * @returns Group ID in format "xxxxxxxxxxxx"
 */
export function generateGroupId(): string {
	return `${nanoid()}`;
}

/**
 * Generate a unique command ID with hash format
 * @returns Command ID in format "cmd_xxxxxxxxxxxx"
 */
export function generateCommandId(): string {
	return `cmd_${nanoid()}`;
}

/**
 * Check if an ID is in legacy format (e.g., "group1", "command1")
 * @param id The ID to check
 * @returns True if the ID is in legacy format
 */
export function isLegacyId(id: string): boolean {
	// Legacy IDs are in format "group1", "group2", "command1", "command2", etc.
	return /^(group|command)\d+$/.test(id);
}

/**
 * Check if any group or command has a legacy ID
 * @param settings The settings object to check
 * @returns True if any legacy IDs are found
 */
export function hasLegacyIds(settings: { commandGroups: { id: string; commands: { id: string }[] }[] }): boolean {
	// Check group IDs
	for (const group of settings.commandGroups) {
		if (isLegacyId(group.id)) {
			return true;
		}

		// Check command IDs
		for (const command of group.commands) {
			if (isLegacyId(command.id)) {
				return true;
			}
		}
	}

	return false;
}
