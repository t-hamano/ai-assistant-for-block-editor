---
name: block-markup
description: Rules for writing and editing WordPress block markup that the block editor accepts as valid on the first try.
wordpress: 7.1
gutenberg: 24.4.1
block-library: 12.1.0
generated: 2026-11-15
---

# Block markup

The document is WordPress block markup: the HTML that the block editor saves, with each block marked by HTML comments. Every edit you make is parsed and checked by the editor before it is applied. An edit that does not match what the block itself would save is rejected and comes back to you with the problems, so write the markup exactly as the editor saves it.

## Block delimiters

- A block starts with `<!-- wp:name -->` and ends with `<!-- /wp:name -->`. Its HTML goes between them.
- Core blocks drop the `core/` prefix: `core/paragraph` is `wp:paragraph`. Other blocks keep their namespace: `wp:my-plugin/card`.
- Put each delimiter on its own line, around the block's HTML:

```html
<!-- wp:paragraph -->
<p>Hello.</p>
<!-- /wp:paragraph -->
```

- Separate top-level blocks with one blank line.
- Every piece of content belongs to a block. HTML outside block delimiters becomes a Classic block (`core/freeform`), and the edit is rejected.
- Use core blocks, and blocks from other plugins only when they are in the document or in the site information. A block that is not registered on the site is rejected.

## Attributes

- Attributes go in the opening delimiter as a JSON object, after the name and a space: `<!-- wp:heading {"level":3} -->`.
- Write strict JSON: double quotes, no trailing commas, no comments.
- Leave out attributes that have their default value. A level 2 heading is `<!-- wp:heading -->`, not `{"level":2}`.
- Use only attributes the block has, and only values it allows. Unknown attributes and values outside an `enum` are rejected.
- Attributes that the block reads from its HTML, such as the text of a paragraph, the `src` and `alt` of an image, the `href` of a button, and `anchor` (the HTML `id`), live only in the HTML. Do not repeat them in the JSON.
- Inside JSON strings, write `--` as `\u002d\u002d`, `<` as `\u003c`, `>` as `\u003e`, `&` as `\u0026`, and a `"` in the text as `\u0022`, so the comment cannot end early.

## Attributes and HTML must match

The editor rebuilds each block from its attributes and compares the result with your HTML. Every attribute that changes the output must show up in the HTML in the same way, and the HTML must not have classes or styles that no attribute explains.

| Attribute | Classes and styles on the block's wrapper |
| --- | --- |
| `{"textColor":"contrast"}` | `has-contrast-color has-text-color` |
| `{"backgroundColor":"base"}` | `has-base-background-color has-background` |
| `{"fontSize":"large"}` | `has-large-font-size` |
| `{"style":{"color":{"text":"#1e73be"}}}` | `has-text-color`, `style="color:#1e73be"` |
| `{"style":{"color":{"background":"#f5f5f5"}}}` | `has-background`, `style="background-color:#f5f5f5"` |
| `{"style":{"typography":{"fontSize":"28px"}}}` | `style="font-size:28px"` |
| `{"style":{"spacing":{"padding":{"top":"var:preset\|spacing\|40"}}}}` | `style="padding-top:var(--wp--preset--spacing--40)"` |
| `{"align":"wide"}` | `alignwide` |
| `{"className":"is-style-outline"}` | `is-style-outline` |

```html
<!-- wp:paragraph {"backgroundColor":"base","textColor":"contrast","fontSize":"large"} -->
<p class="has-contrast-color has-base-background-color has-text-color has-background has-large-font-size">Hello.</p>
<!-- /wp:paragraph -->
```

- Keep the block's own class, such as `wp-block-group` or `wp-block-heading`, as the block saves it. Do not add it to blocks that do not save one, such as a paragraph.
- Custom classes go in `className` and on the wrapper. Block styles are classes like `is-style-outline` in `className`.
- Write styles only through the `style` attribute. A `style` in the HTML that no attribute explains is rejected.

## Presets first

- Prefer the theme's presets over fixed values: `textColor`, `backgroundColor`, and `fontSize` with a slug, and `var:preset|spacing|<slug>` for spacing.
- Use only slugs that are in the site information or already in the document. Do not guess slugs.
- Use a fixed value, such as `#1e73be` or `28px`, only when no preset fits what the user asked for, and only for settings the block supports.

## Nesting

Inner blocks go inside the parent's wrapper element, each with its own delimiters. The parent's HTML stays around them.

```html
<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group"><!-- wp:heading -->
<h2 class="wp-block-heading">Title</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Text.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->
```

Some blocks are only valid inside a certain parent, and some parents only take certain children:

- `core/column` only inside `core/columns`, and `core/columns` takes only `core/column`.
- `core/button` only inside `core/buttons`.
- `core/list-item` only inside `core/list`. Each list item is a block:

```html
<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>First</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Second</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->
```

```html
<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="https://example.com/">Read more</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->
```

## Dynamic blocks

Blocks that the server renders and that save nothing, such as `core/latest-posts`, `core/archives`, `core/search`, `core/site-title`, and `core/post-title`, are one self-closing delimiter, with attributes only:

```html
<!-- wp:latest-posts {"postsToShow":3} /-->
```

Do not write HTML for them, and do not write their output by hand.

Some server-rendered blocks still save their inner blocks, such as `core/query` with `core/post-template` inside. Write them with an opening and a closing delimiter, and keep their wrapper and inner blocks as they are in the document.

## Text inside blocks

- Text in a block is inline HTML. Use `<strong>`, `<em>`, `<a href="…">`, `<code>`, `<s>`, `<sub>`, `<sup>`, and `<br>`, not `<b>`, `<i>`, `<span style>`, or `<div>`.
- Escape `&`, `<`, and `>` in text as `&amp;`, `&lt;`, and `&gt;`.
- A new paragraph is a new `core/paragraph` block, not `<br><br>`. A heading is a `core/heading` block, not bold text.

## Custom HTML (`core/html`)

Use `core/html` only when its whole content is a single `<svg>` element or a single `<script>` element. Everything else, such as text, headings, lists, images, buttons, tables, forms, and layout, goes in core blocks that the user can edit. A `core/html` block that breaks this rule is rejected.

A `core/html` block that is already in the document may stay as it is. Do not change its content unless the user asks.

## Media

- Do not invent media IDs or URLs. Use only images and files that are in the document or that the user gave you.
- Keep the `id` attribute and the matching `wp-image-<id>` class of an image together.

## Editing

- Change only what the user asked for. Keep other text, blocks, attributes, classes, styles, and IDs exactly as they are.
- `replace` replaces all the selected blocks. Write every selected block in your markup, also the ones that do not change. A block you leave out is deleted.
- Keep the block type unless the user asks for another one. Rewording a paragraph keeps it a paragraph.
- Keep the existing attributes of a block when you change its text, and keep the existing inner blocks when you change its parent.
- Write the markup the current version of the block saves, also when the document has an older form of it.
- Do not add HTML comments of your own. The only comments in your markup are block delimiters.
