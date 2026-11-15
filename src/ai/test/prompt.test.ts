/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { buildSystemPrompt, stripFrontmatter } from '../prompt';

describe( 'buildSystemPrompt', () => {
	it( 'leaves the document out, so the prompt stays the same as it changes', () => {
		const prompt = buildSystemPrompt( '# Title\n\nOne.\n' );
		expect( prompt ).not.toContain( 'One.' );
		expect( prompt ).toBe( buildSystemPrompt( '# Other\n' ) );
	} );

	it( 'explains the context that comes with the messages', () => {
		const prompt = buildSystemPrompt( '# Title\n' );
		expect( prompt ).toContain( '<document>' );
		expect( prompt ).toContain( '<selection>' );
	} );

	it( 'covers editing with and without a selection', () => {
		const prompt = buildSystemPrompt( '# Title\n' );
		expect( prompt ).toContain( 'When there is a selection, edit it' );
		expect( prompt ).toContain( 'When nothing is selected' );
	} );

	it( 'explains the reference IDs and the edits by them', () => {
		const prompt = buildSystemPrompt( '# Title\n' );
		expect( prompt ).toContain( '<!-- ref:b12 -->' );
		for ( const action of [
			'replace_block',
			'insert_before',
			'delete_block',
			'append',
			'replace_text',
		] ) {
			expect( prompt ).toContain( `"${ action }"` );
		}
	} );

	it( 'includes the block markup rules without their frontmatter', () => {
		const prompt = buildSystemPrompt( '# Title\n' );
		expect( prompt ).toContain( '<skill name="block-markup">' );
		expect( prompt ).toContain( '# Block markup' );
		expect( prompt ).toContain( '<!-- wp:paragraph -->' );
		expect( prompt ).not.toContain( 'gutenberg:' );
	} );

	it( 'forbids new custom HTML blocks', () => {
		const prompt = buildSystemPrompt( '# Title\n' );
		expect( prompt ).toContain( 'Do not write new `core/html` blocks.' );
		expect( prompt ).not.toContain( '<script>' );
	} );

	it( 'keeps the escapes for JSON strings written out', () => {
		const backslash = String.fromCharCode( 92 );
		expect( buildSystemPrompt( '# Title\n' ) ).toContain(
			`${ backslash }u002d${ backslash }u002d`
		);
	} );

	it( 'adds the site information after the rules', () => {
		const prompt = buildSystemPrompt( '# Title\n', '## Blocks\n\n- `my-plugin/card`\n' );
		expect( prompt ).toContain( '<site-info> describes the blocks and the theme.json settings' );
		expect( prompt ).toMatch(
			/<\/skill>\n\n<site-info>\n## Blocks\n\n- `my-plugin\/card`\n<\/site-info>$/
		);
	} );

	it( 'leaves the site information out when there is none', () => {
		const prompt = buildSystemPrompt( '# Title\n' );
		expect( prompt ).not.toContain( '</site-info>' );
	} );

	it( 'leaves the site information out when the document is not available', () => {
		expect( buildSystemPrompt( null, '## Blocks\n' ) ).not.toContain( '</site-info>' );
	} );

	it( 'asks for answers only when the document is not available', () => {
		const prompt = buildSystemPrompt( null );
		expect( prompt ).toContain( 'you cannot edit it' );
		expect( prompt ).not.toContain( '<document' );
		expect( prompt ).not.toContain( '<skill' );
	} );
} );

describe( 'stripFrontmatter', () => {
	it( 'removes the frontmatter', () => {
		expect( stripFrontmatter( '---\nname: a\nwordpress: 7.1\n---\n\n# Rules\n\nOne.\n' ) ).toBe(
			'# Rules\n\nOne.'
		);
	} );

	it( 'leaves a skill without frontmatter as it is', () => {
		expect( stripFrontmatter( '# Rules\n---\nOne.\n' ) ).toBe( '# Rules\n---\nOne.' );
	} );
} );
