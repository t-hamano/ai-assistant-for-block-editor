// @vitest-environment jsdom

/**
 * External dependencies
 */
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * WordPress dependencies
 */
import { InnerBlocks } from '@wordpress/block-editor';
import { createBlock, registerBlockType, serialize } from '@wordpress/blocks';
import { createElement } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { getClientIdByRef, getRef, serializeWithRefs, stripRefs } from '../block-refs';

beforeAll( () => {
	registerBlockType( 'test/text', {
		apiVersion: 3,
		title: 'Text',
		category: 'text',
		attributes: {
			content: { type: 'string', source: 'html', selector: 'p' },
		},
		edit: () => null,
		save: ( { attributes } ) => createElement( 'p', {}, attributes.content as string ),
	} );
	registerBlockType( 'test/box', {
		apiVersion: 3,
		title: 'Box',
		category: 'design',
		attributes: {},
		edit: () => null,
		save: () => createElement( 'div', {}, createElement( InnerBlocks.Content ) ),
	} );
} );

describe( 'serializeWithRefs', () => {
	it( 'puts a reference ID before each block, nested ones too', () => {
		const inner = createBlock( 'test/text', { content: 'Inner' } );
		const box = createBlock( 'test/box', {}, [ inner ] );
		const after = createBlock( 'test/text', { content: 'After' } );
		const blocks = [ box, after ];

		const markup = serializeWithRefs( blocks );

		expect( markup ).toBe(
			[
				`<!-- ref:${ getRef( box.clientId ) } --><!-- wp:test/box -->`,
				`<div><!-- ref:${ getRef( inner.clientId ) } --><!-- wp:test/text -->`,
				'<p>Inner</p>',
				'<!-- /wp:test/text --></div>',
				'<!-- /wp:test/box -->',
				'',
				`<!-- ref:${ getRef( after.clientId ) } --><!-- wp:test/text -->`,
				'<p>After</p>',
				'<!-- /wp:test/text -->',
			].join( '\n' )
		);
		expect( stripRefs( markup ) ).toBe( serialize( blocks ) );
	} );

	it( 'keeps the ID of a block, and maps it back to the block', () => {
		const block = createBlock( 'test/text', { content: 'One' } );
		const ref = getRef( block.clientId );

		expect( serializeWithRefs( [ block ] ) ).toContain( `<!-- ref:${ ref } -->` );
		expect( getRef( block.clientId ) ).toBe( ref );
		expect( getClientIdByRef( ref ) ).toBe( block.clientId );
		expect( getClientIdByRef( 'b0' ) ).toBeUndefined();
	} );
} );
