// @vitest-environment jsdom

/**
 * External dependencies
 */
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * WordPress dependencies
 */
import {
	__unstableGetInnerBlocksProps,
	createBlock,
	registerBlockType,
	serialize,
	type Block,
} from '@wordpress/blocks';
import { createElement } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { locateText } from '../locate-text';

beforeAll( () => {
	registerBlockType( 'test/text', {
		apiVersion: 3,
		title: 'Text',
		category: 'text',
		attributes: { content: { type: 'string', source: 'html', selector: 'p' } },
		edit: () => null,
		save: ( { attributes } ) => createElement( 'p', {}, attributes.content as string ),
	} );
	registerBlockType( 'test/box', {
		apiVersion: 3,
		title: 'Box',
		category: 'design',
		attributes: {},
		edit: () => null,
		save: () =>
			createElement( 'div', {
				className: 'box',
				...( __unstableGetInnerBlocksProps() as { children: string } ),
			} ),
	} );
} );

const text = ( content: string ) => createBlock( 'test/text', { content } );

function locate( blocks: Block[], find: string ) {
	const markup = serialize( blocks );
	const start = markup.indexOf( find );
	const located = locateText( blocks, markup, start, start + find.length );
	return (
		located && {
			...located,
			found: located.markup.slice( located.start, located.end ),
		}
	);
}

describe( 'locateText', () => {
	it( 'finds the one block that holds the text', () => {
		const blocks = [ text( 'One' ), text( 'Two' ) ];
		expect( locate( blocks, 'Two' ) ).toEqual( {
			blocks: [ blocks[ 1 ] ],
			markup: serialize( [ blocks[ 1 ] ] ),
			start: expect.any( Number ),
			end: expect.any( Number ),
			found: 'Two',
		} );
	} );

	it( 'takes the run of blocks the text spans, with the space between them', () => {
		const blocks = [ text( 'One' ), text( 'Two' ), text( 'Three' ) ];
		const located = locate(
			blocks,
			'One</p>\n<!-- /wp:test/text -->\n\n<!-- wp:test/text -->\n<p>Two'
		);
		expect( located?.blocks ).toEqual( [ blocks[ 0 ], blocks[ 1 ] ] );
		expect( located?.markup ).toBe( serialize( [ blocks[ 0 ], blocks[ 1 ] ] ) );
	} );

	it( 'goes into the inner block that holds the text', () => {
		const inner = text( 'Inner' );
		const box = createBlock( 'test/box', {}, [ text( 'Other' ), inner ] );
		expect( locate( [ text( 'One' ), box ], 'Inner' )?.blocks ).toEqual( [ inner ] );
	} );

	it( 'takes the parent when the text is in its own markup', () => {
		const box = createBlock( 'test/box', {}, [ text( 'Inner' ) ] );
		expect( locate( [ box ], '<div class="box">' )?.blocks ).toEqual( [ box ] );
	} );
} );
