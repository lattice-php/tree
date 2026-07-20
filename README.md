# Lattice Tree

Tree view component for [Lattice](https://github.com/lattice-php/lattice) — hierarchy rendering
from inline nodes, callbacks, or Eloquent adjacency-list sources, with full keyboard navigation
(roving tabindex, typeahead), per-node icons, badges, links, and actions, and lazy child loading
over a signed endpoint.

Extracted from the Lattice core package to grow on its own; drag & drop reordering is next on
the roadmap.

## Installation

```bash
composer require lattice-php/tree
```

That is the whole integration: the package ships its React renderer as source and Lattice's
`lattice()` Vite plugin compiles it into your app's bundle via `virtual:lattice/plugins`. The
PHP classes are picked up by Lattice's discovery and TypeScript generation automatically.

## Usage

```php
use Lattice\Tree\Tree;
use Lattice\Tree\TreeNode;

Tree::make('categories')->nodes([
    TreeNode::make('Electronics', 'electronics')
        ->icon('cpu')
        ->children([
            TreeNode::make('Laptops', 'electronics-laptops'),
            TreeNode::make('Phones', 'electronics-phones')->href('/products/phones'),
        ]),
])->defaultExpanded(['electronics']);
```

Or back it with an Eloquent adjacency list (a self-referencing `parent_id` column):

```php
use Lattice\Tree\EloquentTreeSource;

Tree::make('categories')->source(
    EloquentTreeSource::make(Category::class)
        ->scope(fn ($query) => $query->where('active', true)),
);
```

Any other backing store implements the two-method `Lattice\Tree\TreeSource` contract.

## Lazy loading

Serializing a large hierarchy eagerly is wasteful. Register a tree definition and let expansion
fetch one level per request instead:

```php
use Lattice\Tree\AsTree;
use Lattice\Tree\EloquentTreeSource;
use Lattice\Tree\TreeDefinition;
use Lattice\Tree\TreeSource;

#[AsTree('categories')]
class CategoryTree extends TreeDefinition
{
    public function source(): TreeSource
    {
        return EloquentTreeSource::make(Category::class);
    }
}
```

```php
Tree::use(CategoryTree::class)->lazy();     // roots eager, deeper levels fetched on expand
Tree::use(CategoryTree::class)->lazy(2);    // two levels eager
Tree::use(CategoryTree::class)->lazy(0);    // bare skeleton — even the roots are fetched
```

The definition is discovered like any Lattice definition (`#[AsTree]` + Lattice's discovery
paths), and the serialized tree carries a sealed reference — the same signing machinery Lattice
tables use — that the package's `lattice/trees/{tree}` endpoint verifies before resolving the
definition again with the identical context. `authorize()` on the definition gates both the
initial render and every fetch. The route's middleware and path follow Lattice's group
conventions: `config('lattice.trees.middleware', ['web', 'auth'])` and
`config('lattice.trees.endpoint', 'lattice/trees/{tree}')`.

An `EloquentTreeSource` behind the endpoint automatically switches to per-level queries
(`WHERE parent_id = ?` plus a scoped `EXISTS` probe for `hasChildren`) instead of loading the
whole table. Inline `->nodes()` / `->source()` trees stay eager-only — without a registry key
there is nothing to seal — so `->lazy()` on them throws.

## Translations

The component's strings ship with inline English defaults. With
[bambamboole/laravel-i18next](https://github.com/bambamboole/laravel-i18next) enabled and
`@lattice-php/lattice` >= 0.23, the plugin's `tree` namespace is loaded automatically and serves
the bundled `en`/`de` translations (override them like any Laravel package translation).

## Development

```bash
composer install
composer check   # pint --test, phpstan, pest
```
