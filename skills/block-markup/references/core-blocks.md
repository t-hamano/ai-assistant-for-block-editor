---
wordpress: 7.1
gutenberg: 24.4.1
block-library: 12.1.0
generated: 2026-11-15
---

# Core blocks

The attributes and example markup of each core block. Write the markup the way the examples show it. The attributes of a block are the ones listed under it, together with the attributes its supports add, such as `className`, `style`, `textColor`, and `align`, that the common rules and the site information describe.

## core/accordion

<!-- generated:start -->
Accordion. Displays a foldable layout that groups content in collapsible sections.

Takes only `core/accordion-item` as inner blocks.

Attributes:

- `iconPosition`: string; default `"right"`
- `showIcon`: boolean; default `true`
- `autoclose`: boolean; default `false`
- `headingLevel`: number; default `3`
- `levelOptions`: array

Example:

```html
<!-- wp:accordion -->
<div role="group" class="wp-block-accordion"><!-- wp:accordion-item -->
<div class="wp-block-accordion-item"><!-- wp:accordion-heading -->
<h3 class="wp-block-accordion-heading has-icon has-icon-right"><button type="button" class="wp-block-accordion-heading__toggle"><span class="wp-block-accordion-heading__toggle-title">Lorem ipsum dolor sit amet, consectetur.</span><span class="wp-block-accordion-heading__toggle-icon" aria-hidden="true">+</span></button></h3>
<!-- /wp:accordion-heading --></div>
<!-- /wp:accordion-item -->

<!-- wp:accordion-item -->
<div class="wp-block-accordion-item"><!-- wp:accordion-heading -->
<h3 class="wp-block-accordion-heading has-icon has-icon-right"><button type="button" class="wp-block-accordion-heading__toggle"><span class="wp-block-accordion-heading__toggle-title">Suspendisse commodo lacus, interdum et.</span><span class="wp-block-accordion-heading__toggle-icon" aria-hidden="true">+</span></button></h3>
<!-- /wp:accordion-heading --></div>
<!-- /wp:accordion-item --></div>
<!-- /wp:accordion -->
```
<!-- generated:end -->

## core/accordion-heading

<!-- generated:start -->
Accordion Heading. Displays a heading that toggles the accordion panel.

Only directly inside `core/accordion-item`.

Attributes:

- `openByDefault`: boolean; default `false`
- `title`: rich-text; in the HTML `.wp-block-accordion-heading__toggle-title`, not in the JSON
- `level`: number
- `iconPosition`: string; one of `"left"`, `"right"`; default `"right"`
- `showIcon`: boolean; default `true`

Example:

```html
<!-- wp:accordion-heading -->
<h3 class="wp-block-accordion-heading has-icon has-icon-right"><button type="button" class="wp-block-accordion-heading__toggle"><span class="wp-block-accordion-heading__toggle-title"></span><span class="wp-block-accordion-heading__toggle-icon" aria-hidden="true">+</span></button></h3>
<!-- /wp:accordion-heading -->
```
<!-- generated:end -->

## core/accordion-item

<!-- generated:start -->
Accordion Item. Wraps the heading and panel in one unit.

Only directly inside `core/accordion`.

Takes only `core/accordion-heading`, `core/accordion-panel` as inner blocks.

Attributes:

- `openByDefault`: boolean; default `false`

See the example of `core/accordion`.
<!-- generated:end -->

## core/accordion-panel

<!-- generated:start -->
Accordion Panel. Contains the hidden or revealed content beneath the heading.

Only directly inside `core/accordion-item`.

Attributes:

- `templateLock`: string | boolean; one of `"all"`, `"insert"`, `"contentOnly"`, `false`; default `false`

Example:

```html
<!-- wp:accordion-panel -->
<div role="region" class="wp-block-accordion-panel"></div>
<!-- /wp:accordion-panel -->
```
<!-- generated:end -->

## core/archives

<!-- generated:start -->
Archives. Display a date archive of your posts.

Attributes:

- `displayAsDropdown`: boolean; default `false`
- `showLabel`: boolean; default `true`
- `showPostCounts`: boolean; default `false`
- `type`: string; default `"monthly"`

Example:

```html
<!-- wp:archives /-->
```
<!-- generated:end -->

## core/audio

<!-- generated:start -->
Audio. Embed a simple audio player.

Attributes:

- `src`: string; in the HTML `audio` `src`, not in the JSON
- `caption`: rich-text; in the HTML `figcaption`, not in the JSON
- `id`: number
- `autoplay`: boolean; in the HTML `audio` `autoplay`, not in the JSON
- `loop`: boolean; in the HTML `audio` `loop`, not in the JSON
- `preload`: string; in the HTML `audio` `preload`, not in the JSON

Example:

```html
<!-- wp:audio -->
<figure class="wp-block-audio"><audio controls src="https://upload.wikimedia.org/wikipedia/commons/d/dd/Armstrong_Small_Step.ogg"></audio></figure>
<!-- /wp:audio -->
```
<!-- generated:end -->

## core/avatar

<!-- generated:start -->
Avatar. Add a user’s avatar.

Attributes:

- `userId`: number
- `size`: number; default `96`
- `isLink`: boolean; default `false`
- `linkTarget`: string; default `"_self"`

Example:

```html
<!-- wp:avatar /-->
```
<!-- generated:end -->

## core/breadcrumbs

<!-- generated:start -->
Breadcrumbs. Display a breadcrumb trail showing the path to the current page.

Attributes:

- `prefersTaxonomy`: boolean; default `false`
- `separator`: string; default `"/"`
- `showHomeItem`: boolean; default `true`
- `showCurrentItem`: boolean; default `true`
- `showOnHomePage`: boolean; default `false`

Example:

```html
<!-- wp:breadcrumbs /-->
```
<!-- generated:end -->

## core/button

<!-- generated:start -->
Button. Prompt visitors to take action with a button-style link.

Only directly inside `core/buttons`.

Attributes:

- `tagName`: string; one of `"a"`, `"button"`; default `"a"`
- `type`: string; default `"button"`
- `url`: string; in the HTML `a` `href`, not in the JSON
- `title`: string; in the HTML `a,button` `title`, not in the JSON
- `text`: rich-text; in the HTML `a,button`, not in the JSON
- `linkTarget`: string; in the HTML `a` `target`, not in the JSON
- `rel`: string; in the HTML `a` `rel`, not in the JSON
- `placeholder`: string
- `backgroundColor`: string
- `textColor`: string
- `gradient`: string

Example:

```html
<!-- wp:button {"className":"is-style-fill"} -->
<div class="wp-block-button is-style-fill"><a class="wp-block-button__link wp-element-button">Call to action</a></div>
<!-- /wp:button -->
```
<!-- generated:end -->

Common mistakes:

- Only inside `core/buttons`, never on its own or straight in a group.
- The link is `<a class="wp-block-button__link wp-element-button" href="…">`. The URL lives in the HTML only.
- Color classes go on the `<a>`, not on the wrapper `<div>`: `{"backgroundColor":"contrast","textColor":"base"}` gives `<a class="wp-block-button__link has-base-color has-contrast-background-color has-text-color has-background wp-element-button">`.
- Block styles such as `is-style-outline` go on the wrapper `<div>`, with `{"className":"is-style-outline"}`.

## core/buttons

<!-- generated:start -->
Buttons. Prompt visitors to take action with a group of button-style links.

Takes only `core/button` as inner blocks.

No attributes of its own.

Example:

```html
<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button">Find out more</a></div>
<!-- /wp:button -->

<!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button">Contact us</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->
```
<!-- generated:end -->

Common mistakes:

- Takes only `core/button` blocks. Put links of other kinds in a paragraph.

## core/calendar

<!-- generated:start -->
Calendar. A calendar of your site’s posts.

Attributes:

- `month`: integer
- `year`: integer

Example:

