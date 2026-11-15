/**
 * External dependencies
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Internal dependencies
 */
import { createDummyPlatform, DUMMY_ANSWER } from '../dummy';
import type { AiStreamEvent } from '..';

describe( 'createDummyPlatform', () => {
	beforeEach( () => {
		vi.useFakeTimers();
	} );

	afterEach( () => {
		vi.useRealTimers();
	} );

	function chat( signal: AbortSignal ) {
		const events: AiStreamEvent[] = [];
		const done = createDummyPlatform().chat( {
			system: '',
			messages: [ { role: 'user', text: 'Hello' } ],
			signal,
			onEvent: ( event ) => {
				events.push( event );
			},
		} );
		return { events, done };
	}

	it( 'says it has an API key', async () => {
		await expect( createDummyPlatform().hasApiKey() ).resolves.toBe( true );
	} );

	it( 'streams the fixed answer in pieces', async () => {
		const { events, done } = chat( new AbortController().signal );
		await vi.runAllTimersAsync();
		await done;

		expect( events[ 0 ] ).toEqual( { type: 'activity', activity: 'thinking' } );
		const texts = events.filter( ( event ) => event.type === 'text' );
		expect( texts.length ).toBeGreaterThan( 1 );
		expect( texts.map( ( event ) => event.text ).join( '' ) ).toBe( DUMMY_ANSWER );
	} );

	it( 'stops with an AbortError when the user stops the answer', async () => {
		const controller = new AbortController();
		const { events, done } = chat( controller.signal );
		const error = done.catch( ( reason: unknown ) => reason );
		await vi.advanceTimersByTimeAsync( 300 );
		const count = events.length;
		controller.abort();
		await vi.runAllTimersAsync();

		expect( await error ).toMatchObject( { name: 'AbortError' } );
		expect( events ).toHaveLength( count );
	} );
} );
