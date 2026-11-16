# Blocks that need more rules

These sections go to the model only when the document has such blocks, together with the document.

## Dynamic blocks

Blocks that the server renders and that save nothing, such as `core/latest-posts`, `core/archives`, `core/search`, `core/site-title`, and `core/post-title`, are one self-closing delimiter, with attributes only:

```html
<!-- wp:latest-posts {"postsToShow":3} /-->
```

Do not write HTML for them, and do not write their output by hand.

Some server-rendered blocks still save their inner blocks, such as `core/query` with `core/post-template` inside. Write them with an opening and a closing delimiter, and keep their wrapper and inner blocks as they are in the document.

## Custom HTML (`core/html`)

Do not write new `core/html` blocks. Text, headings, lists, images, buttons, tables, forms, and layout go in core blocks that the user can edit. A new `core/html` block is rejected.

A `core/html` block that is already in the document stays exactly as it is, also inside markup you replace. Do not change its content, even when asked. When the user asks for custom HTML, scripts, or changes to a `core/html` block, tell them to edit the Custom HTML block themselves.