```html
<!-- wp:calendar /-->
```
<!-- generated:end -->

## core/categories

<!-- generated:start -->
Terms List. Display a list of all terms of a given taxonomy.

Attributes:

- `taxonomy`: string; default `"category"`
- `displayAsDropdown`: boolean; default `false`
- `showHierarchy`: boolean; default `false`
- `showPostCounts`: boolean; default `false`
- `showOnlyTopLevel`: boolean; default `false`
- `showEmpty`: boolean; default `false`
- `label`: string
- `showLabel`: boolean; default `true`

Example:

```html
<!-- wp:categories /-->
```
<!-- generated:end -->

## core/code

<!-- generated:start -->
Code. Display code snippets that respect your spacing and tabs.

Attributes:

- `content`: rich-text; in the HTML `code`, not in the JSON

Example:

```html
<!-- wp:code -->
<pre class="wp-block-code"><code>// A “block” is the abstract term used
// to describe units of markup that
// when composed together, form the
// content or layout of a page.
registerBlockType( name, settings );</code></pre>
<!-- /wp:code -->
```
<!-- generated:end -->

Common mistakes:

- The code goes in `<pre class="wp-block-code"><code>…</code></pre>`. Escape `<`, `>`, and `&` in the code as `&lt;`, `&gt;`, and `&amp;`.

## core/column

<!-- generated:start -->
Column. A single column within a columns block.

Only directly inside `core/columns`.

Attributes:

- `verticalAlignment`: string
- `width`: string
- `templateLock`: string | boolean; one of `"all"`, `"insert"`, `"contentOnly"`, `false`

See the example of `core/columns`.
<!-- generated:end -->

## core/columns

<!-- generated:start -->
Columns. Display content in multiple columns, with blocks added to each column.

Takes only `core/column` as inner blocks.

Attributes:

- `verticalAlignment`: string
- `isStackedOnMobile`: boolean; default `true`
- `templateLock`: string | boolean; one of `"all"`, `"insert"`, `"contentOnly"`, `false`

Example:

```html
<!-- wp:columns -->
<div class="wp-block-columns"><!-- wp:column -->
<div class="wp-block-column"><!-- wp:paragraph -->
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent et eros eu felis.</p>
<!-- /wp:paragraph -->

<!-- wp:image -->
<figure class="wp-block-image"><img src="https://s.w.org/images/core/5.3/Windbuchencom.jpg" alt=""/></figure>
<!-- /wp:image -->

<!-- wp:paragraph -->
<p>Suspendisse commodo neque lacus, a dictum orci interdum et.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column"><!-- wp:paragraph -->
<p>Etiam et egestas lorem. Vivamus sagittis sit amet dolor quis lobortis. Integer sed fermentum arcu, id vulputate lacus. Etiam fermentum sem eu quam hendrerit.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Nam risus massa, ullamcorper consectetur eros fermentum, porta aliquet ligula. Sed vel mauris nec enim.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->
```
<!-- generated:end -->

Common mistakes:

- Takes only `core/column` blocks. Content goes in the columns, not straight in `core/columns`.
- A column width is `{"width":"33.33%"}` with `style="flex-basis:33.33%"` on the column's `<div>`.

## core/comment-author-name

<!-- generated:start -->
Comment Author Name. Displays the name of the author of the comment.

Only somewhere inside `core/comment-template`.

Attributes:

- `isLink`: boolean; default `true`
- `linkTarget`: string; default `"_self"`

Example:

```html
<!-- wp:comment-author-name /-->
```
<!-- generated:end -->

## core/comment-content

<!-- generated:start -->
Comment Content. Displays the contents of a comment.

Only somewhere inside `core/comment-template`.

No attributes of its own.

Example:

```html
<!-- wp:comment-content /-->
```
<!-- generated:end -->

## core/comment-date

<!-- generated:start -->
Comment Date. Displays the date on which the comment was posted.

Only somewhere inside `core/comment-template`.

Attributes:

- `format`: string
- `isLink`: boolean; default `true`

Example:

```html
<!-- wp:comment-date /-->
```
<!-- generated:end -->

## core/comment-edit-link

<!-- generated:start -->
Comment Edit Link. Displays a link to edit the comment in the WordPress Dashboard. This link is only visible to users with the edit comment capability.

Only somewhere inside `core/comment-template`.

Attributes:

- `linkTarget`: string; default `"_self"`

Example:

```html
<!-- wp:comment-edit-link /-->
```
<!-- generated:end -->

## core/comment-reply-link

<!-- generated:start -->
Comment Reply Link. Displays a link to reply to a comment.

Only somewhere inside `core/comment-template`.

No attributes of its own.

Example:

```html
<!-- wp:comment-reply-link /-->
```
<!-- generated:end -->

## core/comment-template

<!-- generated:start -->
Comment Template. Contains the block elements used to display a comment, like the title, date, author, avatar and more.

Only directly inside `core/comments`.

No attributes of its own.

Example:

```html
<!-- wp:comment-template /-->
```
<!-- generated:end -->

## core/comments

<!-- generated:start -->
Comments. An advanced block that allows displaying post comments using different visual configurations.

Attributes:

- `tagName`: string; default `"div"`
- `legacy`: boolean; default `false`

Example:

```html
<!-- wp:comments -->
<div class="wp-block-comments"></div>
<!-- /wp:comments -->
```
<!-- generated:end -->

## core/comments-pagination

<!-- generated:start -->
Comments Pagination. Displays a paginated navigation to next/previous set of comments, when applicable.

Only directly inside `core/comments`.

Takes only `core/comments-pagination-previous`, `core/comments-pagination-numbers`, `core/comments-pagination-next` as inner blocks.

Attributes:

- `paginationArrow`: string; default `"none"`

Example:

```html
<!-- wp:comments-pagination /-->
```
<!-- generated:end -->

## core/comments-pagination-next

<!-- generated:start -->
Comments Next Page. Displays the next comment's page link.

Only directly inside `core/comments-pagination`.

Attributes:

- `label`: string

Example:

```html
<!-- wp:comments-pagination-next {"label":"Newer Comments"} /-->
```
<!-- generated:end -->

## core/comments-pagination-numbers

<!-- generated:start -->
Comments Page Numbers. Displays a list of page numbers for comments pagination.

Only directly inside `core/comments-pagination`.

No attributes of its own.

Example:

```html
<!-- wp:comments-pagination-numbers /-->
```
<!-- generated:end -->

## core/comments-pagination-previous

<!-- generated:start -->
Comments Previous Page. Displays the previous comment's page link.

Only directly inside `core/comments-pagination`.

Attributes:

- `label`: string

Example:

```html
<!-- wp:comments-pagination-previous {"label":"Older Comments"} /-->
```
<!-- generated:end -->

## core/comments-title

<!-- generated:start -->
Comments Title. Displays a title with the number of comments.

Only somewhere inside `core/comments`.

Attributes:

- `showPostTitle`: boolean; default `true`
- `showCommentsCount`: boolean; default `true`
- `level`: number; default `2`
- `levelOptions`: array

Example:

```html
<!-- wp:comments-title /-->
```
<!-- generated:end -->

## core/cover

<!-- generated:start -->
Cover. Add an image or video with a text overlay.

Attributes:

- `url`: string
- `useFeaturedImage`: boolean; default `false`
- `id`: number
- `alt`: string; default `""`
- `hasParallax`: boolean; default `false`
- `isRepeated`: boolean; default `false`
- `dimRatio`: number; default `100`
- `overlayColor`: string
- `customOverlayColor`: string
- `isUserOverlayColor`: boolean
- `backgroundType`: string; default `"image"`
- `focalPoint`: object
- `minHeight`: number
- `minHeightUnit`: string
- `gradient`: string
- `customGradient`: string
- `contentPosition`: string
- `isDark`: boolean; default `true`
- `templateLock`: string | boolean; one of `"all"`, `"insert"`, `"contentOnly"`, `false`
- `tagName`: string; default `"div"`
- `sizeSlug`: string
- `poster`: string; in the HTML `video` `poster`, not in the JSON
- `allowedVideoProviders`: array; default `["youtube","vimeo","videopress","animoto","tiktok","wordpress-tv"]`

