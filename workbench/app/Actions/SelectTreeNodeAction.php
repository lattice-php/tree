<?php
declare(strict_types=1);

namespace Workbench\App\Actions;

use Illuminate\Http\Request;
use Lattice\Lattice\Actions\ActionDefinition;
use Lattice\Lattice\Actions\ActionResult;
use Lattice\Lattice\Actions\Components\Action;
use Lattice\Lattice\Attributes\AsAction;

#[AsAction('workbench.tree.select-node')]
final class SelectTreeNodeAction extends ActionDefinition
{
    public function definition(Action $action): Action
    {
        return $action->label('Select node');
    }

    public function handle(Request $request): ActionResult
    {
        return ActionResult::success($request->validate([
            'nodeId' => ['required', 'string'],
        ]));
    }
}
