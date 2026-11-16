// @vitest-environment jsdom

/**
 * External dependencies
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * WordPress dependencies
 */
import { parse, serialize } from '@wordpress/blocks';
import { registerCoreBlocks } from '@wordpress/block-library';

/**
 * Internal dependencies
 */
import { validateMarkup } from '../validate-markup';
import skill from '../../../skills/block-markup/SKILL.md?raw';
import coreBlocks from '../../../skills/block-markup/references/core-blocks.md?raw';
import specialBlocks from '../../../skills/block-markup/references/special-blocks.md?raw';

const FILES: [ string, string ][] = [
	[ 'SKILL.md', skill ],
	[ 'references/core-blocks.md', coreBlocks ],
	[ 'references/special-blocks.md', specialBlocks ],
];

/**
 * Reads the HTML code blocks of a Markdown file, with the line each one starts on.
 *
 * @param content The Markdown.
 * @return The examples.
 */
function readExamples( content: string ): { line: number; markup: string }[] {
	const lines = content.split( '\n' );
	const examples: { line: number; markup: string }[] = [];
	let start = -1;
	lines.forEach( ( text, index ) => {
		if ( start < 0 && text === '```html' ) {
			start = index + 1;
		} else if ( start >= 0 && text === '```' ) {
			examples.push( { line: start + 1, markup: lines.slice( start, index ).join( '\n' ) } );
			start = -1;
		}
	} );
	return examples;
}

beforeAll( () => {
	// Loading the library complains about editor components that need a browser, which the examples do not use.
	const warn = vi.spyOn( console, 'warn' ).mockImplementation( () => {} );
	const error = vi.spyOn( console, 'error' ).mockImplementation( () => {} );
	registerCoreBlocks();
	warn.mockRestore();
	error.mockRestore();
} );

describe.each( FILES )( 'the examples in %s', ( _file, content ) => {
	const examples = readExamples( content );

	it( 'has examples', () => {
		expect( examples.length ).toBeGreaterThan( 0 );
	} );

	it.each( examples )( 'line $line is valid', ( { markup } ) => {
		expect( validateMarkup( markup ).problems ).toEqual( [] );
	} );

	it.each( examples )( 'line $line is written as the blocks save it', ( { markup } ) => {
		expect( serialize( parse( markup ) ) ).toBe( markup );
	} );
} );
