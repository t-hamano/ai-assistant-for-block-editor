/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { addUsage, countRetries, createUsage, readStreamUsage } from '../usage';

const event = ( type: string, data: object ) =>
	`event: ${ type }\ndata: ${ JSON.stringify( { type, ...data } ) }\n\n`;

describe( 'readStreamUsage', () => {
	it( 'reads the input tokens from message_start and the output tokens from message_delta', () => {
		const stream = [
			event( 'message_start', {
				message: {
					usage: {
						input_tokens: 12,
						cache_read_input_tokens: 3400,
						cache_creation_input_tokens: 560,
						output_tokens: 1,
					},
				},
			} ),
			event( 'content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'Hi' } } ),
			event( 'message_delta', {
				delta: { stop_reason: 'end_turn' },
				usage: { output_tokens: 78 },
			} ),
			event( 'message_stop', {} ),
		].join( '' );
		expect( readStreamUsage( stream ) ).toEqual( {
			inputTokens: 12,
			cacheReadTokens: 3400,
			cacheWriteTokens: 560,
			outputTokens: 78,
			requests: 1,
		} );
	} );

	it( 'counts a request whose stream has no usage', () => {
		expect( readStreamUsage( 'data: {not json\n\n' ) ).toEqual( { ...createUsage(), requests: 1 } );
	} );
} );

describe( 'addUsage', () => {
	it( 'adds every count', () => {
		const total = { ...createUsage(), inputTokens: 1, requests: 1 };
		addUsage( total, {
			inputTokens: 2,
			cacheReadTokens: 3,
			cacheWriteTokens: 4,
			outputTokens: 5,
			requests: 1,
		} );
		expect( total ).toEqual( {
			inputTokens: 3,
			cacheReadTokens: 3,
			cacheWriteTokens: 4,
			outputTokens: 5,
			requests: 2,
		} );
	} );
} );

describe( 'countRetries', () => {
	it( 'counts the failed tool results of the last message only', () => {
		const failed = { type: 'tool_result', tool_use_id: 'a', is_error: true, content: 'No.' };
		const body = {
			messages: [
				{ role: 'user', content: [ { type: 'text', text: 'Edit it.' } ] },
				{ role: 'assistant', content: [ { type: 'tool_use', id: 'a' } ] },
				{ role: 'user', content: [ failed ] },
				{ role: 'assistant', content: [ { type: 'tool_use', id: 'b' } ] },
				{
					role: 'user',
					content: [
						{ ...failed, tool_use_id: 'b' },
						{ type: 'tool_result', tool_use_id: 'c', content: 'The edit was applied.' },
					],
				},
			],
		};
		expect( countRetries( body ) ).toBe( 1 );
		expect( countRetries( { messages: body.messages.slice( 0, 1 ) } ) ).toBe( 0 );
		expect( countRetries( {} ) ).toBe( 0 );
	} );
} );
