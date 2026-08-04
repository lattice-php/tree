<?php
declare(strict_types=1);

namespace Lattice\Tree;

interface TreePathSource
{
    /** @return list<string>|null */
    public function path(string $nodeId): ?array;
}
