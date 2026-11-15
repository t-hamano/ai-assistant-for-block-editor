/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { formatUsage } from '..';

describe( 'formatUsage', () => {
	it( 'lists the input and output tokens', () => {
		expect( formatUsage( { inputTokens: 12345, outputTokens: 678 } ) ).toBe(
			'12,345 input tokens, 678 output tokens'
		);
	} );

	it( 'adds the cached input tokens when there are any', () => {
		expect(
			formatUsage( { inputTokens: 12345, cachedInputTokens: 10000, outputTokens: 678 } )
		).toBe( '12,345 input tokens (10,000 cached), 678 output tokens' );
	} );

	it( 'leaves out the cached input tokens when there are none', () => {
		expect( formatUsage( { inputTokens: 10, cachedInputTokens: 0, outputTokens: 1 } ) ).toBe(
			'10 input tokens, 1 output token'
		);
	} );
} );
