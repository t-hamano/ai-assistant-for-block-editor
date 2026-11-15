/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	applyChange,
	buildMessageContext,
	formatDocument,
	formatSelection,
} from '../document-context';
import { joinAroundSelection } from '../edit-target';

describe( 'formatDocument', () => {
	it( 'shows the document', () => {
		expect( formatDocument( '# Title\n\nOne.\n' ) ).toBe(
			'<document>\n# Title\n\nOne.\n</document>'
		);
	} );

	it( 'shows an empty document', () => {
		expect( formatDocument( '' ) ).toBe( '<document>\n</document>' );
	} );
} );

describe( 'formatSelection', () => {
	it( 'gives the text of the selection', () => {
		expect(
			formatSelection( joinAroundSelection( '# Title\n', 'One.\n\nTwo.\n', 'Three.\n' ) )
		).toBe( '<selection>\nOne.\n\nTwo.\n</selection>' );
	} );

	it( 'is empty when nothing is selected', () => {
		expect( formatSelection( joinAroundSelection( '# Title\n', '', 'One.\n' ) ) ).toBe(
			'<selection></selection>'
		);
	} );
} );

describe( 'buildMessageContext', () => {
	const context = joinAroundSelection( 'One.\n', 'Two.\n', '' );

	it( 'sends the whole document when the model has not seen it', () => {
		expect( buildMessageContext( context, null ) ).toBe(
			'<document>\nOne.\n\nTwo.\n</document>\n\n<selection>\nTwo.\n</selection>'
		);
	} );

	it( 'sends only the selection when nothing changed', () => {
		expect( buildMessageContext( context, context.document ) ).toBe(
			'<selection>\nTwo.\n</selection>'
		);
	} );

	it( 'sends the whole document again when it changed', () => {
		const result = buildMessageContext( context, 'Old.\n' );
		expect( result ).toContain( 'The user changed the document after your last answer.' );
		expect( result ).toContain( formatDocument( context.document ) );
	} );

	it( 'sends the empty document when the user removed everything', () => {
		const empty = joinAroundSelection( '', '', '' );
		expect( buildMessageContext( empty, 'One.\n' ) ).toBe(
			'The user changed the document after your last answer. This is the whole document now.\n\n<document>\n</document>\n\n<selection></selection>'
		);
	} );
} );

describe( 'applyChange', () => {
	it( 'takes the new document when the model knows the old one', () => {
		expect( applyChange( 'One.\n', 'One.\n', 'Two.\n' ) ).toBe( 'Two.\n' );
	} );

	it( 'returns null when the editor has changes the model does not know', () => {
		expect( applyChange( 'One.\n', 'Typed.\n', 'Two.\n' ) ).toBeNull();
	} );
} );