Example:

```html
<!-- wp:cover {"url":"https://s.w.org/images/core/5.3/Windbuchencom.jpg","dimRatio":40,"customOverlayColor":"#065174","style":{"typography":{"fontSize":48},"color":{"text":"white"}}} -->
<div class="wp-block-cover has-text-color" style="color:white;font-size:48px"><img class="wp-block-cover__image-background" alt="" src="https://s.w.org/images/core/5.3/Windbuchencom.jpg" data-object-fit="cover"/><span aria-hidden="true" class="wp-block-cover__background has-background-dim-40 has-background-dim" style="background-color:#065174"></span><div class="wp-block-cover__inner-container"><!-- wp:paragraph {"style":{"typography":{"textAlign":"center"}}} -->
<p class="has-text-align-center"><strong>Snow Patrol</strong></p>
<!-- /wp:paragraph --></div></div>
<!-- /wp:cover -->
```
<!-- generated:end -->

## core/details

<!-- generated:start -->
Details. Hide and show additional content.

Attributes:

- `showContent`: boolean; default `false`
- `summary`: rich-text; in the HTML `summary`, not in the JSON
- `name`: string; in the HTML `.wp-block-details` `name`, not in the JSON
- `placeholder`: string

Example:

```html
<!-- wp:details {"showContent":true} -->
<details class="wp-block-details" open><summary>La Mancha</summary><!-- wp:paragraph -->
<p>In a village of La Mancha, the name of which I have no desire to call to mind, there lived not long since one of those gentlemen that keep a lance in the lance-rack, an old buckler, a lean hack, and a greyhound for coursing.</p>
<!-- /wp:paragraph --></details>
<!-- /wp:details -->
```
<!-- generated:end -->

## core/embed

<!-- generated:start -->
Embed. Add a block that displays content pulled from other sites, like Twitter or YouTube.

Attributes:

- `url`: string
- `caption`: rich-text; in the HTML `figcaption`, not in the JSON
- `type`: string
- `providerNameSlug`: string
- `allowResponsive`: boolean; default `true`
- `responsive`: boolean; default `false`
- `previewable`: boolean; default `true`

Example:

```html
<!-- wp:embed /-->
```
<!-- generated:end -->

## core/file

<!-- generated:start -->
File. Add a link to a downloadable file.

Attributes:

- `id`: number
- `href`: string
- `fileId`: string; in the HTML `a:not([download])` `id`, not in the JSON
- `fileName`: rich-text; in the HTML `a:not([download])`, not in the JSON
- `textLinkHref`: string; in the HTML `a:not([download])` `href`, not in the JSON
- `textLinkTarget`: string; in the HTML `a:not([download])` `target`, not in the JSON
- `showDownloadButton`: boolean; default `true`
- `downloadButtonText`: rich-text; in the HTML `a[download]`, not in the JSON
- `displayPreview`: boolean
- `previewHeight`: number; default `600`

Example:

```html
<!-- wp:file {"href":"https://upload.wikimedia.org/wikipedia/commons/d/dd/Armstrong_Small_Step.ogg"} -->
<div class="wp-block-file"><a>Armstrong_Small_Step</a><a href="https://upload.wikimedia.org/wikipedia/commons/d/dd/Armstrong_Small_Step.ogg" class="wp-block-file__button wp-element-button" download></a></div>
<!-- /wp:file -->
```
<!-- generated:end -->

## core/gallery

<!-- generated:start -->
Gallery. Display multiple images in a rich gallery.

Takes only `core/image` as inner blocks.

Attributes:

- `images`: array; in the HTML `.blocks-gallery-item`, not in the JSON; default `[]`
- `ids`: array; default `[]`
- `dynamicContent`: object
- `navigationButtonType`: string; one of `"icon"`, `"text"`, `"both"`; default `"icon"`
- `shortCodeTransforms`: array; default `[]`
- `columns`: number
- `caption`: rich-text; in the HTML `.blocks-gallery-caption`, not in the JSON
- `imageCrop`: boolean; default `true`
- `randomOrder`: boolean; default `false`
- `fixedHeight`: boolean; default `true`
- `linkTarget`: string
- `linkTo`: string
- `sizeSlug`: string; default `"large"`
- `allowResize`: boolean; default `false`
- `aspectRatio`: string; default `"auto"`

Example:

```html
<!-- wp:gallery {"columns":2} -->
<figure class="wp-block-gallery has-nested-images columns-2 is-cropped"><!-- wp:image -->
<figure class="wp-block-image"><img src="https://s.w.org/images/core/5.3/Glacial_lakes%2C_Bhutan.jpg" alt=""/></figure>
<!-- /wp:image -->

<!-- wp:image -->
<figure class="wp-block-image"><img src="https://s.w.org/images/core/5.3/Sediment_off_the_Yucatan_Peninsula.jpg" alt=""/></figure>
<!-- /wp:image --></figure>
<!-- /wp:gallery -->
```
<!-- generated:end -->

## core/group

<!-- generated:start -->
Group. Gather blocks in a layout container.

Attributes:

- `tagName`: string; default `"div"`
- `templateLock`: string | boolean; one of `"all"`, `"insert"`, `"contentOnly"`, `false`

Example:

```html
<!-- wp:group {"style":{"spacing":{"padding":{"top":"4em","right":"3em","bottom":"4em","left":"3em"}}},"layout":{"type":"constrained","justifyContent":"center"}} -->
<div class="wp-block-group" style="padding-top:4em;padding-right:3em;padding-bottom:4em;padding-left:3em"><!-- wp:heading {"style":{"typography":{"textAlign":"center"}}} -->
<h2 class="wp-block-heading has-text-align-center">La Mancha</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"style":{"typography":{"textAlign":"center"}}} -->
<p class="has-text-align-center">In a village of La Mancha, the name of which I have no desire to call to mind, there lived not long since one of those gentlemen that keep a lance in the lance-rack, an old buckler, a lean hack, and a greyhound for coursing.</p>
<!-- /wp:paragraph -->

<!-- wp:spacer {"height":"10px"} -->
<div style="height:10px" aria-hidden="true" class="wp-block-spacer"></div>
<!-- /wp:spacer --></div>
<!-- /wp:group -->
```
<!-- generated:end -->

Common mistakes:

- The layout lives in the JSON only, such as `{"layout":{"type":"constrained"}}` or `{"layout":{"type":"flex","flexWrap":"nowrap"}}`. Do not add layout classes such as `is-layout-flex` to the HTML: the server adds them.
- A group with `tagName` other than `div` uses that tag: `{"tagName":"section"}` with `<section class="wp-block-group">`.

## core/heading

<!-- generated:start -->
Heading. Introduce new sections and organize content to help visitors (and search engines) understand the structure of your content.

Attributes:

- `content`: rich-text; in the HTML `h1,h2,h3,h4,h5,h6`, not in the JSON
- `level`: number; default `2`
- `levelOptions`: array
- `placeholder`: string

Example:

```html
<!-- wp:heading {"style":{"typography":{"textAlign":"center"}}} -->
<h2 class="wp-block-heading has-text-align-center">Code is Poetry</h2>
<!-- /wp:heading -->
```
<!-- generated:end -->

Common mistakes:

- The tag follows `level`: `{"level":3}` with `<h3>`. Level 2 leaves `level` out.
- Keep `class="wp-block-heading"` on the tag.

## core/home-link

<!-- generated:start -->
Home Link. Create a link that always points to the homepage of the site. Usually not necessary if there is already a site title link present in the header.

