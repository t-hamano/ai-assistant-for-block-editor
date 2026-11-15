// @vitest-environment jsdom

/**
 * External dependencies
 */
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { registerCoreBlocks } from '@wordpress/block-library';
import { registerBlockStyle, registerBlockType } from '@wordpress/blocks';
import { dispatch } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { collectSiteInfo, describeSupports, formatSiteInfo, getSiteInfo } from '../site-info';

beforeAll( () => {
	registerCoreBlocks();
	registerBlockType( 'my-plugin/card', {
		apiVersion: 3,
		title: 'Card',
		description: 'A card with a title.',
		category: 'design',
		parent: [ 'core/group' ],
		attributes: {
			title: { type: 'string', source: 'html', selector: 'h3' },
			tone: { type: 'string', enum: [ 'calm', 'loud' ], default: 'calm' },
			preview: { type: 'string', role: 'local' },
		},
		supports: { color: { text: false }, spacing: { padding: true }, html: false },
		edit: () => null,
		save: () => null,
	} );
	registerBlockType( 'my-plugin/hidden', {
		apiVersion: 3,
		title: 'Hidden',
		category: 'design',
		attributes: {},
		supports: { inserter: false },
		edit: () => null,
		save: () => null,
	} );
	registerBlockStyle( 'my-plugin/card', { name: 'outlined', label: 'Outlined' } );
	dispatch( blockEditorStore ).updateSettings( {
		__experimentalFeatures: {
			color: {
				palette: {
					default: [ { slug: 'black', name: 'Black', color: '#000000' } ],
					theme: [ { slug: 'base', name: 'Base', color: '#ffffff' } ],
				},
				defaultPalette: false,
				custom: false,
			},
			typography: {
				fontSizes: { theme: [ { slug: 'large', name: 'Large', size: '2rem' } ] },
				fontFamilies: {
					theme: [ { slug: 'body', name: 'Body', fontFamily: 'Inter, sans-serif' } ],
				},
			},
			spacing: { spacingSizes: { theme: [ { slug: '40', name: '1', size: '1rem' } ] } },
			layout: { contentSize: '620px', wideSize: '1280px' },
		},
	} );
} );

describe( 'describeSupports', () => {
	it( 'lists the style supports without experimental prefixes or editor controls', () => {
		expect(
			describeSupports( {
				align: [ 'wide', 'full' ],
				html: false,
				color: { gradients: true, __experimentalDefaultControls: { text: true } },
				spacing: { margin: [ 'top', 'bottom' ], padding: true },
				__experimentalBorder: { radius: true, color: false },
				typography: { fontSize: true, __experimentalFontFamily: true },
				shadow: true,
			} )
		).toBe(
			'align (wide, full); border: radius; color: gradients, text, background; shadow; spacing: margin (top, bottom), padding; typography: fontSize, fontFamily'
		);
	} );

	it( 'leaves out colors the block turns off', () => {
		expect( describeSupports( { color: { text: false, background: true } } ) ).toBe(
			'color: background'
		);
	} );

	it( 'leaves out colors with every kind turned off', () => {
		expect( describeSupports( { color: { text: false, background: false } } ) ).toBe( '' );
	} );

	it( 'is empty for a block without style supports', () => {
		expect( describeSupports( { html: false, inserter: true } ) ).toBe( '' );
	} );
} );

describe( 'collectSiteInfo', () => {
	it( 'collects the blocks users can insert, with their styles', () => {
		const { blocks } = collectSiteInfo();
		const card = blocks.find( ( block ) => block.name === 'my-plugin/card' );
		expect( card ).toMatchObject( {
			title: 'Card',
			parent: [ 'core/group' ],
			styles: [ 'outlined' ],
		} );
		expect( blocks.some( ( block ) => block.name === 'core/paragraph' ) ).toBe( true );
		expect( blocks.some( ( block ) => block.name === 'my-plugin/hidden' ) ).toBe( false );
	} );

	it( "reads the theme's presets, without defaults the theme turned off", () => {
		const info = collectSiteInfo();
		expect( info.colors ).toEqual( [ { slug: 'base', name: 'Base', value: '#ffffff' } ] );
		expect( info.fontSizes ).toEqual( [ { slug: 'large', name: 'Large', value: '2rem' } ] );
		expect( info.fontFamilies[ 0 ] ).toMatchObject( { slug: 'body', value: 'Inter, sans-serif' } );
		expect( info.spacingSizes ).toEqual( [ { slug: '40', name: '1', value: '1rem' } ] );
		expect( info ).toMatchObject( {
			customColor: false,
			customFontSize: true,
			contentSize: '620px',
			wideSize: '1280px',
		} );
	} );
} );

describe( 'formatSiteInfo', () => {
	it( 'describes blocks from plugins with their attributes', () => {
		const text = getSiteInfo();
		expect( text ).toContain(
			'- `my-plugin/card` (Card): color: background; spacing: padding; styles: outlined'
		);
		expect( text ).toContain( '  Only directly inside `core/group`.' );
		expect( text ).toContain( '  - `tone`: string; one of `"calm"`, `"loud"`; default `"calm"`' );
		expect( text ).toContain( '  - `title`: string; in the HTML `h3`, not in the JSON' );
		expect( text ).not.toContain( '`preview`' );
		expect( text ).not.toContain( '`className`:' );
	} );

	it( 'lists core blocks by name, with their block styles', () => {
		const text = getSiteInfo();
		expect( text ).toMatch( /^Core blocks: .*\bparagraph\b.*\.$/m );
		expect( text ).toContain( '- `core/button`: fill, outline' );
		expect( text ).not.toContain( '`core/paragraph`' );
		expect( text ).not.toContain( '`dropCap`' );
	} );

	it( 'lists the presets and the settings', () => {
		const text = getSiteInfo();
		expect( text ).toContain( '- `base`: Base, `#ffffff`' );
		expect( text ).toContain( '- `large`: Large, `2rem`' );
		expect( text ).toContain( '- Custom colors: not allowed' );
		expect( text ).toContain( '- Layout: content width `620px`, wide width `1280px`' );
	} );

	it( 'stays short enough to send with every conversation', () => {
		expect( getSiteInfo().length ).toBeLessThan( 5000 );
	} );

	it( 'gives the same text for the same site, so the prompt cache holds', () => {
		expect( formatSiteInfo( collectSiteInfo() ) ).toBe( getSiteInfo() );
	} );
} );
