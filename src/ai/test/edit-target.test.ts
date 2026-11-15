/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { joinAroundSelection } from '../edit-target';

describe( 'joinAroundSelection', () => {
	it( 'joins the parts with blank lines and gives the place of the selection', () => {
		expect( joinAroundSelection( 'One.\n', 'Two.\n', 'Three.\n' ) ).toEqual( {
			document: 'One.\n\nTwo.\n\nThree.\n',
			selection: 'Two.\n',
			selectionStart: 6,
			selectionEnd: 10,
		} );
	} );

	it( 'puts an empty selection where new content goes', () => {
		expect( joinAroundSelection( 'One.\n', '', 'Two.\n' ) ).toMatchObject( {
			document: 'One.\n\nTwo.\n',
			selectionStart: 6,
			selectionEnd: 6,
		} );
	} );

	it( 'puts an empty selection at the end when nothing follows', () => {
		expect( joinAroundSelection( 'One.\n', '', '' ) ).toMatchObject( {
			document: 'One.\n',
			selectionStart: 5,
			selectionEnd: 5,
		} );
	} );

	it( 'returns an empty document when every part is empty', () => {
		expect( joinAroundSelection( '', '', '' ) ).toEqual( {
			document: '',
			selection: '',
			selectionStart: 0,
			selectionEnd: 0,
		} );
	} );
} );