Only directly inside `core/navigation`.

Attributes:

- `label`: string
- `opensInNewTab`: boolean; default `false`
- `description`: string

Example:

```html
<!-- wp:home-link {"label":"Home Link"} /-->
```
<!-- generated:end -->

## core/icon

<!-- generated:start -->
Icon. Insert an SVG icon.

Attributes:

- `icon`: string
- `flipHorizontal`: boolean; default `false`
- `flipVertical`: boolean; default `false`
- `rotation`: number; default `0`

Example:

```html
<!-- wp:icon {"icon":"core/info","style":{"dimensions":{"width":"48px"}}} /-->
```
<!-- generated:end -->

## core/image

<!-- generated:start -->
Image. Insert an image to make a visual statement.

Attributes:

- `url`: string; in the HTML `img` `src`, not in the JSON
- `alt`: string; in the HTML `img` `alt`, not in the JSON; default `""`
- `caption`: rich-text; in the HTML `figcaption`, not in the JSON
- `lightbox`: object
- `title`: string; in the HTML `img` `title`, not in the JSON
- `href`: string; in the HTML `figure > a` `href`, not in the JSON
- `rel`: string; in the HTML `figure > a` `rel`, not in the JSON
- `linkClass`: string; in the HTML `figure > a` `class`, not in the JSON
- `id`: number
- `width`: string
- `height`: string
- `aspectRatio`: string
- `scale`: string
- `focalPoint`: object
- `sizeSlug`: string
- `linkDestination`: string
- `linkTarget`: string; in the HTML `figure > a` `target`, not in the JSON
- `isDecorative`: boolean; default `false`

Example:

```html
<!-- wp:image {"sizeSlug":"large"} -->
<figure class="wp-block-image size-large"><img src="https://s.w.org/images/core/5.3/MtBlanc1.jpg" alt=""/><figcaption class="wp-element-caption">Mont Blanc appears—still, snowy, and serene.</figcaption></figure>
<!-- /wp:image -->
```
<!-- generated:end -->

Common mistakes:

- `src`, `alt`, `href`, and the caption live in the HTML only. `id`, `sizeSlug`, and `linkDestination` go in the JSON.
- `{"id":12}` goes with `class="wp-image-12"` on the `<img>`, and `{"sizeSlug":"large"}` with `size-large` on the `<figure>`.
- A link wraps the `<img>`: `<figure class="wp-block-image"><a href="…"><img …/></a></figure>`, with `"linkDestination":"custom"` in the JSON.
- The caption is `<figcaption class="wp-element-caption">` after the image, inside the `<figure>`.
- Write `<img …/>` with a closing slash, as the editor saves it.

## core/latest-comments

<!-- generated:start -->
Latest Comments. Display a list of your most recent comments.

Attributes:

- `commentsToShow`: number; default `5`
- `displayAvatar`: boolean; default `true`
- `displayDate`: boolean; default `true`
- `displayContent`: string; one of `"none"`, `"excerpt"`, `"full"`; default `"excerpt"`

Example:

```html
<!-- wp:latest-comments /-->
```
<!-- generated:end -->

## core/latest-posts

<!-- generated:start -->
Latest Posts. Display a list of your most recent posts.

Attributes:

- `categories`: array
- `selectedAuthor`: number
- `postsToShow`: number; default `5`
- `displayPostContent`: boolean; default `false`
- `displayPostContentRadio`: string; default `"excerpt"`
- `excerptLength`: number; default `55`
- `displayAuthor`: boolean; default `false`
- `displayPostDate`: boolean; default `false`
- `order`: string; default `"desc"`
- `orderBy`: string; default `"date"`
- `displayFeaturedImage`: boolean; default `false`
- `featuredImageAlign`: string; one of `"left"`, `"center"`, `"right"`
- `featuredImageSizeSlug`: string; default `"thumbnail"`
- `featuredImageSizeWidth`: number; default `null`
- `featuredImageSizeHeight`: number; default `null`
- `addLinkToFeaturedImage`: boolean; default `false`

Example:

```html
<!-- wp:latest-posts /-->
```
<!-- generated:end -->

## core/list

<!-- generated:start -->
List. An organized collection of items displayed in a specific order.

Takes only `core/list-item` as inner blocks.

Attributes:

- `ordered`: boolean; default `false`
- `values`: string; in the HTML `ol,ul`, not in the JSON; default `""`
- `type`: string
- `start`: number
- `reversed`: boolean
- `placeholder`: string

Example:

```html
<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>Alice.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>The White Rabbit.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>The Cheshire Cat.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>The Mad Hatter.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>The Queen of Hearts.</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->
```
<!-- generated:end -->

Common mistakes:

- An ordered list is `{"ordered":true}` with `<ol class="wp-block-list">`. A bulleted list leaves `ordered` out and uses `<ul>`.
- Each `<li>` is its own `core/list-item` block. Do not write bare `<li>` elements.
- Keep `class="wp-block-list"` on the `<ul>` or `<ol>`.

## core/list-item

<!-- generated:start -->
List Item. An individual item within a list.

Only directly inside `core/list`.

Takes only `core/list` as inner blocks.

Attributes:

- `placeholder`: string
- `content`: rich-text; in the HTML `li`, not in the JSON

See the example of `core/list`.
<!-- generated:end -->

Common mistakes:

- A nested list goes inside the `<li>`, after its text, as a `core/list` block:

```html
<!-- wp:list-item -->
<li>One<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>Sub</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list --></li>
<!-- /wp:list-item -->
```

## core/loginout

<!-- generated:start -->
Login/out. Show login & logout links.

Attributes:

- `displayLoginAsForm`: boolean; default `false`
- `redirectToCurrent`: boolean; default `true`

Example:

```html
<!-- wp:loginout /-->
```
<!-- generated:end -->

## core/math

<!-- generated:start -->
Math. Display mathematical notation using LaTeX.

Attributes:

- `latex`: string; in the HTML `math annotation[encoding="application/x-tex"]`, not in the JSON
- `mathML`: string; in the HTML `math`, not in the JSON

Example:

```html
<!-- wp:math -->
<div class="wp-block-math"><math display="block"><semantics><mrow><mi>x</mi><mo>=</mo><mfrac><mrow><mo lspace="0em" rspace="0em">−</mo><mi>b</mi><mo>±</mo><msqrt><mrow><msup><mi>b</mi><mn>2</mn></msup><mo>−</mo><mn>4</mn><mi>a</mi><mi>c</mi></mrow></msqrt></mrow><mrow><mn>2</mn><mi>a</mi></mrow></mfrac></mrow><annotation encoding="application/x-tex">x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}</annotation></semantics></math></div>
<!-- /wp:math -->
```
<!-- generated:end -->

## core/media-text

<!-- generated:start -->
Media & Text. Set media and words side-by-side for a richer layout.

Attributes:

- `align`: string; default `"none"`
- `mediaAlt`: string; in the HTML `figure img` `alt`, not in the JSON; default `""`
- `mediaPosition`: string; default `"left"`
- `mediaId`: number
- `mediaUrl`: string; in the HTML `figure video,figure img` `src`, not in the JSON
- `mediaLink`: string
- `linkDestination`: string
- `linkTarget`: string; in the HTML `figure a` `target`, not in the JSON
- `href`: string; in the HTML `figure a` `href`, not in the JSON
- `rel`: string; in the HTML `figure a` `rel`, not in the JSON
- `linkClass`: string; in the HTML `figure a` `class`, not in the JSON
- `mediaType`: string
- `mediaWidth`: number; default `50`
- `mediaSizeSlug`: string
- `isStackedOnMobile`: boolean; default `true`
- `verticalAlignment`: string
- `imageFill`: boolean
- `focalPoint`: object
- `useFeaturedImage`: boolean; default `false`

Example:

