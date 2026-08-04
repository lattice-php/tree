<?php
declare(strict_types=1);

namespace Workbench\App\Providers;

use Illuminate\Support\ServiceProvider;
use Workbench\App\WorkbenchConfig;

class WorkbenchServiceProvider extends ServiceProvider
{
    #[\Override]
    public function register(): void
    {
        config(WorkbenchConfig::lattice());
    }
}
