/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	LONG_DOCUMENT,
	formatOutline,
	isLongDocument,
	parseOutline,
	readDocument,
} from '../document-outline';

const paragraph = ( ref: string, text: string ) =>
	`<!-- ref:${ ref } --><!-- wp:paragraph -->\n<p>${ text }</p>\n<!-- /wp:paragraph -->`;

const group = ( ref: string, ...inner: string[] ) =>
	`<!-- ref:${ ref } --><!-- wp:group {"layout":{"type":"constrained"}} -->\n<div class="wp-block-group">${ inner.join(
		'\n\n'
	) }</div>\n<!-- /wp:group -->`;

const doc = ( ...blocks: string[] ) => blocks.join( '\n\n' );

describe( 'parseOutline', () => {
	it( 'lists every block with its own text, nested blocks included', () => {
		const document = doc(
			paragraph( 'b1', 'One &amp; <strong>two</strong>.' ),
			group( 'b2', paragraph( 'b3', 'Inside.' ) ),
			'<!-- ref:b4 --><!-- wp:my-plugin/widget {"count":3} /-->'
		);
		expect(
			parseOutline( document ).map( ( { ref, name, depth, text } ) => ( {
				ref,
				name,
				depth,
				text,
			} ) )
		).toEqual( [
			{ ref: 'b1', name: 'core/paragraph', depth: 0, text: 'One & two.' },
			{ ref: 'b2', name: 'core/group', depth: 0, text: '' },
			{ ref: 'b3', name: 'core/paragraph', depth: 1, text: 'Inside.' },
			{ ref: 'b4', name: 'my-plugin/widget', depth: 0, text: '' },
		] );
	} );
} );

describe( 'isLongDocument', () => {
	const blocks = Array.from( { length: 300 }, ( _, n ) =>
		paragraph( `b${ n + 1 }`, 'Lorem ipsum dolor sit amet. '.repeat( 10 ) )
	);

	it( 'is true for a long document of blocks with reference IDs', () => {
		expect( isLongDocument( doc( ...blocks ) ) ).toBe( true );
		expect( isLongDocument( doc( ...blocks.slice( 0, 10 ) ) ) ).toBe( false );
	} );

	it( 'is false when content outside blocks would be missing from the outline', () => {
		expect( isLongDocument( doc( '<p>Classic.</p>', ...blocks ) ) ).toBe( false );
	} );
} );

describe( 'formatOutline', () => {
	it( 'shows each block in a line, indented, with its leading text cut short', () => {
		const long = 'word '.repeat( 40 );
		const outline = formatOutline(
			doc( group( 'b1', paragraph( 'b2', long ) ), paragraph( 'b3', 'Short.' ) ),
			''
		);
		expect( outline ).toBe(
			[
				'<outline>',
				'b1 core/group',
				`  b2 core/paragraph: ${ long.slice( 0, 80 ).trimEnd() }…`,
				'b3 core/paragraph: Short.',
				'</outline>',
			].join( '\n' )
		);
	} );

	it( 'adds the blocks around the selection as markup', () => {
		const blocks = [ 1, 2, 3, 4, 5, 6, 7 ].map( ( n ) => paragraph( `b${ n }`, `P${ n }` ) );
		const outline = formatOutline( doc( ...blocks ), doc( blocks[ 3 ], blocks[ 4 ] ) );
		expect( outline ).toContain(
			[ '<nearby>', blocks[ 1 ], blocks[ 2 ], blocks[ 5 ], blocks[ 6 ], '</nearby>' ].join( '\n' )
		);
	} );

	it( 'takes the blocks around a nested selection from its parent', () => {
		const outline = formatOutline(
			doc(
				paragraph( 'b1', 'Outside' ),
				group( 'b2', paragraph( 'b3', 'A' ), paragraph( 'b4', 'B' ) )
			),
			paragraph( 'b4', 'B' )
		);
		expect( outline ).toContain( [ '<nearby>', paragraph( 'b3', 'A' ), '</nearby>' ].join( '\n' ) );
	} );
} );

describe( 'readDocument', () => {
	const document = doc(
		paragraph( 'b1', 'Hello world.' ),
		group( 'b2', paragraph( 'b3', 'Say hello.' ) )
	);

	it( 'returns the markup of the blocks, nested blocks included', () => {
		expect( readDocument( document, { tool: 'read_blocks', refs: [ 'b2', 'b1' ] } ) ).toEqual( {
			status: 'done',
			content: doc(
				group( 'b2', paragraph( 'b3', 'Say hello.' ) ),
				paragraph( 'b1', 'Hello world.' )
			),
		} );
	} );

	it( 'tells which reference IDs are not in the document', () => {
		expect( readDocument( document, { tool: 'read_blocks', refs: [ 'b1', 'b9' ] } ) ).toEqual( {
			status: 'done',
			content: doc(
				paragraph( 'b1', 'Hello world.' ),
				'No block in the document now has the reference ID b9.'
			),
		} );
		expect( readDocument( document, { tool: 'read_blocks', refs: [ 'b9' ] } ) ).toEqual( {
			status: 'failed',
			reason: 'No block in the document now has the reference ID b9.',
		} );
	} );

	it( 'shows a block too long to read at once as an outline', () => {
		const huge = group( 'b1', paragraph( 'b2', 'x'.repeat( LONG_DOCUMENT ) ) );
		const result = readDocument( huge, { tool: 'read_blocks', refs: [ 'b1' ] } );
		expect( result.status === 'done' && result.content ).toContain(
			'\nb1 core/group\n  b2 core/paragraph: x'
		);
	} );

	it( 'returns a long block without nested blocks as a whole', () => {
		const huge = paragraph( 'b1', 'x'.repeat( LONG_DOCUMENT ) );
		expect( readDocument( huge, { tool: 'read_blocks', refs: [ 'b1' ] } ) ).toEqual( {
			status: 'done',
			content: huge,
		} );
	} );

	it( 'finds text across inline formatting', () => {
		expect(
			readDocument( paragraph( 'b1', 'Hello <strong>wor</strong>ld.' ), {
				tool: 'find_blocks',
				query: 'hello world.',
			} )
		).toEqual( { status: 'done', content: 'b1 core/paragraph: Hello world.' } );
	} );

	it( 'finds the blocks whose text has the query, ignoring case', () => {
		expect( readDocument( document, { tool: 'find_blocks', query: 'HELLO' } ) ).toEqual( {
			status: 'done',
			content: 'b1 core/paragraph: Hello world.\nb3 core/paragraph: Say hello.',
		} );
		expect( readDocument( document, { tool: 'find_blocks', query: 'nothing' } ) ).toEqual( {
			status: 'done',
			content: 'No block has the text "nothing".',
		} );
	} );
} );
