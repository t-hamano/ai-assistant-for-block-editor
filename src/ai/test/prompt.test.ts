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

	it( 'includes the block markup rules without their frontmatter', () => {
		const prompt = buildSystemPrompt( '# Title\n' );
		expect( prompt ).toContain( '<skill name="block-markup">' );
		expect( prompt ).toContain( '# Block markup' );
		expect( prompt ).toContain( '<!-- wp:paragraph -->' );
		expect( prompt ).not.toContain( 'gutenberg:' );
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
