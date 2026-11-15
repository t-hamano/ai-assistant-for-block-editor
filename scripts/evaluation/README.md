# Skill evaluation

Measures how well the block markup skill (`skills/block-markup/`) helps a real model write block markup the editor accepts. Each request in `cases.json` is sent to the model in a fresh editor, the same way the AI assistant sends the first message of a conversation, and the script records:

- **First-try pass rate**: the share of runs in which the model edited the document and every edit was applied without being sent back for fixing.
- **Retries per run**: how many edits failed validation and were tried again.
- **Auto-fixed edits**, runs where the model **gave up** after the allowed retries, and runs with **no edit**.
- **Did what was asked**: whether the document afterwards has what the case's `expect` lists.

The editor, the validation, and the provider adapters are the plugin's own code, run in Node. Only the PHP relay is replaced: the script sends the requests to the provider itself, with the key from an environment variable.

## Running

```sh
# Check the cases and build the requests, without an API key.
npm run evaluate:skill -- --dry-run

# Run against Anthropic. OPENAI_API_KEY and GEMINI_API_KEY work the same way with --provider openai and --provider google.
ANTHROPIC_API_KEY=... npm run evaluate:skill

# Three runs of each case, since answers vary.
ANTHROPIC_API_KEY=... npm run evaluate:skill -- --runs 3

# Compare with results saved before a skill change.
ANTHROPIC_API_KEY=... npm run evaluate:skill -- --compare artifacts/evaluation/<before>.json
```

Results are saved to `artifacts/evaluation/`, and a Markdown summary is printed for the pull request. Run `npm run evaluate:skill -- --help` for every option.

## Cases

Each case in `cases.json` has:

- `id` and `request`, what the user writes in the chat.
- `document`, the post as block markup. It must be valid; the tests check it.
- `select`, optional: `block` is the path of a block (`[ 2 ]` for the third top-level block, `[ 0, 1 ]` for the second inner block of the first), `to` ends a range of blocks, and `text` selects that text inside the block instead.
- `expect`, optional: `blocks` the document must have, `text` its markup must have, and `absent` text it must no longer have.

Keep the cases fixed between skill changes, so that results can be compared. Add a case when a kind of request is not covered, rather than changing an existing one.
