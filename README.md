# AI Content Editing Assistant

[![Test](https://github.com/t-hamano/ai-content-editing-assistant/actions/workflows/test.yml/badge.svg)](https://github.com/t-hamano/ai-content-editing-assistant/actions/workflows/test.yml)

Select blocks or text in the block editor and edit them by chatting with AI. The plugin uses the API keys registered on the Connectors screen in WordPress core.

> [!IMPORTANT]
> Only users with administrator privileges can use this plugin. Requests are sent with the site's API keys, so other users cannot open the AI assistant.

## Requirements

* WordPress 7.1 or later
* PHP 8.3 or later
* An AI provider plugin, such as AI Provider for Anthropic, with an API key on the Connectors screen. The AI assistant does not appear until a key is set

## How to build

```sh
npm install
npm run build
```

## Author

[Aki Hamano (GitHub)](https://github.com/t-hamano)
