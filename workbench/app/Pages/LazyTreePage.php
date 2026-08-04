<?php
declare(strict_types=1);

namespace Workbench\App\Pages;

use Lattice\Lattice\Attributes\AsPage;
use Lattice\Lattice\Core\PageSchema;
use Lattice\Lattice\Ui\Components\Heading;
use Lattice\Lattice\Ui\Components\Stack;
use Lattice\Lattice\Ui\Components\Text;
use Lattice\Lattice\Ui\Enums\Gap;
use Lattice\Tree\Tree;
use Workbench\App\Actions\MoveTreeNodeAction;
use Workbench\App\Actions\SelectTreeNodeAction;
use Workbench\App\Trees\CategoryTree;

#[AsPage(route: '/tree-lazy')]
final class LazyTreePage extends WorkbenchPage
{
    public function title(): string
    {
        return 'Lazy tree';
    }

    public function render(PageSchema $schema): PageSchema
    {
        $activeId = request()->string('category')->toString();
        $revision = request()->string('revision')->toString();

        return $schema->schema([
            Stack::make('lazy-tree-page')
                ->gap(Gap::ExtraLarge)
                ->schema([
                    Heading::make($this->title()),
                    Text::make('Roots serialize eagerly; expanding fetches each level from the signed endpoint.'),
                    Tree::use(CategoryTree::class)
                        ->activeId($activeId !== '' ? $activeId : null)
                        ->lazy()
                        ->moveAction(MoveTreeNodeAction::class)
                        ->revision($revision !== '' ? $revision : null)
                        ->selectAction(SelectTreeNodeAction::class),
                ]),
        ]);
    }
}
