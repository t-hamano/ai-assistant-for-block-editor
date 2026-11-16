# Evaluation

Sends a few fixed requests to a real model, the way the AI assistant sends them from the editor, and checks what came of them. Use it to see whether a change to the prompt, the document context, or the tools saves tokens without making the edits worse.

The editor, the prompt, the document context, and the Anthropic adapter are the plugin's own code, run in Node. Only the PHP relay is replaced: the requests go straight to Anthropic, with the key from your environment. Every case uses Claude Sonnet 5.5 (`claude-sonnet-5-5`), so runs can be compared.

## Running

1. Put your Anthropic API key in `.env` at the root of the repository. The file is ignored by Git.

    ```sh
    ANTHROPIC_API_KEY=sk-ant-...
    ```

2. Run the cases. Each run sends real requests and costs a little: the cases together use well under a dollar.

    ```sh
    npm run eval
    ```

    To run only some cases, add promptfoo's options, such as `npm run eval -- --filter-pattern "outline"`.

3. Look at the results, and compare them with earlier runs.

    ```sh
    npm run eval:view
    ```

Each result shows the model's answers and the document afterwards. Open a result's details to see why each check passed or failed.

promptfoo keeps every run on your computer, so the viewer can show this run next to the one before a change.

## History

[history.jsonl](history.jsonl) keeps the results of earlier runs in the repository, one line for each run, so they can be compared after promptfoo's own runs are gone.

1. Commit the change you want to evaluate, then run the cases and save the results to a file. `results.json` at the root of the repository is ignored by Git.

    ```sh
    npm run eval -- -o results.json
    ```

2. Add the run to the history. To read another file, add its path: `npm run eval:record -- path/to/results.json`.

    ```sh
    npm run eval:record
    ```

    It prints how the run compares with the last run recorded for the same evaluation set and model, on the cases both runs have.

3. Commit `history.jsonl` in the pull request of the change, so the Git history of the file is the history of the results.

Each line has the time of the run, the commit, `dirty` when the code had changes that were not committed, the version of the evaluation set (`evalSet`), the model, the cases that passed, and the totals. Each case under `cases` has whether it passed, each check under `checks`, and its usage: the input tokens read at full price, from the cache, and written to it, `totalInputTokens` for all three together, the output tokens, the requests, and the retries. A case that ended in an error has the `error` instead.

Compare runs by `totalInputTokens`, `outputTokens`, and `requests`. How the input tokens split between the full price and the cache depends on whether the cache was still warm from an earlier run, but their total does not. Compare only runs of the same `evalSet` and model.

## What is checked

Only code decides whether a case passed. No model grades the answers.

- `validMarkup`: the editor reads every block of the document afterwards as valid.
- `firstTry`: no tool call failed and had to be tried again, and the model did not give up.
- `answered`: the model said something in every turn, after its text written before tool calls whose results went back to it was taken back.
- `edited`: the model edited the document in every turn.
- `expected`: the document has the blocks and text the case asks for, and no longer has the text it should not.

Each case also records, as metrics, the input tokens read at full price (`inputTokens`), the tokens read from and written to the prompt cache (`cacheReadTokens`, `cacheWriteTokens`), the output tokens (`outputTokens`), the requests sent (`requests`), and the tool calls tried again (`retries`). These never fail a case. The cases run one at a time, so the prompt cache is used the same way in every run.

## Cases

The cases are the `tests` in [promptfooconfig.yaml](promptfooconfig.yaml), and their documents are in [documents/](documents/). Each case has:

- `request`, what the user writes, and `followUp`, optional, what they write after the first answer.
- `document`, the post as block markup.
- `select`, optional: `block` is the path of a block (`[ 2 ]` for the third top-level block, `[ 0, 1 ]` for the second inner block of the first), `to` ends a range of blocks, and `text` selects that text inside the block's content.
- The `config` of its `expected` check: `blocks` the document must have, `text` its markup must have, and `absent` text it must no longer have, `order` text that must appear in that order, to check where an edit went, and `count` how many times its markup must have each text.

Every case runs with the theme of [theme.json](theme.json), taken from Twenty Twenty-Five and Ipsum, the latest default themes of WordPress. Its `settings` have presets of colors, gradients, duotone, shadows, spacing, font sizes, and font families. Its `styles` define block style variations, such as `text-display` for headings and paragraphs, which are registered as block styles the way WordPress registers them.

Keep the cases fixed, so that results can be compared. Add a case for a kind of request that is not covered, rather than changing one. The documents must be valid block markup, which `npm run test:unit` checks, together with the checks themselves.

## Versions

The `description` in `promptfooconfig.yaml` names the version of the evaluation set, such as `eval set v1`, so `npm run eval:view` shows which runs can be compared.

- Raise the version when an existing case changes: its document, request, selection, or expected values, or `theme.json`, which every case uses. Make such a change in a pull request of its own that does not change the plugin, and run the evaluation there to start the new version's results.
- Adding a case does not need a new version, since the other cases stay the same. When you compare totals with runs from before the case was added, add up only the cases both runs have.
