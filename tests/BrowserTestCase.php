<?php
declare(strict_types=1);

namespace Lattice\Tree\Tests;

use Lattice\Lattice\Support\Testing\PackageBrowserTestCase;
use Lattice\Tree\TreeServiceProvider;
use Workbench\App\WorkbenchConfig;

abstract class BrowserTestCase extends PackageBrowserTestCase
{
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
}
