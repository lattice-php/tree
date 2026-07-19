<?php
declare(strict_types=1);

use Lattice\Tree\Tests\TestCase;

uses(TestCase::class)->in('Feature');

/**
 * @return array<array-key, mixed>
 */
function wire(mixed $value): array
{
    return json_decode(json_encode($value, JSON_THROW_ON_ERROR), true);
}
