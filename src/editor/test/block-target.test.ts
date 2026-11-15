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
		const [ , second ] = setUp( 'One', 'Two' );
		dispatch( blockEditorStore ).selectBlock( second );

		expect( createBlockTarget().getContext() ).toEqual( {
			document: `${ paragraph( 'One' ) }\n\n${ paragraph( 'Two' ) }`,
			selection: paragraph( 'Two' ),
		} );
	} );

	it( 'replaces the selection, and inserts after what it replaced', () => {
		const [ first ] = setUp( 'One', 'Two' );
		dispatch( blockEditorStore ).selectBlock( first );
		const target = createBlockTarget();

		expect( target.apply( { action: 'replace', markup: paragraph( 'New' ) } ) ).toEqual( {
			status: 'applied',
		} );
		expect( target.apply( { action: 'insert_after', markup: paragraph( 'Added' ) } ) ).toEqual( {
			status: 'applied',
		} );
		expect( target.apply( { action: 'insert_after', markup: paragraph( 'Later' ) } ) ).toEqual( {
			status: 'applied',
		} );

		expect( documentNow() ).toBe(
			[ 'New', 'Added', 'Later', 'Two' ].map( paragraph ).join( '\n\n' )
		);
		expect( target.getContext().selection ).toBe( paragraph( 'New' ) );
	} );

	it( 'adds blocks to the end of the document when nothing is selected', () => {
		setUp( 'One' );
		const target = createBlockTarget();

		expect( target.apply( { action: 'replace', markup: paragraph( 'New' ) } ) ).toMatchObject( {
			status: 'failed',
		} );
		expect( target.apply( { action: 'insert_after', markup: paragraph( 'Two' ) } ) ).toEqual( {
			status: 'applied',
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
} );
