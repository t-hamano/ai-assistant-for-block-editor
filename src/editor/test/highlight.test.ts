// @vitest-environment jsdom

/**
 * External dependencies
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { createBlock, registerBlockType } from '@wordpress/blocks';
import { dispatch } from '@wordpress/data';
import { createElement } from '@wordpress/element';

/**
 * Internal dependencies
 */
import {
	HIGHLIGHT_DURATION,
	findChangedBlocks,
	highlightBlocks,
	isHighlighted,
	takeBlockSnapshot,
} from '../highlight';

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
	registerBlockType( 'test/group', {
		apiVersion: 3,
		title: 'Group',
		category: 'design',
		attributes: {},
		edit: () => null,
		save: () => null,
	} );
} );

function setUp() {
	const inner = createBlock( 'test/text', { content: 'Inner' } );
	const blocks = [
		createBlock( 'test/text', { content: 'One' } ),
		createBlock( 'test/group', {}, [ inner ] ),
		createBlock( 'test/text', { content: 'Two' } ),
	];
	dispatch( blockEditorStore ).resetBlocks( blocks );
	return { one: blocks[ 0 ].clientId, group: blocks[ 1 ].clientId, inner: inner.clientId };
}

describe( 'findChangedBlocks', () => {
	it( 'finds nothing when nothing changed', () => {
		setUp();
		expect( findChangedBlocks( takeBlockSnapshot() ) ).toEqual( [] );
	} );

	it( 'finds the blocks whose attributes changed', () => {
		const { one, inner } = setUp();
		const before = takeBlockSnapshot();
		dispatch( blockEditorStore ).updateBlockAttributes( inner, { content: 'Changed' } );
		dispatch( blockEditorStore ).updateBlockAttributes( one, { content: 'Changed' } );
		expect( findChangedBlocks( before ) ).toEqual( [ one, inner ] );
	} );

	it( 'finds inserted blocks, without their inner blocks', () => {
		const { one } = setUp();
		const before = takeBlockSnapshot();
		const group = createBlock( 'test/group', {}, [ createBlock( 'test/text' ) ] );
		dispatch( blockEditorStore ).insertBlocks( [ group ], 1, undefined, false );
		expect( findChangedBlocks( before ) ).toEqual( [ group.clientId ] );
		expect( findChangedBlocks( before ) ).not.toContain( one );
	} );

	it( 'finds the blocks that replaced others', () => {
		const { group } = setUp();
		const before = takeBlockSnapshot();
		const text = createBlock( 'test/text', { content: 'New' } );
		dispatch( blockEditorStore ).replaceBlocks( [ group ], [ text ], undefined, null );
		expect( findChangedBlocks( before ) ).toEqual( [ text.clientId ] );
	} );
} );

describe( 'highlightBlocks', () => {
	beforeEach( () => {
		vi.useFakeTimers();
	} );

	afterEach( () => {
		vi.runAllTimers();
		vi.useRealTimers();
	} );

	it( 'highlights the blocks for a while', () => {
		highlightBlocks( [ 'a', 'b' ] );
		expect( isHighlighted( 'a' ) ).toBe( true );
		expect( isHighlighted( 'b' ) ).toBe( true );
		vi.advanceTimersByTime( HIGHLIGHT_DURATION );
		expect( isHighlighted( 'a' ) ).toBe( false );
		expect( isHighlighted( 'b' ) ).toBe( false );
	} );

	it( 'keeps a block highlighted for the full time when it changes again', () => {
		highlightBlocks( [ 'a' ] );
		vi.advanceTimersByTime( HIGHLIGHT_DURATION / 2 );
		highlightBlocks( [ 'a' ] );
		vi.advanceTimersByTime( HIGHLIGHT_DURATION / 2 );
		expect( isHighlighted( 'a' ) ).toBe( true );
		vi.advanceTimersByTime( HIGHLIGHT_DURATION / 2 );
		expect( isHighlighted( 'a' ) ).toBe( false );
	} );
} );
