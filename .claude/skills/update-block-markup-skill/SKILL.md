---
name: update-block-markup-skill
description: Update the block markup skill (skills/block-markup/) for a new WordPress or Gutenberg release, or a new minimum supported WordPress version, and open a pull request. Use when WordPress ships a major or minor release, Gutenberg ships a plugin release, or the plugin raises "Requires at least".
---

# Update the block markup skill

The plugin sends `skills/block-markup/` (skill 1) to the AI so that it writes valid block markup on the first try. Blocks change with every WordPress and Gutenberg release, so this skill brings skill 1 up to date and opens a pull request.

Skill 1 has two files:

- `skills/block-markup/SKILL.md`: the common rules. Written by hand.
- `skills/block-markup/references/core-blocks.md`: one section per core block. The parts between `<!-- generated:start -->` and `<!-- generated:end -->` are written by `scripts/generate-block-reference.cjs`. Everything else, such as "Common mistakes", is written by hand and kept by the script.

## Rules

- Never edit a generated part by hand. If the generated output is wrong, fix `scripts/generate-block-reference.cjs` or `scripts/lib/block-reference.cjs`, and add a test in `scripts/lib/test/`.
- Never include unreleased Gutenberg changes. Use only versions published under the `latest` or `wp-X.Y` npm dist-tags, never `next`, RCs, or trunk.
- Rules and examples must be valid on the lowest WordPress version the plugin supports (`Requires at least` in `readme.txt`). Attributes that only newer versions have are covered at runtime by the site information, so do not teach them in the skill.
- Change only skill 1, its generator, the `@wordpress/*` versions, and the lock file. Fixes the plugin's code needs for the new versions go in a separate pull request.

## Steps

### 1. Decide the target versions

1. Read the current versions from the frontmatter of `skills/block-markup/SKILL.md` (`wordpress`, `gutenberg`, `block-library`) and the minimum supported version from `Requires at least` in `readme.txt`.
2. Find the latest stable Gutenberg release on <https://github.com/WordPress/gutenberg/releases> (skip pre-releases). Its `@wordpress/block-library` version is in `packages/block-library/package.json` at that release's tag, and it is the npm `latest` dist-tag when the release is the newest one:

   ```sh
   npm view @wordpress/block-library dist-tags --json
   ```

3. Find the latest WordPress release on <https://wordpress.org/download/releases/>. The `@wordpress/block-library` version it bundles is the `wp-X.Y` dist-tag above. If the tag does not exist yet, read `package.json` on the `X.Y` branch of <https://github.com/WordPress/wordpress-develop>.
4. Target the Gutenberg release's packages, because the plugin is tested with the latest Gutenberg. Write down the old and new versions of WordPress, Gutenberg, and `@wordpress/block-library`. If none of these versions changed and `Requires at least` did not go up since the last update, stop and report that skill 1 is already up to date. When only `Requires at least` went up, skip steps 2 and 3 and go on from step 4, looking for rules and examples that the skill left out because the old minimum did not support them.

### 2. Bump the `@wordpress/*` dependencies

1. In `package.json`, set every exactly pinned `@wordpress/*` package in `dependencies` and `devDependencies` to the version published with the target Gutenberg release. Leave `@wordpress/scripts` and `@wordpress/env`, which use `^` ranges, alone. Find each version with:

   ```sh
   npm view @wordpress/<package>@<version-or-dist-tag> version
   ```

2. Run `npm install` so that `package-lock.json` matches. `.npmrc` sets `save-exact`.
3. Run `npm run lint:types` and `npm run build`. If the plugin's own code breaks, stop and report it: that fix belongs in its own pull request, merged first.

### 3. Regenerate the reference

```sh
npm run generate:block-reference
```

The script rewrites only the generated parts, and copies `wordpress` and `gutenberg` from the frontmatter of `SKILL.md` into `core-blocks.md`. It warns when a block is no longer in the block library and its handwritten notes were dropped. Keep those warnings for the pull request.

Then run `npm run test:unit`. A failure in `src/editor/test/skill-examples.test.ts` means an example in `SKILL.md` or a handwritten part no longer matches what the new blocks save: fix it in step 5. Any other failure is in the plugin's own code: stop and report it, as in step 2.

### 4. Find what changed

1. Read the diff of the generated reference. It shows new and removed blocks, added and removed attributes, and changes in the markup that `save()` writes:

   ```sh
   git diff -- skills/block-markup/references/core-blocks.md
   ```

2. List the blocks whose `block.json`, `save()`, or `deprecated` entries changed. A new `deprecated` entry means the saved markup changed:

   ```sh
   npm diff --diff=@wordpress/block-library@<old> --diff=@wordpress/block-library@<new> --diff-name-only | grep -E '^src/.*(deprecated|block\.json|save)'
   ```

   Then read the diff of the files that matter, for example `npm diff --diff=@wordpress/block-library@<old> --diff=@wordpress/block-library@<new> src/<block>/deprecated.js`.

3. Read the release notes for block, theme, and `theme.json` changes:
   - For WordPress: the Field Guide and Dev Notes of that version, on <https://make.wordpress.org/core/tag/dev-notes/>.
   - For Gutenberg: the "What's new in Gutenberg" posts on <https://make.wordpress.org/core/tag/gutenberg-new/> and the changelog of each release since the old version.

4. Make a short list of changes that affect how the AI should write markup, such as a new wrapper element, a renamed class, a new required attribute, or a block that moved to a self-closing comment.

### 5. Fix the handwritten parts

- Edit `SKILL.md` only when a change affects a common rule, such as how attributes map to classes and styles, nesting, dynamic blocks, or presets.
- Add or fix "Common mistakes" under a block in `core-blocks.md` only for mistakes the new markup makes likely.
- Remove rules and mistakes about blocks or attributes that no longer exist.
- Do not add markup that is invalid on the minimum supported version.
- Keep the writing style of the existing files: short sentences that tell the AI what to write.

### 6. Verify

Run the checks. `test:unit` parses every example in skill 1 and fails when one is not valid:

```sh
npm run lint:block-reference
npm run lint:md-docs
npm run test:unit
```

### 7. Update the frontmatter

1. In `skills/block-markup/SKILL.md`, set `wordpress`, `gutenberg`, `block-library`, and `generated` (today's date, `YYYY-MM-DD`).
2. Run `npm run generate:block-reference` again so that `core-blocks.md` gets the same `wordpress` and `gutenberg`. Its `generated` date changes only when something in the reference changed.
3. Run `npm run lint:block-reference` to confirm the reference is up to date.

### 8. Open a pull request

Commit on a new branch named after the target, for example `update/block-markup-skill-gutenberg-24-5`. The description covers:

- The old and new versions of WordPress, Gutenberg, and `@wordpress/block-library`.
- A summary of the block changes from step 4: new, removed, and changed blocks and attributes, with any handwritten notes the generator dropped.
- The rules and "Common mistakes" fixed by hand, and why.
