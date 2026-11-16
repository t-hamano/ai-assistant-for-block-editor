/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { getSkillNotes } from '../skill-notes';

const PARAGRAPH = '<!-- wp:paragraph -->\n<p>Hello.</p>\n<!-- /wp:paragraph -->';

describe( 'getSkillNotes', () => {
	it( 'gives no notes for a document of common blocks', () => {
		expect( getSkillNotes( PARAGRAPH ) ).toBe( '' );
	} );

	it( 'gives the rules for dynamic blocks', () => {
		const notes = getSkillNotes( `${ PARAGRAPH }\n\n<!-- wp:latest-posts {"postsToShow":3} /-->` );
		expect( notes ).toMatch( /^<skill-notes>\n## Dynamic blocks\n/ );
		expect( notes ).not.toContain( 'Custom HTML' );
		expect(
			getSkillNotes( '<!-- wp:query {"queryId":1} -->\n<div></div>\n<!-- /wp:query -->' )
		).toContain( '## Dynamic blocks' );
	} );

	it( 'gives the rules for custom HTML', () => {
		const notes = getSkillNotes( '<!-- wp:html -->\n<div>Hi</div>\n<!-- /wp:html -->' );
		expect( notes ).toContain( '## Custom HTML (`core/html`)' );
		expect( notes ).not.toContain( '## Dynamic blocks' );
		expect( notes ).toMatch( /<\/skill-notes>$/ );
	} );
} );
