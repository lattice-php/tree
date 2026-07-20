# Local Development

- This is a first-party companion package for [Lattice](https://github.com/lattice-php/lattice). It ships the Tree
  component — the PHP builder plus its React renderer as **source** (no separate npm package); the consumer's build
  compiles it via Lattice's `lattice()` Vite plugin.
- The package is developed with Orchestra Testbench, not a full Laravel app. `artisan` at the repo root is a symlink to
  `vendor/bin/testbench`, so `php artisan <command>` boots the Testbench skeleton with Lattice's and this package's
  service providers.
- Run the PHP suite with `composer test` or `./vendor/bin/pest`.
- Run the JavaScript (renderer) suite with `npm test` (Vitest). The tests exercise the renderer against the **published**
  `@lattice-php/lattice`, so `npm install` before running them.
- The AI tooling overrides for Boost live in `workbench/app/Support/` and are wired in
  `Workbench\App\Providers\WorkbenchServiceProvider`. They point Boost at the package root instead of the Testbench
  skeleton.
- `CLAUDE.md` and `AGENTS.md` are generated (git-ignored). They regenerate automatically after `composer install`; run
  `php artisan boost:update` (or `composer boost:refresh`) by hand after editing files in `.ai/guidelines/`.

## Verification

- Before finishing a change, run the gate that matches what you touched:
  - PHP change → `composer check` (Pint, PHPStan, Pest).
  - Renderer change → `npm run typecheck` and `npm test`.
- Never report green without having run the gate. CI runs both.

## Comments

- Code must be self-explanatory: reach for clear names, small functions, and types before a comment.
- Do not add comments. A comment is a last resort and explains only *why* something is done, never *what* the code does.
- When you encounter an obsolete, redundant, or "what" comment, delete it.
- Keep PHPDoc/JSDoc only when it carries type information, public API intent, static-analysis value, or a non-obvious
  constraint.
- Keep comments that explain framework quirks, ordering requirements, browser/test timing, or other constraints that are
  hard to infer from the code alone.

## Testing

- Prefer feature tests for backend behavior — serialize a `Tree` and assert its wire shape, or drive a source through
  the component, rather than isolating internals.
- Use unit tests for the small deterministic value objects and sources (`TreeNode`, `CallbackTreeSource`).
- For renderer behavior — expand/collapse, keyboard navigation, links, actions, persistence — use the Vitest suite in
  `resources/js`. It renders the component through Lattice's registry via the local `test-support.tsx` helpers.
- It is acceptable to add stable `data-test` attributes when they make assertions clearer or less brittle.
