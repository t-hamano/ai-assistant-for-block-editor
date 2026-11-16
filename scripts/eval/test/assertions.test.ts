/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	edited,
	expected,
	firstTry,
	notEdited,
	sentOutline,
	usage,
	validMarkup,
} from '../assertions.mjs';

const turn = {
	request: 'Shorten this.',
	outline: false,
	applied: 1,
	failures: [],
	dropped: 0,
	text: 'Done.',
};

const result = {
	model: 'claude-sonnet-5-5',
	turns: [ turn ],
	document:
		'<!-- wp:list -->\n<ul class="wp-block-list"><!-- wp:list-item -->\n<li>Rain Jacket</li>\n<!-- /wp:list-item --></ul>\n<!-- /wp:list -->',
	blockNames: [ 'core/list', 'core/list-item' ],
	problems: [],
	retries: 0,
	requestErrors: [],
	usage: {
		inputTokens: 10,
		cacheReadTokens: 2000,
		cacheWriteTokens: 300,
		outputTokens: 40,
		requests: 2,
	},
	seconds: 3,
};

const output = ( changes: object = {} ) => JSON.stringify( { ...result, ...changes } );

describe( 'edited', () => {
	it( 'passes when every turn applied an edit', () => {
		expect( edited( output() ).pass ).toBe( true );
	} );

	it( 'fails when a turn applied nothing, or failed', () => {
		expect( edited( output( { turns: [ turn, { ...turn, applied: 0 } ] } ) ).pass ).toBe( false );
		const failed = edited(
			output( { turns: [ { ...turn, error: 'The edit could not be made.' } ] } )
		);
		expect( failed ).toMatchObject( { pass: false, score: 0 } );
		expect( failed.reason ).toContain( 'The edit could not be made.' );
	} );
} );

describe( 'notEdited', () => {
	it( 'passes only when nothing was applied', () => {
		expect( notEdited( output( { turns: [ { ...turn, applied: 0 } ] } ) ).pass ).toBe( true );
		expect( notEdited( output() ).pass ).toBe( false );
	} );
} );

describe( 'validMarkup', () => {
	it( 'fails with the problems of the document', () => {
		expect( validMarkup( output() ).pass ).toBe( true );
		expect( validMarkup( output( { problems: [ 'core/list is not valid' ] } ) ) ).toMatchObject( {
			pass: false,
			reason: 'core/list is not valid',
		} );
	} );
} );

describe( 'firstTry', () => {
	it( 'passes when no tool call was tried again', () => {
		expect( firstTry( output() ).pass ).toBe( true );
	} );

	it( 'fails when a call was tried again, with why', () => {
		const retried = firstTry(
			output( {
				retries: 1,
				turns: [ { ...turn, failures: [ 'The text is not in the document.' ] } ],
			} )
		);
		expect( retried.pass ).toBe( false );
		expect( retried.reason ).toContain( 'The text is not in the document.' );
	} );
} );

describe( 'expected', () => {
	it( 'checks the blocks, and text ignoring case', () => {
		const config = { blocks: [ 'core/list' ], text: [ 'rain jacket' ], absent: [ '<p>' ] };
		expect( expected( output(), { config } ).pass ).toBe( true );
	} );

	it( 'lists what the document lacks or still has', () => {
		const check = expected( output(), {
			config: { blocks: [ 'core/table' ], text: [ 'headlamp' ], absent: [ 'Rain jacket' ] },
		} );
		expect( check.pass ).toBe( false );
		expect( check.reason ).toBe(
			'The document has no core/table, has no "headlamp", still has "Rain jacket".'
		);
	} );
} );

describe( 'sentOutline', () => {
	it( 'passes when the first message sent an outline', () => {
		expect( sentOutline( output( { turns: [ { ...turn, outline: true } ] } ) ).pass ).toBe( true );
		expect( sentOutline( output() ).pass ).toBe( false );
	} );
} );

describe( 'usage', () => {
	it( 'records the tokens and requests as named scores, and passes', () => {
		expect( usage( output( { retries: 1 } ) ) ).toMatchObject( {
			pass: true,
			score: 0,
			namedScores: {
				inputTokens: 10,
				cacheReadTokens: 2000,
				cacheWriteTokens: 300,
				outputTokens: 40,
				requests: 2,
				retries: 1,
			},
		} );
	} );
} );