```html
<!-- wp:media-text {"mediaType":"image"} -->
<div class="wp-block-media-text is-stacked-on-mobile"><figure class="wp-block-media-text__media"><img src="https://s.w.org/images/core/5.3/Biologia_Centrali-Americana_-_Cantorchilus_semibadius_1902.jpg" alt=""/></figure><div class="wp-block-media-text__content"><!-- wp:paragraph -->
<p>The wren<br>Earns his living<br>Noiselessly.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>— Kobayashi Issa (一茶)</p>
<!-- /wp:paragraph --></div></div>
<!-- /wp:media-text -->
```
<!-- generated:end -->

## core/more

<!-- generated:start -->
More. Content before this block is shown in the excerpt on blog and archive pages. Where a theme shows the full content instead, visitors get a “Read more” link to the rest of the post.

Attributes:

- `customText`: string; default `""`
- `noTeaser`: boolean; default `false`

Example:

```html
<!-- wp:more -->
<!--more-->
<!-- /wp:more -->
```
<!-- generated:end -->

## core/navigation

<!-- generated:start -->
Navigation. A collection of blocks that allow visitors to get around your site.

Takes only `core/navigation-link`, `core/search`, `core/social-links`, `core/page-list`, `core/spacer`, `core/home-link`, `core/icon`, `core/site-title`, `core/site-logo`, `core/navigation-submenu`, `core/loginout`, `core/buttons` as inner blocks.

Attributes:

- `ref`: number
- `textColor`: string
- `customTextColor`: string
- `rgbTextColor`: string
- `backgroundColor`: string
- `customBackgroundColor`: string
- `rgbBackgroundColor`: string
- `showSubmenuIcon`: boolean; default `true`
- `submenuVisibility`: string; one of `"hover"`, `"click"`, `"always"`; default `"hover"`
- `overlayMenu`: string; default `"mobile"`
- `overlay`: string
- `icon`: string; default `"handle"`
- `hasIcon`: boolean; default `true`
- `__unstableLocation`: string
- `overlayBackgroundColor`: string
- `customOverlayBackgroundColor`: string
- `overlayTextColor`: string
- `customOverlayTextColor`: string
- `maxNestingLevel`: number; default `5`
- `templateLock`: string | boolean; one of `"all"`, `"insert"`, `"contentOnly"`, `false`

Example:

```html
<!-- wp:navigation {"overlayMenu":"never"} -->
<!-- wp:navigation-link {"label":"Home","url":"https://make.wordpress.org/"} /-->

<!-- wp:navigation-link {"label":"About","url":"https://make.wordpress.org/"} /-->

<!-- wp:navigation-link {"label":"Contact","url":"https://make.wordpress.org/"} /-->
<!-- /wp:navigation -->
```
<!-- generated:end -->

## core/navigation-link

<!-- generated:start -->
Navigation Link. Add a page, link, or another item to your navigation.

Only directly inside `core/navigation`.

Takes only `core/navigation-link`, `core/navigation-submenu`, `core/page-list` as inner blocks.

Attributes:

- `label`: string
- `type`: string
- `description`: string
- `rel`: string
- `id`: number
- `opensInNewTab`: boolean; default `false`
- `url`: string
- `title`: string
- `kind`: string
- `isTopLevelLink`: boolean

Example:

```html
<!-- wp:navigation-link {"label":"Example Link","url":"https://example.com"} /-->
```
<!-- generated:end -->

## core/navigation-overlay-close

<!-- generated:start -->
Navigation Overlay Close. A customizable button to close overlays.

Attributes:

- `displayMode`: string; one of `"icon"`, `"text"`, `"both"`; default `"icon"`
- `text`: string

Example:

```html
<!-- wp:navigation-overlay-close /-->
```
<!-- generated:end -->

## core/navigation-submenu

<!-- generated:start -->
Submenu. Add a submenu to your navigation.

Only directly inside `core/navigation`.

Attributes:

- `label`: string
- `type`: string
- `description`: string
- `rel`: string
- `id`: number
- `opensInNewTab`: boolean; default `false`
- `url`: string
- `title`: string
- `kind`: string
- `isTopLevelItem`: boolean
- `isParentSubmenu`: boolean; default `true`

Example:

```html
<!-- wp:navigation-submenu {"label":"About","type":"page"} /-->
```
<!-- generated:end -->

## core/nextpage

<!-- generated:start -->
Page Break. Separate your content into a multi-page experience.

Only directly inside `core/post-content`.

No attributes of its own.

Example:

```html
<!-- wp:nextpage -->
<!--nextpage-->
<!-- /wp:nextpage -->
```
<!-- generated:end -->

## core/page-list

<!-- generated:start -->
Page List. Display a list of all pages.

Takes only `core/page-list-item` as inner blocks.

Attributes:

- `parentPageID`: integer; default `0`

Example:

```html
<!-- wp:page-list /-->
```
<!-- generated:end -->

## core/paragraph

<!-- generated:start -->
Paragraph. Start with the basic building block of all narrative.

Attributes:

- `content`: rich-text; in the HTML `p`, not in the JSON
- `dropCap`: boolean; default `false`
- `placeholder`: string
- `direction`: string; one of `"ltr"`, `"rtl"`

Example:

```html
<!-- wp:paragraph -->
<p>In a village of La Mancha, the name of which I have no desire to call to mind, there lived not long since one of those gentlemen that keep a lance in the lance-rack, an old buckler, a lean hack, and a greyhound for coursing.</p>
<!-- /wp:paragraph -->
```
<!-- generated:end -->

Common mistakes:

- A paragraph saves a bare `<p>`. Do not add `wp-block-paragraph` or other classes that no attribute explains.
- `{"dropCap":true}` goes with `class="has-drop-cap"` on the `<p>`.
- A line break inside a paragraph is `<br>`. A new paragraph is a new `core/paragraph` block.

## core/playlist

<!-- generated:start -->
Playlist. Embed a simple playlist.

Takes only `core/playlist-track` as inner blocks.

Attributes:

- `type`: string; default `"audio"`
- `order`: string; default `"asc"`
- `showTracklist`: boolean; default `true`
- `showImages`: boolean; default `true`
- `showPlayButtonArtwork`: boolean; default `false`
- `showArtists`: boolean; default `true`
- `showNumbers`: boolean; default `true`
- `showTrackLength`: boolean; default `true`
- `waveformStyle`: string; one of `"bars"`, `"mirror"`, `"line"`, `"blocks"`, `"dots"`, `"seekbar"`; default `"bars"`
- `waveformColor`: string
- `waveformGradient`: string
- `waveformBackgroundColor`: string
- `waveformBackgroundGradient`: string
- `caption`: string

Example:

```html
<!-- wp:playlist -->
<figure class="wp-block-playlist"><ol class="wp-block-playlist__tracklist wp-block-playlist__tracklist-show-numbers"></ol></figure>
<!-- /wp:playlist -->
```
<!-- generated:end -->

## core/playlist-track

<!-- generated:start -->
Playlist track. Playlist track.

Only directly inside `core/playlist`.

Attributes:

- `id`: number
- `src`: string
- `type`: string; default `"audio"`
- `album`: string
- `artist`: string
- `image`: string
- `imageAlt`: string
- `length`: string
- `title`: string

Example:

```html
<!-- wp:playlist-track /-->
```
<!-- generated:end -->

## core/post-author-biography

<!-- generated:start -->
Author Biography. The author biography.

No attributes of its own.

Example:

```html
<!-- wp:post-author-biography /-->
```
<!-- generated:end -->

## core/post-author-name

<!-- generated:start -->
Author Name. The author name.

Attributes:

- `isLink`: boolean; default `false`
- `linkTarget`: string; default `"_self"`

Example:

```html
<!-- wp:post-author-name /-->
```
<!-- generated:end -->

## core/post-comments-count

<!-- generated:start -->
Comments Count. Display a post's comments count.

