/**
 * The checks promptfoo runs on each case's result, as printed by
 * `run.mjs`. Only code decides whether a case passed; no model grades
 * another.
 *
 * Each check is called with the output and promptfoo's context, whose
 * `config` holds the assertion's `config` from `promptfooconfig.yaml`.
 */

/**
 * Builds what a check returns. promptfoo needs a score with the result.
 *
 * @param {boolean} pass   Whether the check passed.
 * @param {string}  reason Why.
 */
const grade = ( pass, reason ) => ( { pass, score: pass ? 1 : 0, reason } );

/**
 * Passes when the model edited the document in every turn, and no request
 * failed.
 *
 * @param {string} output The output.
 */
export function edited( output ) {
	const result = JSON.parse( output );
	const error = result.turns.find( ( turn ) => turn.error )?.error;
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
	const result = JSON.parse( output );
	const error = result.turns.find( ( turn ) => turn.error )?.error;
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
	const { problems } = JSON.parse( output );
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
	const result = JSON.parse( output );
	const error = result.turns.find( ( turn ) => turn.error )?.error;
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
 * Passes when the document afterwards has what the case expects, from the
 * assertion's `config`: `blocks` it has, `text` its markup has, and
 * `absent` text it no longer has, and `order` text that appears in this
 * order, to check where an edit went. Text is compared ignoring case.
 *
 * @param {string} output  The output.
 * @param {Object} context promptfoo's context.
 */
export function expected( output, context ) {
	const { blockNames, document } = JSON.parse( output );
	const { blocks = [], text = [], absent = [], order = [] } = context?.config ?? {};
	const markup = document.toLowerCase();
	// Each text of `order` is looked for after the one before it.
	let from = 0;
	const inOrder = order.every( ( item ) => {
		const index = markup.indexOf( item.toLowerCase(), from );
		from = index + item.length;
		return index >= 0;
	} );
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
		...( inOrder
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
	const [ first ] = JSON.parse( output ).turns;
	return grade( Boolean( first?.outline ), first?.outline ? 'Sent as an outline.' : 'Sent whole.' );
}

/**
 * Records the case's tokens and requests as named metrics, for comparing
 * runs in `promptfoo view`. It never fails a case: give it `weight: 0`.
 *
 * @param {string} output The output.
 */
export function usage( output ) {
	const result = JSON.parse( output );
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
