// @vitest-environment jsdom

/**
 * External dependencies
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Internal dependencies
 */
import { createAnthropicPlatform } from '../../../src/platform/anthropic';
import cases from '../cases.json';
import { setUpCase, setUpSite, type EvaluationCase } from '../editor';
import { setUpRelay } from '../relay';
import { runCase } from '../run-case';

const PARAGRAPH = '<!-- wp:paragraph -->\n<p>Hello.</p>\n<!-- /wp:paragraph -->';

const CASE: EvaluationCase = {
	id: 'test',
	request: 'Change it.',
	document: PARAGRAPH,
	select: { block: [ 0 ] },
	expect: { text: [ 'Changed.' ], absent: [ 'Hello.' ] },
};

function sse( event: string, data: object ) {
	return `event: ${ event }\ndata: ${ JSON.stringify( data ) }\n\n`;
}

/**
 * An Anthropic answer that calls the edit tool with the markup, or without
 * one, ends.
 *
 * @param markup The markup to edit the selection with.
 * @return The response.
 */
function answer( markup?: string | { json: string } ) {
	const events = [
		sse( 'message_start', { message: { usage: { input_tokens: 10, output_tokens: 1 } } } ),
		...( markup === undefined
			? [
					sse( 'content_block_start', { index: 0, content_block: { type: 'text', text: '' } } ),
					sse( 'content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'Done.' } } ),
				]
			: [
					sse( 'content_block_start', {
						index: 0,
						content_block: { type: 'tool_use', id: 'call', name: 'edit_blocks', input: {} },
					} ),
					sse( 'content_block_delta', {
						index: 0,
						delta: {
							type: 'input_json_delta',
							partial_json:
								typeof markup === 'string'
									? JSON.stringify( { action: 'replace', markup } )
									: markup.json,
						},
					} ),
				] ),
		sse( 'content_block_stop', { index: 0 } ),
		sse( 'message_delta', {
			delta: { stop_reason: markup === undefined ? 'end_turn' : 'tool_use' },
			usage: { output_tokens: 5 },
		} ),
	];
	return new Response( events.join( '' ), { headers: { 'content-type': 'text/event-stream' } } );
}

function mockAnswers( ...markups: Parameters< typeof answer >[ 0 ][] ) {
	const fetch = vi.fn();
	for ( const markup of markups ) {
		fetch.mockResolvedValueOnce( answer( markup ) );
	}
	vi.stubGlobal( 'fetch', fetch );
	vi.stubEnv( 'ANTHROPIC_API_KEY', 'test-key' );
	return fetch;
}

beforeAll( () => {
	setUpSite();
} );

afterEach( () => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
} );

describe( 'the cases', () => {
	it( 'have unique IDs', () => {
		const ids = cases.map( ( item ) => item.id );
		expect( new Set( ids ).size ).toBe( ids.length );
	} );

	it.each( cases.map( ( item ) => [ item.id, item as EvaluationCase ] ) )(
		'loads %s with its selection',
		( _id, evaluationCase ) => {
			const { selection, textIn } = setUpCase( evaluationCase ).getContext();
			if ( evaluationCase.select?.text ) {
				expect( textIn ).toBeDefined();
				// The selected text comes as inline HTML, with its tags.
				expect( selection.replace( /<[^>]+>/g, '' ) ).toBe( evaluationCase.select.text );
			} else {
				expect( textIn ).toBeUndefined();
				expect( selection === '' ).toBe( ! evaluationCase.select );
			}
		}
	);
} );

describe( 'runCase', () => {
	const platform = () => createAnthropicPlatform( () => 1 );

	it( 'passes on the first try when every edit applies', async () => {
		const fetch = mockAnswers(
			'<!-- wp:paragraph -->\n<p>Changed.</p>\n<!-- /wp:paragraph -->',
			undefined
		);
		setUpRelay( { dryRun: false } );

		const result = await runCase( CASE, platform() );

		expect( result ).toMatchObject( {
			outcome: 'edited',
			firstTry: true,
			applied: 1,
			failed: 0,
			unmet: [],
			usage: { inputTokens: 20, outputTokens: 10 },
		} );
		expect( fetch ).toHaveBeenCalledWith(
			'https://api.anthropic.com/v1/messages',
			expect.objectContaining( {
				headers: expect.objectContaining( { 'x-api-key': 'test-key' } ),
			} )
		);
		expect( JSON.parse( fetch.mock.calls[ 0 ][ 1 ].body ) ).toMatchObject( { stream: true } );
	} );

	it( 'counts the edits that failed and were tried again', async () => {
		mockAnswers(
			'<p>Changed.</p>',
			'<!-- wp:paragraph -->\n<p>Changed.</p>\n<!-- /wp:paragraph -->',
			undefined
		);
		setUpRelay( { dryRun: false } );

		const result = await runCase( CASE, platform() );

		expect( result ).toMatchObject( { outcome: 'edited', firstTry: false, applied: 1, failed: 1 } );
		expect( result.failures ).toHaveLength( 1 );
	} );

	it( 'counts the calls that the platform sent back for invalid JSON', async () => {
		mockAnswers(
			{ json: '{"action":"replace","markup":' },
			'<!-- wp:paragraph -->\n<p>Changed.</p>\n<!-- /wp:paragraph -->',
			undefined
		);
		setUpRelay( { dryRun: false } );

		const result = await runCase( CASE, platform() );

		expect( result ).toMatchObject( { outcome: 'edited', firstTry: false, applied: 1, failed: 1 } );
	} );

	it( 'tells when the model gave up, and what the document lacks', async () => {
		mockAnswers( ...Array( 4 ).fill( '<p>Changed.</p>' ) );
		setUpRelay( { dryRun: false } );

		const result = await runCase( CASE, platform() );

		expect( result ).toMatchObject( {
			outcome: 'gave-up',
			firstTry: false,
			applied: 0,
			failed: 4,
			unmet: [ 'has no "Changed."', 'still has "Hello."' ],
		} );
	} );

	it( 'builds the request without sending it in a dry run', async () => {
		const fetch = vi.fn();
		vi.stubGlobal( 'fetch', fetch );
		const onDryRun = vi.fn();
		setUpRelay( { dryRun: true, onDryRun } );

		const result = await runCase( CASE, platform() );

		expect( result.outcome ).toBe( 'dry-run' );
		expect( fetch ).not.toHaveBeenCalled();
		expect( onDryRun ).toHaveBeenCalledWith(
			expect.objectContaining( { provider: 'anthropic', stream: true } )
		);
	} );
} );
