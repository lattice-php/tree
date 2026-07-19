# Lattice Tree

Tree view component for [Lattice](https://github.com/lattice-php/lattice) — hierarchy rendering
from inline nodes, callbacks, or Eloquent adjacency-list sources, with full keyboard navigation
(roving tabindex, typeahead) and per-node icons, badges, links, and actions.

Extracted from the Lattice core package to grow on its own: lazy child loading via a signed-ref
endpoint and drag & drop reordering are on the roadmap.

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