No attributes of its own.

Example:

```html
<!-- wp:post-comments-count /-->
```
<!-- generated:end -->

## core/post-comments-form

<!-- generated:start -->
Comments Form. Display a post's comments form.

No attributes of its own.

Example:

```html
<!-- wp:post-comments-form {"style":{"typography":{"textAlign":"center"}}} /-->
```
<!-- generated:end -->

## core/post-comments-link

<!-- generated:start -->
Comments Link. Displays the link to the current post comments.

No attributes of its own.

Example:

```html
<!-- wp:post-comments-link /-->
```
<!-- generated:end -->

## core/post-content

<!-- generated:start -->
Content. Displays the contents of a post or page.

Attributes:

- `tagName`: string; default `"div"`

Example:

```html
<!-- wp:post-content /-->
```
<!-- generated:end -->

## core/post-date

<!-- generated:start -->
Date. Display a custom date.

Attributes:

- `datetime`: string
- `format`: string
- `isLink`: boolean; default `false`

Example:

```html
<!-- wp:post-date {"metadata":{"bindings":{"datetime":{"source":"core/post-data","args":{"field":"date"}}}}} /-->
```
<!-- generated:end -->

## core/post-excerpt

<!-- generated:start -->
Excerpt. Display the excerpt.

Attributes:

- `moreText`: string
- `showMoreOnNewLine`: boolean; default `true`
- `excerptLength`: number; default `55`

Example:

```html
<!-- wp:post-excerpt /-->
```
<!-- generated:end -->

## core/post-featured-image

<!-- generated:start -->
Featured Image. Display a post's featured image.

Attributes:

- `isLink`: boolean; default `false`
- `aspectRatio`: string
- `width`: string
- `height`: string
- `scale`: string; default `"cover"`
- `sizeSlug`: string
- `rel`: string; default `""`
- `linkTarget`: string; default `"_self"`
- `overlayColor`: string
- `customOverlayColor`: string
- `dimRatio`: number; default `0`
- `gradient`: string
- `customGradient`: string
- `useFirstImageFromPost`: boolean; default `false`

Example:

```html
<!-- wp:post-featured-image /-->
```
<!-- generated:end -->

## core/post-navigation-link

<!-- generated:start -->
Post Navigation Link. Displays the next or previous post link that is adjacent to the current post.

Attributes:

- `type`: string; default `"next"`
- `label`: string
- `showTitle`: boolean; default `false`
- `linkLabel`: boolean; default `false`
- `arrow`: string; default `"none"`
- `taxonomy`: string; default `""`

Example:

```html
<!-- wp:post-navigation-link {"label":"Next post","arrow":"arrow"} /-->
```
<!-- generated:end -->

## core/post-template

<!-- generated:start -->
Post Template. Contains the block elements used to render a post, like the title, date, featured image, content or excerpt, and more.

Only somewhere inside `core/query`.

No attributes of its own.

See the example of `core/query`.
<!-- generated:end -->

## core/post-terms

<!-- generated:start -->
Post Terms. Post terms.

Attributes:

- `term`: string
- `separator`: string; default `", "`
- `prefix`: string; default `""`
- `suffix`: string; default `""`

Example:

```html
<!-- wp:post-terms /-->
```
<!-- generated:end -->

## core/post-time-to-read

<!-- generated:start -->
Time to Read. Show minutes required to finish reading the post. Can also show a word count.

Attributes:

- `displayAsRange`: boolean; default `true`
- `displayMode`: string; default `"time"`
- `averageReadingSpeed`: number; default `189`

Example:

```html
<!-- wp:post-time-to-read /-->
```
<!-- generated:end -->

## core/post-title

<!-- generated:start -->
Title. Displays the title of a post, page, or any other content-type.

Attributes:

- `level`: number; default `2`
- `levelOptions`: array
- `isLink`: boolean; default `false`
- `rel`: string; default `""`
- `linkTarget`: string; default `"_self"`
- `placeholder`: string

Example:

```html
<!-- wp:post-title /-->
```
<!-- generated:end -->

## core/preformatted

<!-- generated:start -->
Preformatted. Add text that respects your spacing and tabs, and also allows styling.

Attributes:

- `content`: rich-text; in the HTML `pre`, not in the JSON

Example:

```html
<!-- wp:preformatted -->
<pre class="wp-block-preformatted">EXT. XANADU - FAINT DAWN - 1940 (MINIATURE)<br>Window, very small in the distance, illuminated.<br>All around this is an almost totally black screen. Now, as the camera moves slowly towards the window which is almost a postage stamp in the frame, other forms appear;</pre>
<!-- /wp:preformatted -->
```
<!-- generated:end -->

## core/pullquote

<!-- generated:start -->
Pullquote. Give special visual emphasis to a quote from your text.

Attributes:

- `value`: rich-text; in the HTML `p`, not in the JSON
- `citation`: rich-text; in the HTML `cite`, not in the JSON

Example:

```html
<!-- wp:pullquote -->
<figure class="wp-block-pullquote"><blockquote><p>One of the hardest things to do in technology is disrupt yourself.</p><cite>Matt Mullenweg</cite></blockquote></figure>
<!-- /wp:pullquote -->
```
<!-- generated:end -->

## core/query

<!-- generated:start -->
Query Loop. An advanced block that allows displaying post types based on different query parameters and visual configurations.

Attributes:

- `queryId`: number
- `query`: object; default `{"perPage":null,"pages":0,"offset":0,"postType":"post","order":"desc","orderBy":"date","author":"","search":"","exclude":[],"sticky":"","inherit":true,"taxQuery":null,"parents":[],"format":[],"excludeCurrent":null}`
- `tagName`: string; default `"div"`
- `namespace`: string
- `enhancedPagination`: boolean; default `false`

Example:

```html
<!-- wp:query {"query":{"perPage":4,"pages":1,"offset":0,"postType":"post","order":"desc","orderBy":"date","author":"","search":"","sticky":"exclude","inherit":false,"excludeCurrent":null},"namespace":"core/posts-list"} -->
<div class="wp-block-query"><!-- wp:post-template {"layout":{"type":"grid","columnCount":2}} -->
<!-- wp:post-title /-->

<!-- wp:post-date {"metadata":{"bindings":{"datetime":{"source":"core/post-data","args":{"field":"date"}}}}} /-->

<!-- wp:post-excerpt /-->
<!-- /wp:post-template --></div>
<!-- /wp:query -->
```
<!-- generated:end -->

## core/query-no-results

<!-- generated:start -->
No Results. Contains the block elements used to render content when no query results are found.

Only somewhere inside `core/query`.

No attributes of its own.

Example:

```html
<!-- wp:query-no-results -->
<!-- wp:paragraph -->
<p>No posts were found.</p>
<!-- /wp:paragraph -->
<!-- /wp:query-no-results -->
```
<!-- generated:end -->

## core/query-pagination

<!-- generated:start -->
Pagination. Displays a paginated navigation to next/previous set of posts, when applicable.

Only somewhere inside `core/query`.

Takes only `core/query-pagination-previous`, `core/query-pagination-numbers`, `core/query-pagination-next` as inner blocks.

Attributes:

- `paginationArrow`: string; default `"none"`
- `showLabel`: boolean; default `true`

Example:

```html
<!-- wp:query-pagination /-->
```
<!-- generated:end -->

## core/query-pagination-next

<!-- generated:start -->
Next Page. Displays the next posts page link.

Only directly inside `core/query-pagination`.

Attributes:

- `label`: string

Example:

```html
<!-- wp:query-pagination-next /-->
```
<!-- generated:end -->

## core/query-pagination-numbers

<!-- generated:start -->
Page Numbers. Displays a list of page numbers for pagination.

Only directly inside `core/query-pagination`.

Attributes:

- `midSize`: number; default `2`

Example:

