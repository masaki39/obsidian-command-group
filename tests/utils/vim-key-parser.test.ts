import { describe, expect, test } from '@jest/globals';
import { parseVimKey, formatKeyForDisplay } from '../../src/utils/vim-key-parser';

describe('parseVimKey', () => {
  describe('single character keys', () => {
    test('parses lowercase letter', () => {
      const result = parseVimKey('a');
      expect(result.modifiers).toEqual([]);
      expect(result.key).toBe('a');
    });

    test('parses uppercase letter', () => {
      const result = parseVimKey('Z');
      expect(result.modifiers).toEqual(['Shift']); // uppercase means Shift is held
      expect(result.key).toBe('z'); // key is lowercase
    });

    test('parses digit', () => {
      const result = parseVimKey('5');
      expect(result.modifiers).toEqual([]);
      expect(result.key).toBe('5');
    });

    test('parses special character (keyboard-dependent)', () => {
      // Special characters are accepted as-is, without keyboard layout mapping
      // The actual key matching happens at runtime based on keyboard events
      const result1 = parseVimKey('*');
      expect(result1.modifiers).toEqual([]);
      expect(result1.key).toBe('*');

      const result2 = parseVimKey('@');
      expect(result2.modifiers).toEqual([]);
      expect(result2.key).toBe('@');

      const result3 = parseVimKey('#');
      expect(result3.modifiers).toEqual([]);
      expect(result3.key).toBe('#');
    });
  });

  describe('special keys', () => {
    test('parses <Space>', () => {
      const result = parseVimKey('<Space>');
      expect(result.modifiers).toEqual([]);
      expect(result.key).toBe(' ');
    });

    test('parses <Tab>', () => {
      const result = parseVimKey('<Tab>');
      expect(result.modifiers).toEqual([]);
      expect(result.key).toBe('Tab');
    });

    test('rejects <CR> (reserved)', () => {
      // CR is mapped to Enter, which is reserved for modal navigation
      expect(() => parseVimKey('<CR>')).toThrow('reserved for modal navigation');
    });

    test('parses <F1>', () => {
      const result = parseVimKey('<F1>');
      expect(result.modifiers).toEqual([]);
      expect(result.key).toBe('F1');
    });

    test('parses <BS>', () => {
      const result = parseVimKey('<BS>');
      expect(result.modifiers).toEqual([]);
      expect(result.key).toBe('Backspace');
    });

    test('parses <Del>', () => {
      const result = parseVimKey('<Del>');
      expect(result.modifiers).toEqual([]);
      expect(result.key).toBe('Delete');
    });
  });

  describe('keys with modifiers', () => {
    test('parses <C-a> (Ctrl+a)', () => {
      const result = parseVimKey('<C-a>');
      expect(result.modifiers).toContain('Ctrl');
      expect(result.key).toBe('a');
    });

    test('parses <S-F1> (Shift+F1)', () => {
      const result = parseVimKey('<S-F1>');
      expect(result.modifiers).toContain('Shift');
      expect(result.key).toBe('F1');
    });

    test('parses <A-x> (Alt+x)', () => {
      const result = parseVimKey('<A-x>');
      expect(result.modifiers).toContain('Alt');
      expect(result.key).toBe('x');
    });

    test('parses <M-s> (Meta+s)', () => {
      const result = parseVimKey('<M-s>');
      expect(result.modifiers).toContain('Meta');
      expect(result.key).toBe('s');
    });

    test('parses <C-S-x> (Ctrl+Shift+x)', () => {
      const result = parseVimKey('<C-S-x>');
      expect(result.modifiers).toContain('Ctrl');
      expect(result.modifiers).toContain('Shift');
      expect(result.key).toBe('x');
    });

    test('parses <C-A-S-M-z> (all modifiers)', () => {
      const result = parseVimKey('<C-A-S-M-z>');
      expect(result.modifiers).toContain('Ctrl');
      expect(result.modifiers).toContain('Alt');
      expect(result.modifiers).toContain('Shift');
      expect(result.modifiers).toContain('Meta');
      expect(result.key).toBe('z');
    });
  });

  describe('reserved keys', () => {
    test('throws error for <Esc>', () => {
      expect(() => parseVimKey('<Esc>')).toThrow('reserved for modal navigation');
    });

    test('throws error for <Enter>', () => {
      expect(() => parseVimKey('<Enter>')).toThrow('reserved for modal navigation');
    });
  });

  describe('invalid input', () => {
    test('throws error for empty string', () => {
      expect(() => parseVimKey('')).toThrow('Key sequence cannot be empty');
    });

    test('throws error for whitespace only', () => {
      expect(() => parseVimKey('   ')).toThrow('Key sequence cannot be empty');
    });

    test('throws error for invalid multi-character string', () => {
      expect(() => parseVimKey('abc')).toThrow('Invalid key sequence');
    });

    test('throws error for unclosed angle bracket', () => {
      expect(() => parseVimKey('<C-a')).toThrow('Invalid key sequence');
    });

    test('throws error for unknown modifier', () => {
      expect(() => parseVimKey('<X-a>')).toThrow('Unknown modifier');
    });
  });

  describe('case sensitivity', () => {
    test('treats <C-a> differently from <c-a> in modifier case', () => {
      const result1 = parseVimKey('<C-a>');
      const result2 = parseVimKey('<c-a>');
      // Both should parse to the same result (modifiers normalized)
      expect(result1.modifiers).toEqual(result2.modifiers);
      expect(result1.key).toBe(result2.key);
    });

    test('uppercase letter A is equivalent to <S-a>', () => {
      const result1 = parseVimKey('A');
      const result2 = parseVimKey('<S-a>');
      // Both should produce Shift+a
      expect(result1.modifiers).toEqual(['Shift']);
      expect(result2.modifiers).toEqual(['Shift']);
      expect(result1.key).toBe('a');
      expect(result2.key).toBe('a');
    });

    test('uppercase single letter vs Vim-style shift notation', () => {
      // Single uppercase letter adds Shift automatically
      const shiftA = parseVimKey('A');
      expect(shiftA.modifiers).toEqual(['Shift']);
      expect(shiftA.key).toBe('a');

      // In angle brackets, uppercase is ignored (normalized to lowercase)
      // Use explicit <S-> for Shift
      const explicitShiftA = parseVimKey('<S-a>');
      expect(explicitShiftA.modifiers).toEqual(['Shift']);
      expect(explicitShiftA.key).toBe('a');

      // Ctrl+Shift+a requires explicit <C-S-a>
      const ctrlShiftA = parseVimKey('<C-S-a>');
      expect(ctrlShiftA.modifiers).toContain('Ctrl');
      expect(ctrlShiftA.modifiers).toContain('Shift');
      expect(ctrlShiftA.key).toBe('a');
    });

    test('modifier order independence', () => {
      // <C-S-x> and <S-C-x> should be treated as equivalent
      const result1 = parseVimKey('<C-S-x>');
      const result2 = parseVimKey('<S-C-x>');

      // Both should have the same modifiers (order may differ)
      expect(result1.modifiers.sort()).toEqual(result2.modifiers.sort());
      expect(result1.key).toBe(result2.key);

      // More complex example
      const result3 = parseVimKey('<C-A-S-M-z>');
      const result4 = parseVimKey('<M-S-A-C-z>');
      expect(result3.modifiers.sort()).toEqual(result4.modifiers.sort());
      expect(result3.key).toBe(result4.key);
    });
  });

  describe('duplicate detection scenarios', () => {
    test('different notations for same key should normalize to same result', () => {
      // For duplicate detection, these should be considered the same:
      const variations = [
        parseVimKey('A'),       // Uppercase letter
        parseVimKey('<S-a>'),   // Vim notation
        parseVimKey('<s-a>'),   // Lowercase modifier
      ];

      // All should normalize to Shift+a
      for (const result of variations) {
        expect(result.modifiers).toEqual(['Shift']);
        expect(result.key).toBe('a');
      }
    });

    test('different modifier orders should be comparable', () => {
      const result1 = parseVimKey('<C-S-x>');
      const result2 = parseVimKey('<S-C-x>');

      // For duplicate detection, need to sort modifiers before comparison
      const sorted1 = [...result1.modifiers].sort();
      const sorted2 = [...result2.modifiers].sort();

      expect(sorted1).toEqual(sorted2);
      expect(result1.key).toBe(result2.key);
    });

    test('case-insensitive modifier parsing', () => {
      const result1 = parseVimKey('<C-a>');
      const result2 = parseVimKey('<c-a>');

      expect(result1.modifiers).toEqual(result2.modifiers);
      expect(result1.key).toBe(result2.key);
    });
  });
});

describe('formatKeyForDisplay', () => {
  test('removes angle brackets from special keys', () => {
    expect(formatKeyForDisplay('<C-a>')).toBe('C-a');
    expect(formatKeyForDisplay('<Space>')).toBe('Space');
    expect(formatKeyForDisplay('<F1>')).toBe('F1');
  });

  test('returns single character as-is', () => {
    expect(formatKeyForDisplay('a')).toBe('a');
    expect(formatKeyForDisplay('Z')).toBe('Z');
  });

  test('handles empty string', () => {
    expect(formatKeyForDisplay('')).toBe('');
  });

  test('handles whitespace', () => {
    expect(formatKeyForDisplay('  <C-a>  ')).toBe('C-a');
  });
});
