/**
 * The checks promptfoo runs on each case's result, as printed by
 * `run.mjs`. Only code decides whether a case passed; no model grades
 * another.
 *
 * Each check is called with the output and promptfoo's context, whose
 * `config` holds the assertion's `config` from `promptfooconfig.yaml`.
 */

/**
 * Reads the result of a case.
 *
 * @param {string} output The output of `run.mjs`.
 * @return {import('./runner').CaseResult} The result.
 */
export function readResult( output ) {
	return typeof output === 'string' ? JSON.parse( output ) : output;
}

const grade = ( pass, reason ) => ( { pass, score: pass ? 1 : 0, reason } );

/**
 * The first error of the conversation, if a request failed or the model
 * gave up on its edits.
 *
 * @param {import('./runner').CaseResult} result The result.
 * @return {string|undefined} The error.
 */
function findError( result ) {
	return result.turns.find( ( turn ) => turn.error )?.error;
}

/**
 * Passes when the model edited the document in every turn, and no request
 * failed.
 *
 * @param {string} output The output.
 */
export function edited( output ) {
	const result = readResult( output );
	const error = findError( result );
	if ( error ) {
		return grade( false, `The answer failed: ${ error }` );
	}
	const idle = result.turns.filter( ( turn ) => ! turn.applied );
	return idle.length
		? grade(
				false,
				`No edit was applied for: ${ idle.map( ( turn ) => `"${ turn.request }"` ).join( ', ' ) }`
			)
		: grade(
				true,
				`Applied ${ result.turns.map( ( turn ) => turn.applied ).join( ' + ' ) } edits.`
			);
}

/**
 * Passes when the model answered without editing the document.
 *
 * @param {string} output The output.
 */
export function notEdited( output ) {
	const result = readResult( output );
	const error = findError( result );
	if ( error ) {
		return grade( false, `The answer failed: ${ error }` );
	}
	const applied = result.turns.reduce( ( total, turn ) => total + turn.applied, 0 );
	return grade(
		applied === 0,
		applied ? `Applied ${ applied } edits.` : 'Answered without editing.'
	);
}

/**
 * Passes when the editor reads every block of the document afterwards as
 * valid.
 *
 * @param {string} output The output.
 */
export function validMarkup( output ) {
	const { problems } = readResult( output );
	return problems.length
		? grade( false, problems.join( '\n' ) )
		: grade( true, 'The markup is valid.' );
}

/**
 * Passes when no tool call failed and had to be tried again, and the
 * model did not give up.
 *
 * @param {string} output The output.
 */
export function firstTry( output ) {
	const result = readResult( output );
	const error = findError( result );
	if ( error ) {
		return grade( false, `The answer failed: ${ error }` );
	}
	const failures = result.turns.flatMap( ( turn ) => turn.failures );
	if ( result.retries || failures.length ) {
		return grade(
			false,
			[ `${ result.retries } tool calls were tried again.`, ...failures ].join( '\n' )
		);
	}
	return grade( true, 'Every tool call worked on the first try.' );
}

/**
 * Whether each text appears after the one before it.
 *
 * @param {string}   markup The markup, in lowercase.
 * @param {string[]} items  The texts.
 * @return {boolean} Whether they appear in order.
 */
function isInOrder( markup, items ) {
	let from = 0;
	for ( const item of items ) {
		const index = markup.indexOf( item.toLowerCase(), from );
		if ( index < 0 ) {
			return false;
		}
		from = index + item.length;
	}
	return true;
}

/**
 * Passes when the document afterwards has what the case expects, from the
 * assertion's `config`: `blocks` it has, `text` its markup has, and
 * `absent` text it no longer has, and `order` text that appears in this
 * order, to check where an edit went. Text is compared ignoring case.
 *
 * @param {string} output  The output.
 * @param {Object} context promptfoo's context.
 */
export function expected( output, context ) {
	const { blockNames, document } = readResult( output );
	const { blocks = [], text = [], absent = [], order = [] } = context?.config ?? {};
	const markup = document.toLowerCase();
	const unmet = [
		...blocks
			.filter( ( name ) => ! blockNames.includes( name ) )
			.map( ( name ) => `has no ${ name }` ),
		...text
			.filter( ( item ) => ! markup.includes( item.toLowerCase() ) )
			.map( ( item ) => `has no "${ item }"` ),
		...absent
			.filter( ( item ) => markup.includes( item.toLowerCase() ) )
			.map( ( item ) => `still has "${ item }"` ),
		...( isInOrder( markup, order )
			? []
			: [ `does not have ${ order.map( ( item ) => `"${ item }"` ).join( ', then ' ) }` ] ),
	];
	return unmet.length
		? grade( false, `The document ${ unmet.join( ', ' ) }.` )
		: grade( true, 'The document has what was asked.' );
}

/**
 * Passes when the first message sent the document as an outline, as it
 * does for a long document.
 *
 * @param {string} output The output.
 */
export function sentOutline( output ) {
	const [ first ] = readResult( output ).turns;
	return grade( Boolean( first?.outline ), first?.outline ? 'Sent as an outline.' : 'Sent whole.' );
}

/**
 * Records the case's tokens and requests as named metrics, for comparing
 * runs in `promptfoo view`. It never fails a case: give it `weight: 0`.
 *
 * @param {string} output The output.
 */
export function usage( output ) {
	const result = readResult( output );
	const { inputTokens, cacheReadTokens, cacheWriteTokens, outputTokens, requests } = result.usage;
	return {
		pass: true,
		score: 0,
		reason: `${ requests } requests: ${ inputTokens } input, ${ cacheReadTokens } cache read, ${ cacheWriteTokens } cache write, ${ outputTokens } output tokens.`,
		namedScores: {
			inputTokens,
			cacheReadTokens,
			cacheWriteTokens,
			outputTokens,
			requests,
			retries: result.retries,
		},
	};
}
