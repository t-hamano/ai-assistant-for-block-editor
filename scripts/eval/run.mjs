#!/usr/bin/env node

/**
 * Runs one evaluation case for `provider.mjs`, which calls it with the
 * prompt, the provider options, and the test context as JSON. The case is
 * in the context's variables. The result is printed as JSON.
 *
 * The editor and the plugin's prompt, context, and Anthropic adapter run
 * in Node, with the block library loaded in a browser-like window. Vite
 * loads the TypeScript sources and the skill, as in the tests.
 *
 * Usage: npm run eval
 */

/**
 * External dependencies
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const ROOT = path.resolve( import.meta.dirname, '../..' );

/* eslint-disable no-console -- A command line script reports through the console. */
// promptfoo reads the result from the standard output, so everything else goes to the standard error.
console.log = console.info = console.debug = ( ...args ) => console.error( ...args );

const [ , , , optionsJson = '{}', contextJson = '{}' ] = process.argv;
const options = JSON.parse( optionsJson );
const context = JSON.parse( contextJson );
const vars = context.vars ?? {};

if ( ! vars.request || ! vars.document ) {
	console.error( 'Run the evaluation with `npm run eval`. This script runs one of its cases.' );
	process.exit( 1 );
}

const envFile = path.join( ROOT, '.env' );
if ( ! process.env.ANTHROPIC_API_KEY && fs.existsSync( envFile ) ) {
	process.loadEnvFile( envFile );
}
const apiKey = process.env.ANTHROPIC_API_KEY;
if ( ! apiKey ) {
	console.error( 'Set ANTHROPIC_API_KEY in .env at the root of the repository.' );
	process.exit( 1 );
}

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
	root: ROOT,
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
	const { runCase } = await server.ssrLoadModule( '/scripts/eval/runner.ts' );
	const result = await runCase(
		{
			request: vars.request,
			followUp: vars.followUp,
			document: vars.document,
			select: vars.select,
		},
		{ apiKey, model: options.config?.model }
	);
	if ( result.requestErrors.length ) {
		// The request failed before the model answered, so the case is an error, not a failure.
		console.error( `Anthropic answered with an error: ${ result.requestErrors.join( '\n' ) }` );
	} else {
		process.stdout.write( JSON.stringify( result ) );
		code = 0;
	}
} catch ( error ) {
	console.error( error instanceof Error ? error.stack : error );
} finally {
	await server.close();
}
process.exit( code );
