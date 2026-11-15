/**
 * WordPress dependencies
 */
import { parse as parseRaw } from '@wordpress/block-serialization-default-parser';
import {
	getBlockAttributes,
	getBlockType,
	getFreeformContentHandlerName,
	getUnregisteredTypeHandlerName,
	parse,
	serialize,
	serializeRawBlock,
	validateBlock,
	type Block,
} from '@wordpress/blocks';

type RawBlock = ReturnType< typeof parseRaw >[ number ];

type AttributeSchema = { type?: string | string[]; enum?: unknown[]; source?: string };

/**
 * Whether the value has one of the types, as the parser checks them. A
 * value of the wrong type is dropped.
 *
 * @param value The value.
 * @param type  The attribute's type, or types.
 * @return Whether it does.
 */
function hasType( value: unknown, type: AttributeSchema[ 'type' ] ): boolean {
	if ( type === undefined ) {
		return true;
	}
	return ( Array.isArray( type ) ? type : [ type ] ).some( ( item ) => {
		switch ( item ) {
			case 'null':
				return value === null;
			case 'boolean':
			case 'string':
			case 'number':
				return typeof value === item;
			case 'integer':
				return Number.isInteger( value );
			case 'array':
				return Array.isArray( value );
			case 'object':
				return value !== null && typeof value === 'object' && ! Array.isArray( value );
			default:
				return true;
		}
	} );
}

/**
 * Whether the attribute takes the value.
 *
 * @param schema The attribute.
 * @param value  The value.
 * @return Whether it does.
 */
function accepts( schema: AttributeSchema, value: unknown ): boolean {
	return (
		hasType( value, schema.type ) &&
		( ! Array.isArray( schema.enum ) || schema.enum.includes( value ) )
	);
}

/**
 * What became of the markup the model wrote.
 */
export type MarkupValidation = {
	/**
	 * The parsed blocks. Blocks written in a deprecated form are in their
	 * migrated form.
	 */
	blocks: Block[];
	/**
	 * What is wrong with the markup, to tell the model. Empty when the
	 * blocks can be applied.
	 */
	problems: string[];
};

/**
 * Inline SVG or a script is the only content `core/html` may hold, since
 * blocks have no equivalent for it.
 */
const ALLOWED_HTML = [ 'svg', 'script' ];

/**
 * Whether the HTML is one element that `core/html` may hold, with nothing
 * beside it.
 *
 * @param html The HTML.
 * @return Whether it is.
 */
function isAllowedHtml( html: string ): boolean {
	const template = document.createElement( 'template' );
	template.innerHTML = html;
	const nodes = Array.from( template.content.childNodes ).filter(
		( node ) =>
			node.nodeType !== node.COMMENT_NODE &&
			! ( node.nodeType === node.TEXT_NODE && ! node.textContent?.trim() )
	);
	return (
		nodes.length === 1 &&
		nodes[ 0 ].nodeType === nodes[ 0 ].ELEMENT_NODE &&
		ALLOWED_HTML.includes( ( nodes[ 0 ] as Element ).localName )
	);
}

/**
 * Formats a validation message, which the parser logs like the console
 * does: a format string whose `%s`, `%o` placeholders take the arguments
 * that follow.
 *
 * @param args The logged arguments.
 * @return The message.
 */
function formatIssue( args: unknown[] ): string {
	const show = ( value: unknown ) =>
		typeof value === 'object' ? JSON.stringify( value ) : String( value );
	const rest = args.slice( 1 );
	return String( args[ 0 ] ?? '' ).replace( /%[sodif]/g, ( placeholder ) =>
		rest.length ? show( rest.shift() ) : placeholder
	);
}

/**
 * The block's markup as its `save` writes it from the attributes the parser
 * read, with its inner blocks written the same way.
 *
 * @param block The parsed block.
 * @return The markup.
 */
function toSavedMarkup( block: Block ): string {
	const asValid = ( item: Block ): Block => ( {
		...item,
		isValid: true,
		innerBlocks: item.innerBlocks.map( asValid ),
	} );
	return serialize( asValid( block ) );
}

/**
 * Whether the block is in a deprecated form, which the parser migrates:
 * its HTML is not what the current version saves.
 *
 * @param raw The block, from the default parser.
 * @return Whether it is.
 */
function isDeprecatedForm( raw: RawBlock ): boolean {
	const name = raw.blockName as string;
	const blockType = getBlockType( name );
	if ( ! blockType?.deprecated?.length ) {
		return false;
	}
	const innerBlocks = parse(
		raw.innerBlocks
			// Both parsers give the same shape, typed apart.
			.map( ( inner ) => serializeRawBlock( inner as Parameters< typeof serializeRawBlock >[ 0 ] ) )
			.join( '' )
	);
	const [ isValid ] = validateBlock(
		{
			clientId: '',
			name,
			isValid: true,
			attributes: getBlockAttributes( blockType, raw.innerHTML, raw.attrs ?? {} ),
			innerBlocks,
			originalContent: raw.innerHTML,
		},
		blockType
	);
	return ! isValid;
}

/**
 * Checks the attributes in a block's comment against its type, which the
 * parser drops without a word when it does not know them.
 *
 * @param raw The block, from the default parser.
 * @return The problems.
 */
