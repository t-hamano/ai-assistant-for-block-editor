// @vitest-environment jsdom

/**
 * External dependencies
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * WordPress dependencies
 */
import { createRoot, flushSync } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { AnswerMarkdown } from '../answer-markdown';

describe( 'AnswerMarkdown', () => {
	let container: HTMLDivElement;
	let root: ReturnType< typeof createRoot >;

	beforeEach( () => {
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
	} );

	afterEach( () => {
		root.unmount();
		container.remove();
	} );

	function render( markdown: string ) {
		flushSync( () => root.render( <AnswerMarkdown>{ markdown }</AnswerMarkdown> ) );
	}

	it( 'formats bold text, lists, code, and tables', () => {
		render( '- **Title**: uses `h2`\n- Body\n\n| a | b |\n| - | - |\n| 1 | 2 |' );

		expect( container.querySelectorAll( 'li' ) ).toHaveLength( 2 );
		expect( container.querySelector( 'li strong' )?.textContent ).toBe( 'Title' );
		expect( container.querySelector( 'li code' )?.textContent ).toBe( 'h2' );
		expect( container.querySelector( 'table td' )?.textContent ).toBe( '1' );
	} );

	it( 'shows unclosed formatting as written while the answer streams in', () => {
		render( 'Some **bold' );

		expect( container.querySelector( 'strong' ) ).toBeNull();
		expect( container.textContent ).toBe( 'Some **bold' );
	} );

	it( 'does not render HTML written in the answer', () => {
		render( 'Hi <img src="x" onerror="alert(1)"><script>alert(1)</script>' );

		expect( container.querySelector( 'img' ) ).toBeNull();
		expect( container.querySelector( 'script' ) ).toBeNull();
	} );

	it( 'shows the alt text of images instead of loading them', () => {
		render( '![A chart](https://example.com/chart.png)' );

		expect( container.querySelector( 'img' ) ).toBeNull();
		expect( container.textContent ).toBe( 'A chart' );
	} );

	it( 'drops unsafe link URLs', () => {
		render( '[click](javascript:alert(1))' );

		expect( container.querySelector( 'a' )?.getAttribute( 'href' ) ?? '' ).not.toContain(
			'javascript'
		);
	} );

	it( 'opens links in a new tab', () => {
		render( '[WordPress](https://wordpress.org/)' );

		const link = container.querySelector( 'a' );
		expect( link?.getAttribute( 'href' ) ).toBe( 'https://wordpress.org/' );
		expect( link?.getAttribute( 'target' ) ).toBe( '_blank' );
	} );
} );