```html
<!-- wp:query-pagination-numbers /-->
```
<!-- generated:end -->

## core/query-pagination-previous

<!-- generated:start -->
Previous Page. Displays the previous posts page link.

Only directly inside `core/query-pagination`.

Attributes:

- `label`: string

Example:

```html
<!-- wp:query-pagination-previous /-->
```
<!-- generated:end -->

## core/query-title

<!-- generated:start -->
Query Title. Display the query title.

Attributes:

- `type`: string
- `level`: number; default `1`
- `levelOptions`: array
- `showPrefix`: boolean; default `true`
- `showSearchTerm`: boolean; default `true`

Example:

```html
<!-- wp:query-title {"type":"search"} /-->
```
<!-- generated:end -->

## core/query-total

<!-- generated:start -->
Query Total. Display the total number of results in a query.

Only somewhere inside `core/query`.

Attributes:

- `displayType`: string; default `"total-results"`

Example:

```html
<!-- wp:query-total /-->
```
<!-- generated:end -->

## core/quote

<!-- generated:start -->
Quote. Give quoted text visual emphasis. "In quoting others, we cite ourselves." — Julio Cortázar

Attributes:

- `value`: string; in the HTML `blockquote`, not in the JSON; default `""`
- `citation`: rich-text; in the HTML `cite`, not in the JSON
- `textAlign`: string

Example:

```html
<!-- wp:quote -->
<blockquote class="wp-block-quote"><!-- wp:paragraph -->
<p>In quoting others, we cite ourselves.</p>
<!-- /wp:paragraph --><cite>Julio Cortázar</cite></blockquote>
<!-- /wp:quote -->
```
<!-- generated:end -->

Common mistakes:

- The quoted text is inner blocks, usually paragraphs, not text straight in the `<blockquote>`.
- The citation is `<cite>` after the inner blocks, inside the `<blockquote>`.

## core/read-more

<!-- generated:start -->
Read More. Displays the link of a post, page, or any other content-type.

Attributes:

- `content`: string
- `linkTarget`: string; default `"_self"`

Example:

```html
<!-- wp:read-more {"content":"Read more"} /-->
```
<!-- generated:end -->

## core/rss

<!-- generated:start -->
RSS. Display entries from any RSS or Atom feed.

Attributes:

- `columns`: number; default `2`
- `blockLayout`: string; default `"list"`
- `feedURL`: string; default `""`
- `itemsToShow`: number; default `5`
- `displayExcerpt`: boolean; default `false`
- `displayAuthor`: boolean; default `false`
- `displayDate`: boolean; default `false`
- `excerptLength`: number; default `55`
- `openInNewTab`: boolean; default `false`
- `rel`: string

Example:

```html
<!-- wp:rss {"feedURL":"https://wordpress.org"} /-->
```
<!-- generated:end -->

## core/search

<!-- generated:start -->
Search. Help visitors find your content.

Attributes:

- `label`: string
- `showLabel`: boolean; default `true`
- `placeholder`: string; default `""`
- `width`: number
- `widthUnit`: string
- `buttonText`: string
- `buttonPosition`: string; default `"button-outside"`
- `buttonUseIcon`: boolean; default `false`
- `query`: object; default `{}`
- `tagName`: string; default `""`

Example:

```html
<!-- wp:search {"label":"Search","buttonText":"Search"} /-->
```
<!-- generated:end -->

## core/separator

<!-- generated:start -->
Separator. Create a break between ideas or sections with a horizontal separator.

Attributes:

- `opacity`: string; default `"alpha-channel"`
- `tagName`: string; one of `"hr"`, `"div"`; default `"hr"`

Example:

```html
<!-- wp:separator {"className":"is-style-wide"} -->
<hr class="wp-block-separator has-alpha-channel-opacity is-style-wide"/>
<!-- /wp:separator -->
```
<!-- generated:end -->

Common mistakes:

- Keep `has-alpha-channel-opacity` on the `<hr>` unless `opacity` is set to something else.
- Write `<hr …/>` with a closing slash, as the editor saves it.

## core/shortcode

<!-- generated:start -->
Shortcode. Insert additional custom elements with a WordPress shortcode.

Attributes:

- `text`: string; in the HTML, not in the JSON

Example:

```html
<!-- wp:shortcode /-->
```
<!-- generated:end -->

## core/site-logo

<!-- generated:start -->
Site Logo. Display an image to represent this site. Update this block and the changes apply everywhere.

Attributes:

- `width`: number
- `isLink`: boolean; default `true`
- `linkTarget`: string; default `"_self"`
- `shouldSyncIcon`: boolean

Example:

```html
<!-- wp:site-logo /-->
```
<!-- generated:end -->

## core/site-tagline

<!-- generated:start -->
Site Tagline. Describe in a few words what this site is about. This is important for search results, sharing on social media, and gives overall clarity to visitors.

Attributes:

- `level`: number; default `0`
- `levelOptions`: array; default `[0,1,2,3,4,5,6]`

Example:

```html
<!-- wp:site-tagline {"style":{"typography":{"textAlign":"center"}}} /-->
```
<!-- generated:end -->

## core/site-title

<!-- generated:start -->
Site Title. Displays the name of this site. Update the block, and the changes apply everywhere it’s used. This will also appear in the browser title bar and in search results.

Attributes:

- `level`: number; default `1`
- `levelOptions`: array; default `[0,1,2,3,4,5,6]`
- `isLink`: boolean; default `true`
- `linkTarget`: string; default `"_self"`

Example:

```html
<!-- wp:site-title {"style":{"typography":{"textAlign":"center"}}} /-->
```
<!-- generated:end -->

## core/social-link

<!-- generated:start -->
Social Icon. Display an icon linking to a social profile or site.

Only directly inside `core/social-links`.

Attributes:

- `url`: string
- `service`: string
- `label`: string
- `rel`: string

See the example of `core/social-links`.
<!-- generated:end -->

## core/social-links

<!-- generated:start -->
Social Icons. Display icons linking to your social profiles or sites.

Takes only `core/social-link` as inner blocks.

Attributes:

- `iconColor`: string
- `customIconColor`: string
- `iconColorValue`: string
- `iconBackgroundColor`: string
- `customIconBackgroundColor`: string
- `iconBackgroundColorValue`: string
- `openInNewTab`: boolean; default `false`
- `showLabels`: boolean; default `false`
- `size`: string

Example:

```html
<!-- wp:social-links -->
<ul class="wp-block-social-links"><!-- wp:social-link {"url":"https://wordpress.org","service":"wordpress"} /-->

<!-- wp:social-link {"url":"https://www.facebook.com/WordPress/","service":"facebook"} /-->

<!-- wp:social-link {"url":"https://twitter.com/WordPress","service":"twitter"} /--></ul>
<!-- /wp:social-links -->
```
<!-- generated:end -->

## core/spacer

<!-- generated:start -->
Spacer. Add white space between blocks and customize its height.

Attributes:

- `height`: string; default `"100px"`
- `width`: string

Example:

```html
<!-- wp:spacer -->
<div style="height:100px" aria-hidden="true" class="wp-block-spacer"></div>
<!-- /wp:spacer -->
```
<!-- generated:end -->

## core/tab-list

<!-- generated:start -->
Tab List. Display the tab buttons for a tabbed interface.

Only directly inside `core/tabs`.

Attributes:

- `tabs`: array; in the HTML `button`, not in the JSON; default `[]`

See the example of `core/tabs`.
<!-- generated:end -->

## core/tab-panel

<!-- generated:start -->
Tab Panel. Content for a tab in a tabbed interface.

Only directly inside `core/tab-panels`.

Attributes:

- `label`: string; default `""`

Example:

```html
<!-- wp:tab-panel -->
<section role="tabpanel" tabindex="0" class="wp-block-tab-panel"></section>
<!-- /wp:tab-panel -->
```
<!-- generated:end -->