function checkAttributes( raw: RawBlock ): string[] {
	const name = raw.blockName as string;
	const attrs: Record< string, unknown > = raw.attrs ?? {};
	const blockType = getBlockType( name ) as
		| { attributes?: Record< string, AttributeSchema >; deprecated?: { attributes?: object }[] }
		| undefined;
	if ( ! blockType ) {
		return [];
	}
	const current = blockType.attributes ?? {};
	const check = ( versions: Record< string, AttributeSchema >[] ) => {
		const problems: string[] = [];
		for ( const [ key, value ] of Object.entries( attrs ) ) {
			const schemas = versions.map( ( version ) => version[ key ] ).filter( Boolean );
			if ( ! schemas.length ) {
				problems.push( `"${ key }" is not an attribute of the ${ name } block.` );
			} else if ( ! schemas.some( ( schema ) => accepts( schema, value ) ) ) {
				const schema = current[ key ] ?? schemas[ 0 ];
				const expected = Array.isArray( schema.enum )
					? `Use one of: ${ schema.enum.map( ( item ) => JSON.stringify( item ) ).join( ', ' ) }.`
					: `Use a value of type ${ [ schema.type ].flat().join( ' or ' ) }.`;
				problems.push(
					`${ JSON.stringify( value ) } is not a value of the "${ key }" attribute of the ${ name } block. ${ expected }`
				);
			}
		}
		return problems;
	};

	let problems = check( [ current ] );
	// A block in a deprecated form has its attributes migrated by the
	// parser, so the attributes of any version are fine there.
	if ( problems.length && isDeprecatedForm( raw ) ) {
		problems = check( [
			current,
			...( blockType.deprecated ?? [] ).map(
				( version ) => ( version.attributes ?? {} ) as Record< string, AttributeSchema >
			),
		] );
	}
	if ( problems.length ) {
		const names = Object.entries( current )
			.filter( ( [ , schema ] ) => ! schema.source )
			.map( ( [ key ] ) => key );
		problems.push( `The ${ name } block has these attributes: ${ names.join( ', ' ) }.` );
	}
	return problems;
}

/**
 * Checks the blocks as the model wrote them: their names, their attributes,
 * HTML outside blocks, and what `core/html` holds.
 *
 * @param rawBlocks    The blocks, from the default parser.
 * @param existingHtml The content of the `core/html` blocks in the
 *                     document, which the model may keep.
 * @param isTopLevel   Whether the blocks are at the top of the markup.
 * @return The problems.
 */
function checkRawBlocks(
	rawBlocks: RawBlock[],
	existingHtml: Set< string >,
	isTopLevel: boolean
): string[] {
	return rawBlocks.flatMap( ( raw ) => {
		if ( ! raw.blockName ) {
			const html = raw.innerHTML.trim();
			// Only the top level has HTML outside blocks: inside a block, it
			// belongs to the block.
			return isTopLevel && html
				? [
						`This HTML is not in a block, so it would become a Classic block: ${ html.slice(
							0,
							200
						) }. Wrap the content in block comment delimiters.`,
					]
				: [];
		}
		const name = raw.blockName;
		if ( ! getBlockType( name ) ) {
			return [ `The ${ name } block is not registered on this site. Use a registered block.` ];
		}
		const problems = checkAttributes( raw );
		if ( name === 'core/html' ) {
			const html = raw.innerHTML.trim();
			if ( html && ! existingHtml.has( html ) && ! isAllowedHtml( html ) ) {
				problems.push(
					'Use core/html only for an inline SVG or a script. Write text, headings, lists, images, and layout as core blocks, such as core/paragraph, core/heading, core/list, core/image, and core/group, so that the user can edit them.'
				);
			}
		}
		return [ ...problems, ...checkRawBlocks( raw.innerBlocks, existingHtml, false ) ];
	} );
}

/**
 * Checks that the blocks' HTML is what their `save` writes from their
 * attributes, and tells the model the markup that would be.
 *
 * @param blocks The parsed blocks.
 * @return The problems.
 */
function checkParsedBlocks( blocks: Block[] ): string[] {
	const fallbacks = [ getFreeformContentHandlerName(), getUnregisteredTypeHandlerName() ];
	return blocks.flatMap( ( block ) => {
		// The model's markup checks report these already.
		if ( fallbacks.includes( block.name ) ) {
			return [];
		}
		if ( block.isValid === false ) {
			const issues = ( block.validationIssues ?? [] )
				.map( ( issue: { args?: unknown[] } ) => formatIssue( issue.args ?? [] ) )
				.filter( ( issue: string ) => issue && ! issue.startsWith( 'Block validation failed' ) );
			return [
				[
					`The HTML of this ${ block.name } block does not match its attributes${
						issues.length ? `: ${ issues.join( ' ' ) }` : '.'
					}`,
					block.originalContent ?? '',
					'With the same attributes, the block is written as:',
					toSavedMarkup( block ),
				].join( '\n' ),
			];
		}
		return checkParsedBlocks( block.innerBlocks );
	} );
}

/**
 * Validates the block markup the model wrote, including nested blocks, as
 * the editor would read it.
 *
 * @param markup       The markup.
 * @param existingHtml The content of the `core/html` blocks in the
 *                     document, which the model may keep as it is.
 * @return The parsed blocks, and the problems to tell the model.
 */
export function validateMarkup(
	markup: string,
	existingHtml: Set< string > = new Set()
): MarkupValidation {
	const blocks = parse( markup );
	const problems = [
		...checkRawBlocks( parseRaw( markup ), existingHtml, true ),
		...checkParsedBlocks( blocks ),
	];
	return { blocks, problems };
}

/**
 * Collects the content of the `core/html` blocks among the blocks.
 *
 * @param blocks The blocks.
 * @return The content.
 */
export function collectHtml( blocks: Block[] ): Set< string > {
	const html = new Set< string >();
	const visit = ( items: Block[] ) =>
		items.forEach( ( block ) => {
			if ( block.name === 'core/html' && typeof block.attributes.content === 'string' ) {
				html.add( block.attributes.content.trim() );
			}
			visit( block.innerBlocks );
		} );
	visit( blocks );
	return html;
}
