import { describe, expect, test } from '@jest/globals';
import { SelectionItem } from '../../src/modals/arrow-key-selection-modal';

describe('SelectionItem interface', () => {
	describe('item structure', () => {
		test('items should have correct properties', () => {
			const testItems: SelectionItem[] = [
				{
					id: 'cmd_1',
					name: 'Test Command 1',
					commandId: 'test:command-1',
					sequenceKey: 'a'
				},
				{
					id: 'cmd_2',
					name: 'Test Command 2',
					commandId: 'test:command-2',
					sequenceKey: 'A'
				},
				{
					id: 'cmd_3',
					name: 'Test Command 3',
					commandId: 'test:command-3',
					sequenceKey: '<C-x>'
				},
				{
					id: 'cmd_4',
					name: 'Test Command 4',
					commandId: 'test:command-4'
					// No sequence key
				}
			];

			expect(testItems).toHaveLength(4);
			expect(testItems[0].sequenceKey).toBe('a');
			expect(testItems[1].sequenceKey).toBe('A');
			expect(testItems[2].sequenceKey).toBe('<C-x>');
			expect(testItems[3].sequenceKey).toBeUndefined();
		});

		test('items with sequence keys are unique', () => {
			const testItems: SelectionItem[] = [
				{ id: 'cmd_1', name: 'Cmd 1', commandId: 'test:1', sequenceKey: 'a' },
				{ id: 'cmd_2', name: 'Cmd 2', commandId: 'test:2', sequenceKey: 'b' },
				{ id: 'cmd_3', name: 'Cmd 3', commandId: 'test:3', sequenceKey: 'c' }
			];

			const keysWithSequence = testItems
				.filter(item => item.sequenceKey)
				.map(item => item.sequenceKey);

			// All defined sequence keys should be unique
			const uniqueKeys = new Set(keysWithSequence);
			expect(keysWithSequence.length).toBe(uniqueKeys.size);
		});
	});

	describe('sequence key formats', () => {
		test('supports lowercase letter sequence keys', () => {
			const item: SelectionItem = {
				id: 'cmd_lower',
				name: 'Lowercase',
				commandId: 'test:lower',
				sequenceKey: 'a'
			};

			expect(item.sequenceKey).toBe('a');
		});

		test('supports uppercase letter sequence keys (Shift+letter)', () => {
			const item: SelectionItem = {
				id: 'cmd_upper',
				name: 'Uppercase',
				commandId: 'test:upper',
				sequenceKey: 'A'
			};

			expect(item.sequenceKey).toBe('A');
		});

		test('supports modifier key combinations', () => {
			const item: SelectionItem = {
				id: 'cmd_modifier',
				name: 'With Modifier',
				commandId: 'test:modifier',
				sequenceKey: '<C-x>'
			};

			expect(item.sequenceKey).toBe('<C-x>');
		});

		test('supports items without sequence keys', () => {
			const item: SelectionItem = {
				id: 'cmd_no_key',
				name: 'No Key',
				commandId: 'test:no-key'
			};

			expect(item.sequenceKey).toBeUndefined();
		});
	});

	describe('special character sequence keys', () => {
		test('allows special characters as sequence keys', () => {
			const specialCharItems: SelectionItem[] = [
				{
					id: 'cmd_special_1',
					name: 'Command with *',
					commandId: 'test:asterisk',
					sequenceKey: '*'
				},
				{
					id: 'cmd_special_2',
					name: 'Command with @',
					commandId: 'test:at',
					sequenceKey: '@'
				},
				{
					id: 'cmd_special_3',
					name: 'Command with #',
					commandId: 'test:hash',
					sequenceKey: '#'
				}
			];

			expect(specialCharItems).toHaveLength(3);
			expect(specialCharItems[0].sequenceKey).toBe('*');
			expect(specialCharItems[1].sequenceKey).toBe('@');
			expect(specialCharItems[2].sequenceKey).toBe('#');
		});
	});

	describe('edge cases', () => {
		test('handles empty item list', () => {
			const emptyItems: SelectionItem[] = [];
			expect(emptyItems).toHaveLength(0);
		});

		test('handles single item', () => {
			const singleItem: SelectionItem[] = [{
				id: 'cmd_single',
				name: 'Single Command',
				commandId: 'test:single',
				sequenceKey: 's'
			}];

			expect(singleItem).toHaveLength(1);
			expect(singleItem[0].sequenceKey).toBe('s');
		});
	});
});
