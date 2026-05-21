import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'tests/**/*.spec.ts'],
		alias: {
			obsidian: new URL('./tests/__mocks__/obsidian.ts', import.meta.url).pathname,
		},
	},
});
