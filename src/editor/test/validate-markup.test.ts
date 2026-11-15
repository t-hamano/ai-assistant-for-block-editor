// @vitest-environment jsdom

/**
 * External dependencies
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * WordPress dependencies
 */
import { __unstableGetInnerBlocksProps, registerBlockType } from '@wordpress/blocks';
import { createElement, RawHTML } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { validateMarkup } from '../validate-markup';

beforeAll( () => {
	registerBlockType( 'test/text', {
		apiVersion: 3,
		title: 'Text',
		category: 'text',
		attributes: {
			content: { type: 'string', source: 'html', selector: 'p' },
			align: { type: 'string', enum: [ 'left', 'right' ] },
		},
		edit: () => null,
		save: ( { attributes } ) =>
			createElement(
				'p',
				{ className: attributes.align ? `has-text-align-${ attributes.align }` : undefined },
				attributes.content as string
			),
		deprecated: [
			{
				attributes: {
					content: { type: 'string', source: 'html', selector: 'div' },
					align: { type: 'string', enum: [ 'start', 'end' ] },
				},
				save: ( { attributes } ) => createElement( 'div', {}, attributes.content as string ),
				migrate: ( { content, align } ) => ( {
					content,
					align: { start: 'left', end: 'right' }[ align as string ],
				} ),
			},
		],
	} );
	registerBlockType( 'test/group', {
		apiVersion: 3,
		title: 'Group',
		category: 'design',
		attributes: {},
		edit: () => null,
		save: () => createElement( 'div', __unstableGetInnerBlocksProps() as { children: string } ),
	} );
	registerBlockType( 'core/html', {
		apiVersion: 3,
		title: 'HTML',
		category: 'widgets',
		attributes: { content: { type: 'string', source: 'raw' } },
		edit: () => null,
		save: ( { attributes } ) =>
			createElement( RawHTML, { children: attributes.content as string } ),
	} );
	// The parser logs the blocks it cannot read.
	vi.spyOn( console, 'error' ).mockImplementation( () => {} );
	vi.spyOn( console, 'info' ).mockImplementation( () => {} );
	vi.spyOn( console, 'warn' ).mockImplementation( () => {} );
} );

const text = ( content: string, attrs = '' ) =>
	`<!-- wp:test/text ${ attrs }-->\n<p>${ content }</p>\n<!-- /wp:test/text -->`;

const html = ( content: string ) => `<!-- wp:html -->\n${ content }\n<!-- /wp:html -->`;

describe( 'validateMarkup', () => {
	it( 'accepts valid markup', () => {
		const result = validateMarkup( `${ text( 'One' ) }\n\n${ text( 'Two' ) }` );

		expect( result.problems ).toEqual( [] );
		expect( result.blocks.map( ( block ) => block.attributes.content ) ).toEqual( [
			'One',
			'Two',
		] );
	} );

	it( 'rejects HTML that does not match the attributes, with the markup it should be', () => {
		const { problems } = validateMarkup(
			'<!-- wp:test/text {"align":"left"} -->\n<p>One</p>\n<!-- /wp:test/text -->'
		);

		expect( problems ).toHaveLength( 1 );
		expect( problems[ 0 ] ).toContain( 'does not match its attributes' );
		expect( problems[ 0 ] ).toContain(
			'<!-- wp:test/text {"align":"left"} -->\n<p class="has-text-align-left">One</p>\n<!-- /wp:test/text -->'
		);
	} );

	it( 'rejects unregistered blocks', () => {
		const { problems } = validateMarkup(
			'<!-- wp:test/missing -->\n<p>One</p>\n<!-- /wp:test/missing -->'
		);

		expect( problems ).toEqual( [
			expect.stringContaining( 'test/missing block is not registered' ),
		] );
	} );

	it( 'rejects attributes the block does not have, and values outside their enum', () => {
		const { problems } = validateMarkup(
			`${ text( 'One', '{"size":"large"} ' ) }\n\n${ text( 'Two', '{"align":"middle"} ' ) }`
		);

		expect( problems ).toEqual( [
			expect.stringContaining( '"size" is not an attribute' ),
			expect.stringContaining( 'has these attributes: align' ),
			expect.stringContaining( 'Use one of: "left", "right"' ),
			expect.stringContaining( 'has these attributes: align' ),
		] );
	} );

	it( 'rejects HTML outside blocks', () => {
		const { problems } = validateMarkup( `<p>Loose</p>\n\n${ text( 'One' ) }` );

		expect( problems ).toEqual( [ expect.stringContaining( 'not in a block' ) ] );
	} );

	it( 'checks nested blocks', () => {
		const { problems } = validateMarkup(
			`<!-- wp:test/group -->\n<div>${ text( 'One', '{"size":"large"} ' ) }</div>\n<!-- /wp:test/group -->`
		);

		expect( problems[ 0 ] ).toContain( '"size" is not an attribute of the test/text block' );
	} );

	it( 'allows core/html only for SVG, scripts, and HTML already in the document', () => {
		expect( validateMarkup( html( '<svg viewBox="0 0 1 1"></svg>' ) ).problems ).toEqual( [] );
		expect( validateMarkup( html( '<script>run();</script>' ) ).problems ).toEqual( [] );
		expect(
			validateMarkup( html( '<p>Kept</p>' ), new Set( [ '<p>Kept</p>' ] ) ).problems
		).toEqual( [] );
		expect( validateMarkup( html( '<h2>Title</h2><p>Text</p>' ) ).problems ).toEqual( [
			expect.stringContaining( 'Use core/html only for' ),
		] );
	} );

	it( 'accepts attribute values of a deprecated version', () => {
		const result = validateMarkup(
			'<!-- wp:test/text {"align":"start"} -->\n<div>Old</div>\n<!-- /wp:test/text -->'
		);

		expect( result.problems ).toEqual( [] );
		expect( result.blocks[ 0 ].attributes.align ).toBe( 'left' );
	} );

	it( 'migrates blocks written in a deprecated form', () => {
		const result = validateMarkup(
			'<!-- wp:test/text -->\n<div>Old</div>\n<!-- /wp:test/text -->'
		);

		expect( result.problems ).toEqual( [] );
		expect( result.blocks[ 0 ].attributes.content ).toBe( 'Old' );
		expect( result.blocks[ 0 ].isValid ).toBe( true );
	} );
} );
