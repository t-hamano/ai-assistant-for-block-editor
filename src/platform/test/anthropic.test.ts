/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import type { AiStreamEvent } from '..';
import { ANTHROPIC_MODEL, buildAnthropicBody, readAnthropicStream } from '../anthropic';
import { streamBody } from './stream-body';

function sse( event: string, data: object ) {
	return `event: ${ event }\ndata: ${ JSON.stringify( data ) }\n\n`;
}

async function read( pieces: string[] ) {
	const events: AiStreamEvent[] = [];
	const done = readAnthropicStream( new Response( streamBody( pieces ) ), ( event ) => {
		events.push( event );
	} );
	return { events, done };
}

describe( 'buildAnthropicBody', () => {
	it( 'sends the system prompt and the conversation as text', () => {
		expect(
			buildAnthropicBody( {
				system: 'Be brief.',
				messages: [
					{ role: 'user', text: 'Hi' },
					{ role: 'assistant', text: 'Hello' },
					{ role: 'user', text: 'Shorter' },
				],
			} )
		).toEqual( {
			model: ANTHROPIC_MODEL,
			max_tokens: expect.any( Number ),
			system: 'Be brief.',
			messages: [
				{ role: 'user', content: 'Hi' },
				{ role: 'assistant', content: 'Hello' },
				{ role: 'user', content: 'Shorter' },
			],
		} );
	} );
} );

describe( 'readAnthropicStream', () => {
	it( 'streams the thinking, the text, and the usage', async () => {
		const { events, done } = await read( [
			sse( 'message_start', {
				message: {
					usage: {
						input_tokens: 10,
						cache_read_input_tokens: 100,
						cache_creation_input_tokens: 5,
						output_tokens: 1,
					},
				},
			} ),
			sse( 'content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '' } } ),
			sse( 'content_block_delta', { index: 0, delta: { type: 'thinking_delta', thinking: '' } } ),
			sse( 'content_block_stop', { index: 0 } ),
			sse( 'ping', {} ),
			sse( 'content_block_start', { index: 1, content_block: { type: 'text', text: '' } } ),
			sse( 'content_block_delta', { index: 1, delta: { type: 'text_delta', text: 'Hel' } } ),
			sse( 'content_block_delta', { index: 1, delta: { type: 'text_delta', text: 'lo' } } ),
			sse( 'content_block_stop', { index: 1 } ),
			sse( 'message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 42 } } ),
			sse( 'message_stop', {} ),
		] );

		await done;

		expect( events ).toEqual( [
			{ type: 'activity', activity: 'thinking' },
			{ type: 'text', text: 'Hel' },
			{ type: 'text', text: 'lo' },
			{ type: 'usage', usage: { inputTokens: 115, cachedInputTokens: 100, outputTokens: 42 } },
		] );
	} );

	it( 'rejects with the message of an error event', async () => {
		const { done } = await read( [
			sse( 'message_start', { message: { usage: { input_tokens: 1, output_tokens: 0 } } } ),
			sse( 'error', { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } } ),
		] );

		await expect( done ).rejects.toThrow( 'Overloaded' );
	} );

	it( 'rejects when the model declines to answer', async () => {
		const { done } = await read( [
			sse( 'message_delta', { delta: { stop_reason: 'refusal' }, usage: {} } ),
		] );

		await expect( done ).rejects.toThrow();
	} );

	it( 'rejects when the answer is cut off', async () => {
		const { events, done } = await read( [
			sse( 'content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'Part' } } ),
			sse( 'message_delta', { delta: { stop_reason: 'max_tokens' }, usage: {} } ),
		] );

		await expect( done ).rejects.toThrow();
		expect( events ).toEqual( [ { type: 'text', text: 'Part' } ] );
	} );
} );
