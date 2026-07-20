<?php
declare(strict_types=1);

namespace Lattice\Tree;

use Lattice\Lattice\Core\DefinitionRegistry;

/**
 * @extends DefinitionRegistry<TreeDefinition>
 */
final class TreeRegistry extends DefinitionRegistry
{
    /**
     * @param  class-string<TreeDefinition>  $tree
     * @param  array<string, mixed>  $context
     */
    public function component(string $tree, array $context = []): Tree
    {
        $key = $this->registeredKeyFor($tree);
        $definition = $this->make($tree)->withContext($context);

        if (! $this->authorizedToRender($definition)) {
            return Tree::make($key)->hidden();
        }

        return Tree::make($key)
            ->id($key)
            ->signedAs($key)
            ->context($context)
            ->endpoint($this->endpointFor($key))
            ->source($definition->source());
    }

    protected function definitionClass(): string
    {
        return TreeDefinition::class;
    }

    public function attributeClass(): string
    {
        return AsTree::class;
    }

    protected function name(): string
    {
        return 'tree';
    }

    public function group(): string
    {
        return 'trees';
    }
}
