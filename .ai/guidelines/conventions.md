# Tree Package Conventions

- **Flat namespace.** Everything lives directly under `Lattice\Tree` (`Tree`, `TreeNode`, `TreeSource`,
  `CallbackTreeSource`, `EloquentTreeSource`, `TreeServiceProvider`) — no deep `Ui\Components\…` nesting.
- **Composer-only distribution.** There is no npm package. The React renderer (`resources/js/*.tsx`) ships as source and
  is compiled into the consumer's bundle through Lattice's `lattice()` Vite plugin, wired by the two `extra.lattice`
  keys in `composer.json` (`plugin` → `virtual:lattice/plugins`, `discover` → PHP component discovery).
- **Import only from Lattice's public export map.** Because the renderer compiles inside the consumer's app, its runtime
  imports must resolve through `@lattice-php/lattice`'s `exports` (e.g. `@lattice-php/lattice/core`,
  `.../icons`, `.../ui`, `.../i18n`). Do not reach into deep, unexported paths — they are not guaranteed to exist for
  consumers.
- **Wire types are local.** The renderer defines its own `TreeNodeData`/`TreeWireProps` and augments Lattice's
  `ComponentProps` via `declare module "@lattice-php/lattice"`, rather than importing generated core types that no longer
  ship a Tree entry.
- **Translations.** The component reads strings under its own `tree` i18next namespace with inline English defaults at
  the call site (`t("tree.expand", "Expand {{label}}", …)`). `TreeServiceProvider` registers the namespace on the
  translation loader; bundled `en`/`de` files live in `lang/`. Keep both locales in sync.
- **Eager today; lazy and drag-and-drop are the roadmap.** `Tree` currently serializes the whole hierarchy server-side
  (with a `MAX_DEPTH` cycle guard). Lazy child loading over a signed-ref endpoint and drag-and-drop reordering are the
  planned follow-ups and the reason the component was extracted from core.
- **Version coupling.** The package requires `lattice-php/lattice` `^0.23`; features that depend on newer core APIs must
  bump that constraint and wait for the corresponding core release.
