#!/usr/bin/env node

/**
 * Measures how well the block markup skill works: sends each request in
 * `scripts/evaluation/cases.json` to a real model, the way the AI assistant
 * does, and records whether its edits applied on the first try and how
 * often it had to try again.
 *
 * The editor and the platforms run in Node, with the block library loaded
 * in a browser-like window. Vite loads the TypeScript sources and the
 * skill, as in the tests.
 *
 * Usage: npm run evaluate:skill -- --help
 */

/**
 * External dependencies
 */
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM( '<!doctype html><html><body></body></html>', {
	url: 'http://localhost/',
} );
globalThis.window = dom.window;
for ( const key of Object.getOwnPropertyNames( dom.window ) ) {
	if ( ! ( key in globalThis ) ) {
		try {
			globalThis[ key ] = dom.window[ key ];
		} catch {
			// Some window properties cannot be copied, and none of them are needed.
		}
	}
}

const server = await createServer( {
	root: import.meta.dirname + '/..',
	configFile: false,
	logLevel: 'error',
	appType: 'custom',
	server: { middlewareMode: true, hmr: false, ws: false },
	// WordPress packages import JSON without import attributes, which Node does not load on its own.
	ssr: { noExternal: [ /@wordpress\// ] },
	optimizeDeps: { noDiscovery: true, include: [] },
} );

let code = 1;
try {
	const { main } = await server.ssrLoadModule( '/scripts/evaluation/main.ts' );
	code = await main( process.argv.slice( 2 ) );
} catch ( error ) {
	// eslint-disable-next-line no-console -- A command line script reports through the console.
	console.error( error instanceof Error ? error.message : error );
} finally {
	await server.close();
}
process.exit( code );
