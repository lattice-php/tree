<?php
declare(strict_types=1);

namespace Lattice\Tree;

use Illuminate\Support\ServiceProvider;

final class TreeServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Registered directly on the loader rather than via loadTranslationsFrom():
        // the i18next route resolves only the translation loader, never the
        // translator, so the deferred loadTranslationsFrom() callback would never fire.
        $this->app->make('translation.loader')->addNamespace('tree', __DIR__.'/../lang');
    }
}
