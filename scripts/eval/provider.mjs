/**
 * The provider promptfoo calls for each case. It runs the case with
 * `run.mjs` in a process of its own, so every case starts with a fresh
 * editor, and returns what the viewer shows: the model's answers and the
 * document afterwards. The whole result is in the metadata, for the
 * checks in `assertions.mjs`.
 */

/**
 * External dependencies
 */
import { execFile } from 'node:child_process';

/**
 * Formats a result for reading in the viewer.
 *
 * @param {Object} result The result printed by `run.mjs`.
 * @return {string} The text.
 */
function format( result ) {
	const turns = result.turns.map( ( turn ) =>
		[
			`> ${ turn.request }`,
			'',
			turn.error ? `Error: ${ turn.error }` : turn.text,
			...turn.failures.map( ( failure ) => `\nFailed edit: ${ failure }` ),
		].join( '\n' )
	);
	return [ ...turns, '--- The document afterwards ---', result.document ].join( '\n\n' );
}

export default class EvalProvider {
	constructor( options ) {
		this.config = options?.config ?? {};
		this.label = options?.label;
	}

	id() {
		return `eval:${ this.config.model }`;
	}

	callApi( prompt, context ) {
		const args = [
			'run.mjs',
			prompt,
			JSON.stringify( { config: this.config } ),
			JSON.stringify( { vars: context?.vars ?? {} } ),
		];
		return new Promise( ( resolve ) => {
			execFile(
				process.execPath,
				args,
				{ cwd: import.meta.dirname, maxBuffer: 64 * 1024 * 1024 },
				( error, stdout, stderr ) => {
					if ( error ) {
						resolve( { error: stderr.trim() || error.message } );
						return;
					}
					const result = JSON.parse( stdout );
					const { inputTokens, cacheReadTokens, cacheWriteTokens, outputTokens, requests } =
						result.usage;
					const prompted = inputTokens + cacheReadTokens + cacheWriteTokens;
					resolve( {
						output: format( result ),
						metadata: { result },
						tokenUsage: {
							prompt: prompted,
							completion: outputTokens,
							cached: cacheReadTokens,
							total: prompted + outputTokens,
							numRequests: requests,
						},
					} );
				}
			);
		} );
	}
}
