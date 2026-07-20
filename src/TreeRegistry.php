<?php
declare(strict_types=1);

namespace Lattice\Tree;

use Lattice\Lattice\Core\DefinitionRegistry;

/**
 * @extends DefinitionRegistry<TreeDefinition>
 */
final class TreeRegistry extends DefinitionRegistry
{
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
