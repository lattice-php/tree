<?php
declare(strict_types=1);

namespace Workbench\App\Pages;

use Lattice\Lattice\Actions\Components\Action;
use Lattice\Lattice\Actions\Components\ActionGroup;
use Lattice\Lattice\Attributes\AsPage;
use Lattice\Lattice\Core\PageSchema;
use Lattice\Lattice\Ui\Components\Heading;
use Lattice\Lattice\Ui\Components\Modal;
use Lattice\Lattice\Ui\Components\Stack;
use Lattice\Lattice\Ui\Components\Text;
use Lattice\Lattice\Ui\Enums\Gap;
use Lattice\Tree\Tree;
use Lattice\Tree\TreeNode;
use Workbench\App\Actions\ShowTreeNodeInfoAction;

#[AsPage(route: '/tree')]
final class TreePage extends WorkbenchPage
{
    public function title(): string
    {
        return 'Tree';
    }

    public function render(PageSchema $schema): PageSchema
    {
        return $schema->schema([
            Stack::make('tree-page')
                ->gap(Gap::ExtraLarge)
                ->schema([
                    Heading::make($this->title()),
                    Text::make('A hierarchy rendered by the lattice-php/tree component package.'),
                    Tree::make('demo-tree')
                        ->nodes([
                            TreeNode::make('Electronics', 'electronics')
                                ->children([
                                    TreeNode::make('Laptops', 'electronics-laptops'),
                                    TreeNode::make('Phones', 'electronics-phones'),
                                    TreeNode::make('Accessories', 'electronics-accessories')
                                        ->children([
                                            TreeNode::make('Cases', 'electronics-accessories-cases'),
                                            TreeNode::make('Chargers', 'electronics-accessories-chargers'),
                                        ]),
                                ]),
                            TreeNode::make('Clothing', 'clothing')
                                ->children([
                                    TreeNode::make('Men', 'clothing-men'),
                                    TreeNode::make('Women', 'clothing-women')->href('/plain'),
                                    TreeNode::make('Kids', 'clothing-kids'),
                                ]),
                            TreeNode::make('Documents', 'documents')
                                ->actions(
                                    ActionGroup::make('tree-documents-actions')
                                        ->actions([
                                            Action::make('tree-documents-rename')->label('Rename'),
                                            Action::make('tree-documents-archive')->label('Archive'),
                                        ]),
                                ),
                            TreeNode::make('Furniture', 'furniture')
                                ->children([
                                    TreeNode::make('Sofas', 'furniture-sofas'),
                                    TreeNode::make('Beds', 'furniture-beds'),
                                ]),
                            TreeNode::make('Help', 'help')
                                ->action(Action::use(ShowTreeNodeInfoAction::class)),
                        ])
                        ->activeId('electronics-phones')
                        ->defaultExpanded(['electronics', 'furniture'])
                        ->rememberState(),
                    Modal::make('tree-node-info')
                        ->title('Node info')
                        ->description('Details about the selected node.')
                        ->schema([
                            Text::make('This modal was opened from a tree node action.'),
                        ]),
                ]),
        ]);
    }
}
