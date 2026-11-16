/**
 * Internal dependencies
 */
import specialBlocks from '../../skills/block-markup/references/special-blocks.md?raw';

/**
 * The sections of the skill for blocks that few documents have, by their
 * heading, with what in a document calls for each.
 */
const NOTES: { heading: string; test: RegExp }[] = [
	{
		heading: '## Dynamic blocks',
		// A self-closing block delimiter, or a query loop.
		test: /<!--\s+wp:(?:[a-z][a-z0-9_-]*\/)?[a-z][a-z0-9_-]*\s+(?:\{[\s\S]*?\}\s+)?\/-->|<!--\s+wp:query[\s/]/i,
	},
	{
		heading: '## Custom HTML (`core/html`)',
		test: /<!--\s+wp:html[\s/]/i,
	},
];

/**
 * Finds a section of the reference by its heading: the heading and what
 * follows it up to the next heading of the same level.
 *
 * @param heading The heading.
 * @return The section.
 */
function findSection( heading: string ): string {
	const start = specialBlocks.indexOf( `${ heading }\n` );
	if ( start < 0 ) {
		return '';
	}
	const end = specialBlocks.indexOf( '\n## ', start + heading.length );
	return specialBlocks.slice( start, end < 0 ? undefined : end ).trim();
}

/**
 * Picks the rules for the blocks of the document that the skill in the
 * instructions leaves out, since few documents have them. They go with
 * the document, so the instructions stay the same and stay cached.
 *
 * @param document The document, as block markup.
 * @return The `<skill-notes>` block, or an empty string when the document
 *         needs none.
 */
export function getSkillNotes( document: string ): string {
	const sections = NOTES.filter( ( { test } ) => test.test( document ) )
		.map( ( { heading } ) => findSection( heading ) )
		.filter( Boolean );
	return sections.length ? `<skill-notes>\n${ sections.join( '\n\n' ) }\n</skill-notes>` : '';
}
