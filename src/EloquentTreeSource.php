<?php
declare(strict_types=1);

namespace Lattice\Tree;

use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

/**
 * @template TModel of Model
 *
 * A {@see TreeSource} backed by an Eloquent adjacency-list hierarchy (a
 * self-referencing parent column).
 *
 * The whole scoped table is loaded once and served from an in-memory
 * adjacency map — for an adjacency list one scan beats a query per parent,
 * and the eager Tree walk asks for every level anyway.
 */
final class EloquentTreeSource implements TreeSource
{
    private const string ROOTS = '';

    private const int MAX_PATH_DEPTH = 50;

    /** @var Closure(Builder<Model>): mixed|null */
    private ?Closure $scope = null;

    private bool $lazy = false;

    private ?string $orderKey = null;

    private string $orderDirection = 'asc';

    /** @var Closure(TModel, TreeNode): TreeNode|null */
    private ?Closure $mapper = null;

    /** @var array<string, list<TreeNode>>|null */
    private ?array $childrenByParent = null;

    /** @var class-string<TModel> */
    private readonly string $model;

    /**
     * @param  class-string<TModel>  $model
     */
    private function __construct(
        string $model,
        private string $labelKey = 'name',
        private string $parentKey = 'parent_id',
    ) {
        $this->model = $model;
    }

    /**
     * @template T of Model
     *
     * @param  class-string<T>  $model
     * @return self<T>
     */
    public static function make(string $model): self
    {
        return new self($model);
    }

    /**
     * Constrain every query this source issues (e.g. only active rows).
     *
     * @param  Closure(Builder<Model>): mixed  $scope
     */
    public function scope(Closure $scope): static
    {
        $this->scope = $scope;
        $this->childrenByParent = null;

        return $this;
    }

    public function label(string $column): static
    {
        $this->labelKey = $column;
        $this->childrenByParent = null;

        return $this;
    }

    public function parent(string $column): static
    {
        $this->parentKey = $column;
        $this->childrenByParent = null;

        return $this;
    }

    public function orderBy(string $column, string $direction = 'asc'): static
    {
        $direction = strtolower($direction);

        if (! in_array($direction, ['asc', 'desc'], true)) {
            throw new InvalidArgumentException('Tree ordering direction must be "asc" or "desc".');
        }

        $this->orderKey = $column;
        $this->orderDirection = $direction;
        $this->childrenByParent = null;

        return $this;
    }

    /** @param Closure(TModel, TreeNode): TreeNode $mapper */
    public function map(Closure $mapper): static
    {
        $this->mapper = $mapper;
        $this->childrenByParent = null;

        return $this;
    }

    /**
     * Query one level per call instead of loading the whole scoped table.
     * The right mode for the lazy endpoint, where each request asks for a
     * single parent's children; the full scan stays optimal for the eager
     * walk, which visits every level anyway.
     */
    public function lazy(bool $lazy = true): static
    {
        $this->lazy = $lazy;

        return $this;
    }

    public function roots(): iterable
    {
        return $this->lazy
            ? $this->level(null)
            : $this->childrenByParent()[self::ROOTS] ?? [];
    }

    public function children(string $parentId): iterable
    {
        return $this->lazy
            ? $this->level($parentId)
            : $this->childrenByParent()[$parentId] ?? [];
    }

    public function path(string $nodeId): ?array
    {
        $path = [];
        $visited = [];
        $currentId = $nodeId;

        for ($depth = 0; $depth < self::MAX_PATH_DEPTH; $depth++) {
            if (isset($visited[$currentId])) {
                return null;
            }

            $visited[$currentId] = true;
            $query = $this->query();
            $model = $query->getModel();
            $table = $model->getTable();
            $node = $query->whereKey($currentId)->first([
                $model->getQualifiedKeyName(),
                "{$table}.{$this->parentKey}",
            ]);

            if ($node === null) {
                return null;
            }

            $parentId = $node->getAttribute($this->parentKey);

            if ($parentId === null) {
                return array_reverse($path);
            }

            $currentId = (string) $parentId;
            $path[] = $currentId;
        }

        return null;
    }

    /**
     * One level plus a scoped EXISTS probe per row for hasChildren — no
     * relation on the consumer's model is required.
     *
     * @return list<TreeNode>
     */
    private function level(?string $parentId): array
    {
        $query = $this->query();
        $model = $query->getModel();
        $table = $model->getTable();
        $alias = "{$table}_lattice_children";

        if ($parentId === null) {
            $query->whereNull("{$table}.{$this->parentKey}");
        } else {
            $query->where("{$table}.{$this->parentKey}", $parentId);
        }

        $probe = $this->query()
            ->from("{$table} as {$alias}")
            ->selectRaw('1')
            ->whereColumn("{$alias}.{$this->parentKey}", $model->getQualifiedKeyName())
            ->limit(1);

        $rows = $this->ordered($query
            ->select("{$table}.*")
            ->addSelect(['lattice_tree_has_children' => $probe]))
            ->get();

        return array_values($rows->map(
            fn ($row): TreeNode => $this->node(
                $row,
                (bool) $row->getAttribute('lattice_tree_has_children'),
            ),
        )->all());
    }

    /**
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function ordered(Builder $query): Builder
    {
        if ($this->orderKey !== null) {
            $query->orderBy($this->orderKey, $this->orderDirection);
        }

        $query->orderBy($this->labelKey)->orderBy($query->getModel()->getQualifiedKeyName());

        return $query;
    }

    /** @param TModel $model */
    private function node(Model $model, bool $hasChildren): TreeNode
    {
        $node = TreeNode::make(
            (string) $model->getKey(),
            (string) $model->getAttribute($this->labelKey),
        )->hasChildren($hasChildren);

        return $this->mapper instanceof Closure ? ($this->mapper)($model, $node) : $node;
    }

    /**
     * @return Builder<TModel>
     */
    private function query(): Builder
    {
        $builder = (new $this->model)->newQuery();

        if ($this->scope instanceof Closure) {
            $scoped = ($this->scope)($builder);

            if ($scoped instanceof Builder) {
                $builder = $scoped;
            }
        }

        return $builder;
    }

    /**
     * @return array<string, list<TreeNode>>
     */
    private function childrenByParent(): array
    {
        if ($this->childrenByParent !== null) {
            return $this->childrenByParent;
        }

        /** @var array<string, list<TModel>> $modelsByParent */
        $modelsByParent = [];

        foreach ($this->ordered($this->query())->get() as $model) {
            $parent = $model->getAttribute($this->parentKey);
            $modelsByParent[$parent === null ? self::ROOTS : (string) $parent][] = $model;
        }

        $this->childrenByParent = [];

        foreach ($modelsByParent as $parent => $models) {
            $this->childrenByParent[$parent] = array_map(
                fn ($model): TreeNode => $this->node(
                    $model,
                    isset($modelsByParent[(string) $model->getKey()]),
                ),
                $models,
            );
        }

        return $this->childrenByParent;
    }
}
