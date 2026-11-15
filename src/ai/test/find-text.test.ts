/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { findUniqueText } from '../find-text';

describe( 'findUniqueText', () => {
	it( 'finds the one place that matches', () => {
		expect( findUniqueText( 'One. Two. Three.', 'Two.' ) ).toEqual( { start: 5, end: 9 } );
	} );

	it( 'fails when the text is empty', () => {
		expect( findUniqueText( 'One.', '' ) ).toHaveProperty( 'reason' );
	} );

	it( 'fails when the text includes the selection tags', () => {
		expect( findUniqueText( 'One.', '<selection>One.' ) ).toHaveProperty( 'reason' );
	} );

	it( 'fails when the text is not in the document', () => {
		expect( findUniqueText( 'One.', 'Two.' ) ).toHaveProperty( 'reason' );
	} );

	it( 'says how many places match when there are several', () => {
		const result = findUniqueText( 'One. One. One.', 'One.' );
		expect( result ).toHaveProperty( 'reason' );
		expect( ( result as { reason: string } ).reason ).toContain( '3 times' );
	} );
} );
