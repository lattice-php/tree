<?php

declare(strict_types=1);

arch('no debug statements ship in the package')
    ->expect(['dd', 'ddd', 'dump', 'ray', 'var_dump', 'print_r'])
    ->not->toBeUsed();

arch('the package uses strict types throughout')
    ->expect('Lattice\\Tree')
    ->toUseStrictTypes();

it('builds the workbench before serving it', function (): void {
    $composer = json_decode(
        (string) file_get_contents(__DIR__.'/../composer.json'),
        associative: true,
        flags: JSON_THROW_ON_ERROR,
    );

    expect($composer['scripts']['serve'])->toContain('@build');
});
