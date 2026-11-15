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
import { getSiteInfo } from '../site-info';

const features = {
	color: {
		palette: { theme: [ { slug: 'base', name: 'Base', color: '#ffffff' } ] },
		defaultPalette: false,
	},
	blocks: { 'core/heading': { color: { custom: false } } },
};

/**
 * Reads one section of the site information.
 *
 * @param text    The site information.
 * @param heading The section's heading.
 * @return The section's content.
 */
function section( text: string, heading: string ): string {
	return text.split( `## ${ heading }\n\n` )[ 1 ].split( '\n\n## ' )[ 0 ];
}

beforeAll( () => {
	registerCoreBlocks();
	registerBlockType( 'my-plugin/card', {
		apiVersion: 3,
		title: 'Card',
		category: 'design',
		parent: [ 'core/group' ],
		attributes: {
			tone: { type: 'string', enum: [ 'calm', 'loud' ], default: 'calm' },
			preview: { type: 'string', role: 'local' },
		},
		supports: { spacing: { padding: true } },
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
	dispatch( blockEditorStore ).updateSettings( { __experimentalFeatures: features } );
} );

describe( 'getSiteInfo', () => {
	it( 'lists core blocks by name', () => {
		const names = section( getSiteInfo(), 'Core blocks' ).split( ', ' );
		expect( names ).toContain( 'paragraph' );
		expect( names ).not.toContain( 'core/paragraph' );
	} );

	it( 'describes blocks from plugins as in their block.json', () => {
		const [ card, ...others ] = JSON.parse( section( getSiteInfo(), 'Blocks from plugins' ) );
		expect( others ).toEqual( [] );
		expect( card ).toMatchObject( {
			name: 'my-plugin/card',
			title: 'Card',
			parent: [ 'core/group' ],
			supports: { spacing: { padding: true } },
		} );
		expect( card.attributes.tone ).toEqual( {
			type: 'string',
			enum: [ 'calm', 'loud' ],
			default: 'calm',
		} );
		expect( card.attributes.preview ).toBeUndefined();
	} );

	it( 'lists the block styles', () => {
		const styles = JSON.parse( section( getSiteInfo(), 'Block styles' ) );
		expect( styles[ 'my-plugin/card' ] ).toEqual( [ 'outlined' ] );
		expect( styles[ 'core/button' ] ).toEqual( [ 'fill', 'outline' ] );
	} );

	it( 'passes the theme.json settings as they are', () => {
		expect( JSON.parse( section( getSiteInfo(), 'theme.json settings' ) ) ).toEqual( features );
	} );

	it( 'leaves out blocks the editor does not allow', () => {
		dispatch( blockEditorStore ).updateSettings( {
			allowedBlockTypes: [ 'core/paragraph', 'my-plugin/card' ],
		} );
		try {
			const text = getSiteInfo();
			expect( section( text, 'Core blocks' ) ).toBe( 'paragraph' );
			expect( JSON.parse( section( text, 'Block styles' ) ) ).toEqual( {
				'my-plugin/card': [ 'outlined' ],
			} );
		} finally {
			dispatch( blockEditorStore ).updateSettings( { allowedBlockTypes: true } );
		}
	} );

	it( 'gives the same text for the same site, so the prompt cache holds', () => {
		expect( getSiteInfo() ).toBe( getSiteInfo() );
	} );
} );
