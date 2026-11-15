/**
 * External dependencies
 */
import { defineConfig } from 'vitest/config';

export default defineConfig( {
	oxc: {
		jsx: { runtime: 'automatic' },
	},
	test: {
		include: [ 'src/**/test/**/*.test.{ts,tsx}' ],
		passWithNoTests: true,
	},
} );
