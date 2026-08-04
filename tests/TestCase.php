<?php
declare(strict_types=1);

namespace Lattice\Tree\Tests;

use Closure;
use Lattice\Lattice\Support\Testing\InteractsWithLatticeComponents;
use Lattice\Lattice\Support\Testing\PackageTestCase;
use Lattice\Tree\Tree;
use Lattice\Tree\TreeServiceProvider;
use Workbench\App\WorkbenchConfig;

abstract class TestCase extends PackageTestCase
{
    use InteractsWithLatticeComponents;

    /** @return array<int, class-string> */
    protected function packageProviders(): array
    {
        return [TreeServiceProvider::class];
    }

    /** @return array<string, mixed> */
    protected function packageConfig(): array
    {
        return WorkbenchConfig::lattice();
    }

    /**
     * @param  Closure(): Tree  $build
     * @return array<string, mixed>
     */
    public function sealTree(Closure $build): array
    {
        return $this->sealLatticeComponent($build);
    }
}
