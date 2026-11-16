=== AI Content Editing Assistant ===
Contributors: wildworks
Tags: ai, gutenberg, block, editor, assistant
Donate link: https://www.paypal.me/thamanoJP
Requires at least: 7.1
Tested up to: 7.2
Stable tag: 0.1.0
Requires PHP: 8.3
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Select blocks or text in the block editor and edit them by chatting with AI.

== Description ==
AI Content Editing Assistant adds an AI chat to the block editor. Select blocks or a piece of text, tell the AI what you want to change, and it edits the content for you.

**Edit What You Select**

Select one or more blocks, or just a few words inside a block, and ask the AI to rewrite, translate, summarize, or restyle them. Only the selected part is changed.

**Understands Your Site**

The AI knows the blocks available on your site and the colors, font sizes, and other presets of your theme, so its edits fit your site.

**Works With Long Documents**

Long posts are sent as an outline, and the AI reads only the parts it needs.

**Uses Your Own API Keys**

The plugin uses the API keys registered on the Connectors screen in WordPress. Install an AI provider plugin, such as AI Provider for Anthropic, and set its API key.

Only users with administrator privileges can use this plugin, and only super admins on a multisite network, because requests are sent with the site's API keys.

== Installation ==
1. Upload the `ai-content-editing-assistant` folder to the `/wp-content/plugins/` directory.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Install an AI provider plugin and set its API key on the Connectors screen.

== Screenshots ==
1. Select text or blocks, ask the AI, and see the changes in the editor

== External services ==
This plugin sends content to an AI provider to edit it. It connects only to the provider whose API key is set on the Connectors screen, and only when an administrator or a super admin uses the AI assistant in the block editor.

When you send a message, the following data is sent to the provider: your message and the conversation so far, the selected blocks or text, an outline or parts of the post being edited, and a list of the blocks and theme presets available on the site. The site's API key is sent with each request. To show the models you can choose, the plugin also asks the provider for its list of models.

= Anthropic (Claude) =
Used when an Anthropic API key is set. Data is sent to `api.anthropic.com`.

* Terms of service: https://www.anthropic.com/legal/commercial-terms
* Privacy policy: https://www.anthropic.com/legal/privacy

= OpenAI =
Used when an OpenAI API key is set. Data is sent to `api.openai.com`.

* Terms of use: https://openai.com/policies/row-terms-of-use/
* Privacy policy: https://openai.com/policies/privacy-policy/

= Google (Gemini API) =
Used when a Google API key is set. Data is sent to `generativelanguage.googleapis.com`.

* Terms of service: https://ai.google.dev/gemini-api/terms
* Privacy policy: https://policies.google.com/privacy

= Other providers =
For other AI provider plugins, the conversation is sent through the AI Client in WordPress to the service of that provider. See the terms and privacy policy of the provider you use.

== Resources ==

= react-markdown =
* License: MIT License
* Source: https://github.com/remarkjs/react-markdown

= remark-gfm =
* License: MIT License
* Source: https://github.com/remarkjs/remark-gfm

= uuid =
* License: MIT License
* Source: https://github.com/uuidjs/uuid

== Changelog ==

= 0.1.0 =
* Initial release
