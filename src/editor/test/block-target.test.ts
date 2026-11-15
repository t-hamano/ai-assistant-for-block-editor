// @vitest-environment jsdom

/**
 * External dependencies
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { createBlock, registerBlockType, serialize } from '@wordpress/blocks';
import { dispatch, select } from '@wordpress/data';
import { createElement } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { getRef, stripRefs } from '../block-refs';
import { createBlockTarget } from '../block-target';

const paragraph = ( content: string ) =>
	`<!-- wp:test/paragraph -->\n<p>${ content }</p>\n<!-- /wp:test/paragraph -->`;

beforeAll( () => {
	registerBlockType( 'test/paragraph', {
		apiVersion: 3,
		title: 'Paragraph',
		category: 'text',
		attributes: {
			content: { type: 'string', source: 'html', selector: 'p' },
		},
		edit: () => null,
		save: ( { attributes } ) => createElement( 'p', {}, attributes.content as string ),
	} );
} );

function setUp( ...contents: string[] ) {
	const blocks = contents.map( ( content ) => createBlock( 'test/paragraph', { content } ) );
	dispatch( blockEditorStore ).resetBlocks( blocks );
	return blocks.map( ( block ) => block.clientId );
}

const documentNow = () => serialize( select( blockEditorStore ).getBlocks() );

describe( 'createBlockTarget', () => {
	beforeEach( () => {
		dispatch( blockEditorStore ).clearSelectedBlock();
	} );

	it( 'sends the document and the selected blocks as markup', () => {
		const ids = setUp( 'One', 'Two' );
		dispatch( blockEditorStore ).selectBlock( ids[ 1 ] );

		const ref = ( index: number ) => `<!-- ref:${ getRef( ids[ index ] ) } -->`;
		expect( createBlockTarget().getContext() ).toEqual( {
			document: `${ ref( 0 ) }${ paragraph( 'One' ) }\n\n${ ref( 1 ) }${ paragraph( 'Two' ) }`,
			selection: `${ ref( 1 ) }${ paragraph( 'Two' ) }`,
		} );
	} );

	it( 'replaces the selection, and inserts after what it replaced', () => {
		const [ first ] = setUp( 'One', 'Two' );
		dispatch( blockEditorStore ).selectBlock( first );
		const target = createBlockTarget();

		expect( target.apply( { action: 'replace', markup: paragraph( 'New' ) } ) ).toEqual( {
			status: 'applied',
			refs: [ expect.any( String ) ],
		} );
		expect( target.apply( { action: 'insert_after', markup: paragraph( 'Added' ) } ) ).toEqual( {
			status: 'applied',
			refs: [ expect.any( String ) ],
		} );
		expect( target.apply( { action: 'insert_after', markup: paragraph( 'Later' ) } ) ).toEqual( {
			status: 'applied',
			refs: [ expect.any( String ) ],
		} );

		expect( documentNow() ).toBe(
			[ 'New', 'Added', 'Later', 'Two' ].map( paragraph ).join( '\n\n' )
		);
		expect( stripRefs( target.getContext().selection ) ).toBe( paragraph( 'New' ) );
	} );

	it( 'adds blocks to the end of the document when nothing is selected', () => {
		setUp( 'One' );
		const target = createBlockTarget();

		expect( target.apply( { action: 'replace', markup: paragraph( 'New' ) } ) ).toMatchObject( {
			status: 'failed',
		} );
		expect( target.apply( { action: 'insert_after', markup: paragraph( 'Two' ) } ) ).toEqual( {
			status: 'applied',
			refs: [ expect.any( String ) ],
		} );
		expect( documentNow() ).toBe( [ 'One', 'Two' ].map( paragraph ).join( '\n\n' ) );
	} );

	it( 'fails without blocks in the markup', () => {
		const [ first ] = setUp( 'One' );
		dispatch( blockEditorStore ).selectBlock( first );

		expect( createBlockTarget().apply( { action: 'replace', markup: '' } ) ).toMatchObject( {
			status: 'failed',
		} );
		expect( documentNow() ).toBe( paragraph( 'One' ) );
	} );

	it( 'does not apply markup that fails validation, and tells why', () => {
		const [ first ] = setUp( 'One' );
		dispatch( blockEditorStore ).selectBlock( first );

		const result = createBlockTarget().apply( {
			action: 'replace',
			markup: '<!-- wp:test/missing -->\n<p>New</p>\n<!-- /wp:test/missing -->',
		} );

		expect( result ).toEqual( {
			status: 'failed',
			reason: expect.stringContaining( 'test/missing block is not registered' ),
		} );
		expect( documentNow() ).toBe( paragraph( 'One' ) );
	} );

	it( 'drops the edit when the selected blocks are gone', () => {
		const [ first ] = setUp( 'One' );
		dispatch( blockEditorStore ).selectBlock( first );
		const target = createBlockTarget();
		setUp( 'Other' );

		expect( target.apply( { action: 'replace', markup: paragraph( 'New' ) } ) ).toEqual( {
			status: 'dropped',
		} );
		expect( documentNow() ).toBe( paragraph( 'Other' ) );
	} );

	it( 'edits the blocks the reference IDs point at, wherever the selection is', () => {
		const [ first, second, third ] = setUp( 'One', 'Two', 'Three' );
		dispatch( blockEditorStore ).selectBlock( first );
		const target = createBlockTarget();

		const replaced = target.apply( {
			action: 'replace_block',
			ref: getRef( second ),
			markup: paragraph( 'Second' ),
		} );
		expect( replaced ).toEqual( { status: 'applied', refs: [ expect.any( String ) ] } );
		expect(
			target.apply( {
				action: 'insert_before',
				ref: getRef( third ),
				markup: paragraph( 'Before' ),
			} )
		).toMatchObject( { status: 'applied' } );
		// The model can go on with the block it added, by the ID it was given.
		const [ added ] = ( replaced as { refs: string[] } ).refs;
		expect(
			target.apply( { action: 'insert_after', ref: added, markup: paragraph( 'After' ) } )
		).toMatchObject( { status: 'applied' } );
		expect( target.apply( { action: 'delete_block', ref: getRef( third ), markup: '' } ) ).toEqual(
			{ status: 'applied', refs: [] }
		);
		expect( target.apply( { action: 'append', markup: paragraph( 'End' ) } ) ).toMatchObject( {
			status: 'applied',
		} );

		expect( documentNow() ).toBe(
			[ 'One', 'Second', 'After', 'Before', 'End' ].map( paragraph ).join( '\n\n' )
		);
		expect( select( blockEditorStore ).getSelectedBlockClientId() ).toBe( first );
	} );

	it( 'strips reference IDs from the markup', () => {
		const [ first ] = setUp( 'One' );
		dispatch( blockEditorStore ).selectBlock( first );

		expect(
			createBlockTarget().apply( {
				action: 'replace',
				markup: `<!-- ref:${ getRef( first ) } -->${ paragraph( 'New' ) }`,
			} )
		).toMatchObject( { status: 'applied' } );
		expect( documentNow() ).toBe( paragraph( 'New' ) );
	} );

	it( 'fails for a reference ID that is not in the document', () => {
		const [ first ] = setUp( 'One' );
		const gone = getRef( first );
		setUp( 'Other' );

		const target = createBlockTarget();
		expect( target.apply( { action: 'delete_block', ref: 'b9999', markup: '' } ) ).toEqual( {
			status: 'failed',
			reason: expect.stringContaining( 'no block with the reference ID "b9999"' ),
		} );
		expect(
			target.apply( { action: 'replace_block', ref: gone, markup: paragraph( 'New' ) } )
		).toMatchObject( { status: 'failed' } );
		expect( documentNow() ).toBe( paragraph( 'Other' ) );
	} );

	it( 'keeps the selection up to date when a selected block is replaced by its ID', () => {
		const [ first ] = setUp( 'One', 'Two' );
		dispatch( blockEditorStore ).selectBlock( first );
		const target = createBlockTarget();

		target.apply( { action: 'replace_block', ref: getRef( first ), markup: paragraph( 'New' ) } );
		expect( target.apply( { action: 'replace', markup: paragraph( 'Newer' ) } ) ).toMatchObject( {
			status: 'applied',
		} );
		expect( documentNow() ).toBe( [ 'Newer', 'Two' ].map( paragraph ).join( '\n\n' ) );
	} );
} );
