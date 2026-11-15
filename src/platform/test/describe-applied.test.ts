/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { describeApplied } from '../anthropic';

describe( 'describeApplied', () => {
	it( 'tells the model the edit was applied, with the IDs of the new blocks', () => {
		expect( describeApplied( undefined ) ).toBe( 'The edit was applied.' );
		expect( describeApplied( [ 'b1', 'b2' ] ) ).toBe(
			'The edit was applied. The reference IDs of the new blocks are b1, b2.'
		);
	} );

	it( 'adds what the automatic fix changed', () => {
		expect( describeApplied( [ 'b1' ], 'Fixed.\nBefore:\n<p>A</p>' ) ).toBe(
			'The edit was applied. The reference IDs of the new blocks are b1.\n\nFixed.\nBefore:\n<p>A</p>'
		);
	} );
} );
