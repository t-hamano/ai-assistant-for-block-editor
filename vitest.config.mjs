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
		server: {
			// WordPress packages import JSON without import attributes, which Node does not load on its own.
			deps: { inline: [ /@wordpress\// ] },
		},
	},
} );