## core/tab-panels

<!-- generated:start -->
Tab Panels. Container for tab panel content in a tabbed interface.

Only directly inside `core/tabs`.

Takes only `core/tab-panel` as inner blocks.

No attributes of its own.

See the example of `core/tabs`.
<!-- generated:end -->

## core/table

<!-- generated:start -->
Table. Create structured content in rows and columns to display information.

Attributes:

- `hasFixedLayout`: boolean; default `true`
- `caption`: rich-text; in the HTML `figcaption`, not in the JSON
- `head`: array; in the HTML `thead tr`, not in the JSON; default `[]`
- `body`: array; in the HTML `tbody tr`, not in the JSON; default `[]`
- `foot`: array; in the HTML `tfoot tr`, not in the JSON; default `[]`

Example:

```html
<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><thead><tr><th>Version</th><th>Jazz Musician</th><th>Release Date</th></tr></thead><tbody><tr><td>5.2</td><td>Jaco Pastorius</td><td>May 7, 2019</td></tr><tr><td>5.1</td><td>Betty Carter</td><td>February 21, 2019</td></tr><tr><td>5.0</td><td>Bebo Valdés</td><td>December 6, 2018</td></tr></tbody></table></figure>
<!-- /wp:table -->
```
<!-- generated:end -->

Common mistakes:

- The cells live in the HTML only. Do not write `head`, `body`, or `foot` in the JSON.
- Tables have a fixed layout by default: keep `class="has-fixed-layout"` on the `<table>`, or write `{"hasFixedLayout":false}` and leave the class out.
- The caption is `<figcaption class="wp-element-caption">` after the `<table>`, inside the `<figure>`.

## core/tabs

<!-- generated:start -->
Tabs. Display content in a tabbed interface to help users navigate detailed content with ease.

Takes only `core/tab-list`, `core/tab-panels` as inner blocks.

Attributes:

- `activeTabIndex`: number; default `0`

Example:

```html
<!-- wp:tabs -->
<div class="wp-block-tabs"><!-- wp:tab-list -->
<div role="tablist" class="wp-block-tab-list"><button type="button" role="tab">Tab 1</button><button type="button" role="tab">Tab 2</button></div>
<!-- /wp:tab-list -->

<!-- wp:tab-panels -->
<div class="wp-block-tab-panels"><!-- wp:tab-panel {"label":"Tab 1","anchor":"tab-1"} -->
<section role="tabpanel" tabindex="0" id="tab-1" class="wp-block-tab-panel"><!-- wp:paragraph -->
<p>In a village of La Mancha, the name of which I have no desire to call to mind, there lived not long since one of those gentlemen that keep a lance in the lance-rack, an old buckler, a lean hack, and a greyhound for coursing.</p>
<!-- /wp:paragraph --></section>
<!-- /wp:tab-panel -->

<!-- wp:tab-panel {"label":"Tab 2","anchor":"tab-2"} -->
<section role="tabpanel" tabindex="0" id="tab-2" class="wp-block-tab-panel"><!-- wp:paragraph -->
<p>In a village of La Mancha, the name of which I have no desire to call to mind, there lived not long since one of those gentlemen that keep a lance in the lance-rack, an old buckler, a lean hack, and a greyhound for coursing.</p>
<!-- /wp:paragraph --></section>
<!-- /wp:tab-panel --></div>
<!-- /wp:tab-panels --></div>
<!-- /wp:tabs -->
```
<!-- generated:end -->

## core/tag-cloud

<!-- generated:start -->
Tag Cloud. A cloud of popular keywords, each sized by how often it appears.

Attributes:

- `numberOfTags`: number; default `45`
- `taxonomy`: string; default `"post_tag"`
- `showTagCounts`: boolean; default `false`
- `smallestFontSize`: string; default `"8pt"`
- `largestFontSize`: string; default `"22pt"`

Example:

```html
<!-- wp:tag-cloud /-->
```
<!-- generated:end -->

## core/template-part

<!-- generated:start -->
Template Part. Edit the different global regions of your site, like the header, footer, sidebar, or create your own.

Attributes:

- `slug`: string
- `theme`: string
- `tagName`: string
- `area`: string

Example:

```html
<!-- wp:template-part /-->
```
<!-- generated:end -->

## core/term-count

<!-- generated:start -->
Term Count. Displays the post count of a taxonomy term.

Attributes:

- `bracketType`: string; one of `"none"`, `"round"`, `"square"`, `"curly"`, `"angle"`; default `"round"`

Example:

```html
<!-- wp:term-count /-->
```
<!-- generated:end -->

## core/term-description

<!-- generated:start -->
Term Description. Display the description of categories, tags and custom taxonomies when viewing an archive.

No attributes of its own.

Example:

```html
<!-- wp:term-description /-->
```
<!-- generated:end -->

## core/term-name

<!-- generated:start -->
Term Name. Displays the name of a taxonomy term.

Attributes:

- `level`: number; default `0`
- `isLink`: boolean; default `false`
- `levelOptions`: array

Example:

```html
<!-- wp:term-name /-->
```
<!-- generated:end -->

## core/term-template

<!-- generated:start -->
Term Template. Contains the block elements used to render a taxonomy term, like the name, description, and more.

Only somewhere inside `core/terms-query`.

No attributes of its own.

Example:

```html
<!-- wp:term-template /-->
```
<!-- generated:end -->

## core/terms-query

<!-- generated:start -->
Terms Query. An advanced block that allows displaying taxonomy terms based on different query parameters and visual configurations.

Attributes:

- `termQuery`: object; default `{"perPage":10,"taxonomy":"category","order":"asc","orderBy":"name","include":[],"hideEmpty":true,"showNested":false,"inherit":false}`
- `tagName`: string; default `"div"`

Example:

```html
<!-- wp:terms-query -->
<div class="wp-block-terms-query"></div>
<!-- /wp:terms-query -->
```
<!-- generated:end -->

## core/verse

<!-- generated:start -->
Poetry. Insert poetry. Use special spacing formats. Or quote song lyrics.

Attributes:

- `content`: rich-text; in the HTML `pre`, not in the JSON

Example:

```html
<!-- wp:verse -->
<pre class="wp-block-verse">WHAT was he doing, the great god Pan,<br>	Down in the reeds by the river?<br>Spreading ruin and scattering ban,<br>Splashing and paddling with hoofs of a goat,<br>And breaking the golden lilies afloat<br>    With the dragon-fly on the river.</pre>
<!-- /wp:verse -->
```
<!-- generated:end -->

## core/video

<!-- generated:start -->
Video. Embed a video from your media library or upload a new one.

Attributes:

- `autoplay`: boolean; in the HTML `video` `autoplay`, not in the JSON
- `caption`: rich-text; in the HTML `figcaption`, not in the JSON
- `controls`: boolean; in the HTML `video` `controls`, not in the JSON; default `true`
- `id`: number
- `loop`: boolean; in the HTML `video` `loop`, not in the JSON
- `muted`: boolean; in the HTML `video` `muted`, not in the JSON
- `poster`: string; in the HTML `video` `poster`, not in the JSON
- `preload`: string; in the HTML `video` `preload`, not in the JSON; default `"metadata"`
- `src`: string; in the HTML `video` `src`, not in the JSON
- `width`: number
- `height`: number
- `playsInline`: boolean; in the HTML `video` `playsinline`, not in the JSON
- `tracks`: array; default `[]`

Example:

```html
<!-- wp:video -->
<figure class="wp-block-video"><video controls src="https://upload.wikimedia.org/wikipedia/commons/c/ca/Wood_thrush_in_Central_Park_switch_sides_%2816510%29.webm"></video><figcaption class="wp-element-caption">Wood thrush singing in Central Park, NYC.</figcaption></figure>
<!-- /wp:video -->
```
<!-- generated:end -->
