/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { mergeReference, readFrontmatter } from '../block-reference.cjs';

const frontmatter = {
	wordpress: '7.1',
	gutenberg: '24.4.1',
	'block-library': '12.1.0',
	generated: '2026-11-15',
};

const sections = ( entries: Record< string, string > ) => new Map( Object.entries( entries ) );

describe( 'mergeReference', () => {
	it( 'builds a new reference with the blocks in order', () => {
		const { content, removed } = mergeReference(
			'',
			sections( { 'core/quote': 'Quote.', 'core/heading': 'Heading.' } ),
			frontmatter
		);

		expect( readFrontmatter( content ) ).toEqual( frontmatter );
		expect( content.indexOf( '## core/heading' ) ).toBeLessThan(
			content.indexOf( '## core/quote' )
		);
		expect( content ).toContain(
			'## core/heading\n\n<!-- generated:start -->\nHeading.\n<!-- generated:end -->'
		);
		expect( removed ).toEqual( [] );
	} );

	it( 'keeps the introduction and the handwritten parts', () => {
		const { content: first } = mergeReference(
			'',
			sections( { 'core/heading': 'Heading.' } ),
			frontmatter
		);
		const edited = first
			.replace( '# Core blocks', '# Core blocks\n\nA note.' )
			.replace(
				'<!-- generated:end -->',
				'<!-- generated:end -->\n\nCommon mistakes:\n\n- Keep the class.'
			);

		const { content } = mergeReference(
			edited,
			sections( { 'core/heading': 'Heading, regenerated.', 'core/list': 'List.' } ),
			frontmatter
		);

		expect( content ).toContain( 'A note.' );
		expect( content ).toContain(
			'<!-- generated:start -->\nHeading, regenerated.\n<!-- generated:end -->\n\nCommon mistakes:\n\n- Keep the class.\n\n## core/list'
		);
	} );

	it( 'keeps the generation date when nothing generated changed', () => {
		const { content: first } = mergeReference(
			'',
			sections( { 'core/heading': 'Heading.' } ),
			frontmatter
		);

		const { content } = mergeReference( first, sections( { 'core/heading': 'Heading.' } ), {
			...frontmatter,
			generated: '2026-12-01',
		} );

		expect( content ).toBe( first );
	} );

	it( 'updates the generation date when a version changes', () => {
		const { content: first } = mergeReference(
			'',
			sections( { 'core/heading': 'Heading.' } ),
			frontmatter
		);

		const { content } = mergeReference( first, sections( { 'core/heading': 'Heading.' } ), {
			...frontmatter,
			'block-library': '12.2.0',
			generated: '2026-12-01',
		} );

		expect( readFrontmatter( content ) ).toMatchObject( {
			'block-library': '12.2.0',
			generated: '2026-12-01',
		} );
	} );

	it( 'reports removed blocks that had handwritten parts', () => {
		const { content: first } = mergeReference(
			'',
			sections( { 'core/heading': 'Heading.', 'core/list': 'List.' } ),
			frontmatter
		);
		const edited = first.replace(
			'List.\n<!-- generated:end -->',
			'List.\n<!-- generated:end -->\n\n- A note.'
		);

		const { content, removed } = mergeReference(
			edited,
			sections( { 'core/heading': 'Heading.' } ),
			frontmatter
		);

		expect( content ).not.toContain( 'core/list' );
		expect( removed ).toEqual( [ 'core/list' ] );
	} );

	it( 'rejects a section without its generated part', () => {
		expect( () =>
			mergeReference(
				'# Core blocks\n\n## core/heading\n\nNotes only.\n',
				sections( { 'core/heading': 'Heading.' } ),
				frontmatter
			)
		).toThrow( 'core/heading' );
	} );
} );
