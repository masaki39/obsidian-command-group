import { Modifier } from 'obsidian';

/**
 * Result of parsing a Vim-style key sequence
 */
export interface ParsedVimKey {
	modifiers: Modifier[];
	key: string;
}

/**
 * Special key mappings from Vim notation to DOM key names
 */
const SPECIAL_KEY_MAP: Record<string, string> = {
	'Esc': 'Escape',
	'CR': 'Enter',
	'Enter': 'Enter',
	'Return': 'Enter',
	'Tab': 'Tab',
	'Space': ' ',
	'BS': 'Backspace',
	'Backspace': 'Backspace',
	'Del': 'Delete',
	'Delete': 'Delete',
	'Home': 'Home',
	'End': 'End',
	'PageUp': 'PageUp',
	'PageDown': 'PageDown',
	// Function keys
	'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4',
	'F5': 'F5', 'F6': 'F6', 'F7': 'F7', 'F8': 'F8',
	'F9': 'F9', 'F10': 'F10', 'F11': 'F11', 'F12': 'F12',
};

/**
 * Keys that are reserved for modal navigation and cannot be used as sequence keys
 */
const RESERVED_KEYS = new Set([
	'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
	'Up', 'Down', 'Left', 'Right',
	'Enter', 'Escape'
]);

/**
 * Parse Vim-style key notation into Obsidian's scope.register() format
 *
 * Supported formats:
 * - Single character: 'a', '1', etc.
 * - Special keys: '<Esc>', '<CR>', '<Tab>', '<F1>', etc.
 * - With modifiers: '<C-a>', '<S-F1>', '<C-S-x>', etc.
 *
 * Modifiers:
 * - C = Ctrl
 * - S = Shift
 * - A = Alt
 * - M = Meta (Cmd on Mac, Win on Windows)
 *
 * @param input - Vim-style key notation
 * @returns Parsed key with modifiers and key name
 * @throws Error if the notation is invalid or uses a reserved key
 */
export function parseVimKey(input: string): ParsedVimKey {
	if (!input || input.trim() === '') {
		throw new Error('Key sequence cannot be empty');
	}

	const trimmed = input.trim();

	// Check if it's in angle bracket notation
	if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
		return parseAngleBracketNotation(trimmed);
	}

	// Single character (backwards compatible)
	if (trimmed.length === 1) {
		const char = trimmed.toLowerCase();
		return {
			modifiers: [],
			key: char
		};
	}

	throw new Error(`Invalid key sequence: ${input}. Use Vim notation like <C-a>, <Esc>, or single characters.`);
}

/**
 * Parse angle bracket notation like <C-a>, <Esc>, <F1>, etc.
 */
function parseAngleBracketNotation(input: string): ParsedVimKey {
	// Remove angle brackets
	const content = input.slice(1, -1);

	// Split by dash to get modifiers and key
	const parts = content.split('-');

	if (parts.length === 0) {
		throw new Error(`Invalid key sequence: ${input}`);
	}

	const modifiers: Modifier[] = [];
	let keyPart: string;

	if (parts.length === 1) {
		// No modifiers, just a special key like <Esc> or <F1>
		keyPart = parts[0];
	} else {
		// Has modifiers like <C-a> or <C-S-x>
		// Last part is the key, everything before is modifiers
		keyPart = parts[parts.length - 1];

		// Parse modifiers
		for (let i = 0; i < parts.length - 1; i++) {
			const mod = parts[i].toUpperCase();
			switch (mod) {
				case 'C':
					modifiers.push('Ctrl');
					break;
				case 'S':
					modifiers.push('Shift');
					break;
				case 'A':
					modifiers.push('Alt');
					break;
				case 'M':
					modifiers.push('Meta');
					break;
				default:
					throw new Error(`Unknown modifier: ${parts[i]} in ${input}`);
			}
		}
	}

	// Map the key part to the actual key name
	let key: string;

	// Check if it's a special key
	if (SPECIAL_KEY_MAP[keyPart]) {
		key = SPECIAL_KEY_MAP[keyPart];
	} else {
		// Regular character key
		key = keyPart.toLowerCase();
	}

	// Check for reserved keys
	if (RESERVED_KEYS.has(key)) {
		throw new Error(`Key "${key}" is reserved for modal navigation and cannot be used as a sequence key`);
	}

	return { modifiers, key };
}

/**
 * Format a key sequence for display in the UI
 * Strips angle brackets for cleaner look
 *
 * Examples:
 * - '<C-a>' -> 'C-a'
 * - '<Esc>' -> 'Esc'
 * - 'a' -> 'a'
 *
 * @param input - Original key sequence
 * @returns Formatted display string
 */
export function formatKeyForDisplay(input: string): string {
	if (!input) return '';

	const trimmed = input.trim();

	// Remove angle brackets if present
	if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
		return trimmed.slice(1, -1);
	}

	return trimmed;
}
