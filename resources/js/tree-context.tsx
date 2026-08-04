import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { runAction } from "@lattice-php/lattice/action";
import { apiFetch, apiJson, usePersistentState } from "@lattice-php/lattice/core";
import type { Node } from "@lattice-php/lattice/core";
import { useEffectDispatcher } from "@lattice-php/lattice/effects/use-effect-dispatcher";
import type { TreeNodeData } from "./tree";

export const ROOTS_KEY = "";

type TreeGraph = {
  children: Map<string, string[]>;
  loaded: Set<string>;
  nodes: Map<string, TreeNodeData>;
  parents: Map<string, string | null>;
};

function addChildren(graph: TreeGraph, parentId: string, children: TreeNodeData[]): void {
  graph.children.set(
    parentId,
    children.map((child) => child.id),
  );
  graph.loaded.add(parentId);

  for (const child of children) {
    const { children: nested, ...node } = child;
    graph.nodes.set(child.id, node);
    graph.parents.set(child.id, parentId === ROOTS_KEY ? null : parentId);

    if (nested) {
      addChildren(graph, child.id, nested);
    }
  }
}

function createGraph(nodes: TreeNodeData[], rootsLoaded: boolean): TreeGraph {
  const graph: TreeGraph = {
    children: new Map(),
    loaded: new Set(),
    nodes: new Map(),
    parents: new Map(),
  };

  addChildren(graph, ROOTS_KEY, nodes);

  if (!rootsLoaded) {
    graph.loaded.delete(ROOTS_KEY);
  }

  return graph;
}

function mergeChildren(graph: TreeGraph, parentId: string, children: TreeNodeData[]): TreeGraph {
  const next: TreeGraph = {
    children: new Map(graph.children),
    loaded: new Set(graph.loaded),
    nodes: new Map(graph.nodes),
    parents: new Map(graph.parents),
  };

  addChildren(next, parentId, children);

  return next;
}

export type TreeMoveRequest = {
  nodeId: string;
  parentId: string | null;
  position: number;
};

function isDescendant(graph: TreeGraph, ancestorId: string, nodeId: string): boolean {
  let parentId = graph.parents.get(nodeId);

  while (parentId !== null && parentId !== undefined) {
    if (parentId === ancestorId) {
      return true;
    }

    parentId = graph.parents.get(parentId);
  }

  return false;
}

function moveTreeNode(graph: TreeGraph, request: TreeMoveRequest): TreeGraph | null {
  const node = graph.nodes.get(request.nodeId);
  const target = request.parentId === null ? null : graph.nodes.get(request.parentId);

  if (
    !node ||
    node.disabled === true ||
    (request.parentId !== null && !target) ||
    target?.disabled === true ||
    request.nodeId === request.parentId ||
    (request.parentId !== null && isDescendant(graph, request.nodeId, request.parentId))
  ) {
    return null;
  }

  const sourceParentId = graph.parents.get(request.nodeId) ?? null;
  const sourceKey = sourceParentId ?? ROOTS_KEY;
  const targetKey = request.parentId ?? ROOTS_KEY;
  const sourceChildren = graph.children.get(sourceKey) ?? [];
  const sourceIndex = sourceChildren.indexOf(request.nodeId);

  if (sourceIndex === -1) {
    return null;
  }

  const next: TreeGraph = {
    children: new Map(graph.children),
    loaded: new Set(graph.loaded),
    nodes: new Map(graph.nodes),
    parents: new Map(graph.parents),
  };
  const withoutNode = sourceChildren.filter((id) => id !== request.nodeId);
  const targetChildren = sourceKey === targetKey ? withoutNode : [...(graph.children.get(targetKey) ?? [])];
  const position = Math.max(0, Math.min(request.position, targetChildren.length));

  if (sourceKey === targetKey && sourceIndex === position) {
    return null;
  }

  targetChildren.splice(position, 0, request.nodeId);
  next.children.set(sourceKey, withoutNode);
  next.children.set(targetKey, targetChildren);
  next.loaded.add(targetKey);
  next.parents.set(request.nodeId, request.parentId);

  if (sourceParentId !== null && withoutNode.length === 0) {
    next.nodes.set(sourceParentId, { ...graph.nodes.get(sourceParentId)!, hasChildren: false });
  }

  if (request.parentId !== null) {
    next.nodes.set(request.parentId, { ...target!, hasChildren: true });
  }

  return next;
}

export type TreeItemRegistration = {
  id: string;
  label: string;
  orderPath: string;
  parentPath: string | null;
  path: string;
  ref: RefObject<HTMLLIElement | null>;
};

export type TreeFocusDirection = "first" | "firstChild" | "last" | "next" | "parent" | "prev";

export type TreeContextValue = {
  activate: (id: string) => void;
  activeId: string | null;
  canDropOn: (sourceId: string, targetId: string) => boolean;
  canLoad: boolean;
  canMove: boolean;
  childrenCount: (id: string | null) => number;
  childrenFor: (id: string) => TreeNodeData[] | undefined;
  expand: (id: string) => void;
  expanded: Set<string>;
  focus: (id: string) => void;
  focusedId: string | null;
  isLoaded: (id: string) => boolean;
  isLoading: (id: string) => boolean;
  loadChildren: (id: string) => Promise<void>;
  move: (request: TreeMoveRequest) => Promise<boolean>;
  moveFocus: (fromId: string, direction: TreeFocusDirection) => void;
  moving: boolean;
  parentFor: (id: string) => string | null;
  positionFor: (id: string) => number;
  register: (entry: TreeItemRegistration) => void;
  toggle: (id: string) => void;
  typeAhead: (fromId: string, character: string) => void;
  unregister: (path: string) => void;
};

const defaultTreeContext: TreeContextValue = {
  activate: () => {},
  activeId: null,
  canDropOn: () => false,
  canLoad: false,
  canMove: false,
  childrenCount: () => 0,
  childrenFor: () => undefined,
  expand: () => {},
  expanded: new Set(),
  focus: () => {},
  focusedId: null,
  isLoaded: () => false,
  isLoading: () => false,
  loadChildren: async () => {},
  move: async () => false,
  moveFocus: () => {},
  moving: false,
  parentFor: () => null,
  positionFor: () => -1,
  register: () => {},
  toggle: () => {},
  typeAhead: () => {},
  unregister: () => {},
};

export const TreeContext = createContext<TreeContextValue>(defaultTreeContext);

export function useTreeContext(): TreeContextValue {
  return useContext(TreeContext);
}

function parseExpanded(raw: string): Set<string> {
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("expected an array of ids");
  }

  return new Set(parsed.filter((id): id is string => typeof id === "string"));
}

function visibleOrder(registry: Map<string, TreeItemRegistration>): TreeItemRegistration[] {
  return [...registry.values()].sort((a, b) => a.orderPath.localeCompare(b.orderPath));
}

async function runTreeAction(
  action: Node<"action">,
  payload: Record<string, unknown>,
  dispatch: ReturnType<typeof useEffectDispatcher>,
): Promise<boolean> {
  const endpoint = action.props.endpoint;

  if (!endpoint) {
    return true;
  }

  return runAction(
    () =>
      apiFetch(endpoint, {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: action.props.method ?? "post",
        ref: action.props.ref ?? "",
        throwOnError: false,
      }),
    dispatch,
  );
}

const TYPEAHEAD_IDLE_MS = 800;

export function useTreeState({
  activeId: controlledActiveId,
  activePath,
  defaultExpanded,
  endpoint,
  componentRef,
  lazy,
  nodes,
  moveAction,
  rememberState,
  revision,
  selectAction,
  storageKey,
}: {
  activeId: string | null;
  activePath?: string[] | null;
  defaultExpanded: string[];
  endpoint: string | null;
  componentRef: string | null;
  lazy: boolean;
  nodes: TreeNodeData[];
  moveAction: Node<"action"> | null;
  rememberState: boolean;
  revision: string | number | null;
  selectAction: Node<"action"> | null;
  storageKey: string;
}): TreeContextValue {
  const [expanded, setExpanded] = usePersistentState<Set<string>>(
    storageKey,
    () => new Set(defaultExpanded),
    {
      enabled: rememberState,
      parse: parseExpanded,
      serialize: (value) => JSON.stringify([...value]),
    },
  );
  const [activeId, setActiveId] = useState<string | null>(controlledActiveId);
  const [focusedId, setFocusedId] = useState<string | null>(() => nodes[0]?.id ?? null);
  const [graph, setGraph] = useState(() => createGraph(nodes, !(lazy && nodes.length === 0)));
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const registryRef = useRef<Map<string, TreeItemRegistration>>(new Map());
  const typeAheadRef = useRef<{ text: string; timestamp: number }>({ text: "", timestamp: 0 });
  const inFlightRef = useRef<Map<string, Promise<void>>>(new Map());
  const graphRef = useRef(graph);
  const generationRef = useRef(0);
  const pendingFocusRef = useRef<string | null>(null);
  const selectionRef = useRef(0);
  const movingRef = useRef(false);
  const activeIdRef = useRef(activeId);
  const wireRef = useRef({ nodes, revision });
  const dispatch = useEffectDispatcher();
  graphRef.current = graph;
  activeIdRef.current = activeId;
  const canLoad = endpoint !== null && endpoint !== "";
  const canMove = moveAction !== null;

  useEffect(() => {
    selectionRef.current += 1;
    setActiveId(controlledActiveId);
  }, [controlledActiveId]);

  useEffect(() => {
    if (wireRef.current.nodes === nodes && wireRef.current.revision === revision) {
      return;
    }

    wireRef.current = { nodes, revision };
    generationRef.current += 1;
    inFlightRef.current.clear();
    const next = createGraph(nodes, !(lazy && nodes.length === 0));
    graphRef.current = next;
    setGraph(next);
    setLoading(new Set());
  }, [lazy, nodes, revision]);

  const toggle = useCallback(
    (id: string) => {
      setExpanded((current) => {
        const next = new Set(current);

        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }

        return next;
      });
    },
    [setExpanded],
  );

  const expand = useCallback(
    (id: string) => setExpanded((current) => new Set(current).add(id)),
    [setExpanded],
  );

  const activate = useCallback(
    (id: string) => {
      const previous = activeIdRef.current;
      const selection = ++selectionRef.current;
      activeIdRef.current = id;
      setActiveId(id);

      if (!selectAction) {
        return;
      }

      void runTreeAction(selectAction, { nodeId: id }, dispatch).then((accepted) => {
        if (!accepted && selectionRef.current === selection) {
          activeIdRef.current = previous;
          setActiveId(previous);
        }
      });
    },
    [dispatch, selectAction],
  );

  const focus = useCallback((id: string) => {
    setFocusedId(id);
    const entry = [...registryRef.current.values()].find((candidate) => candidate.id === id);

    if (entry?.ref.current) {
      pendingFocusRef.current = null;
      entry.ref.current.focus();
    } else {
      pendingFocusRef.current = id;
    }
  }, []);

  const register = useCallback((entry: TreeItemRegistration) => {
    registryRef.current.set(entry.path, entry);

    if (pendingFocusRef.current === entry.id) {
      pendingFocusRef.current = null;
      entry.ref.current?.focus();
    }
  }, []);

  const unregister = useCallback((path: string) => {
    registryRef.current.delete(path);
  }, []);

  const moveFocus = useCallback(
    (fromId: string, direction: TreeFocusDirection) => {
      const order = visibleOrder(registryRef.current);

      if (order.length === 0) {
        return;
      }

      const index = order.findIndex((entry) => entry.id === fromId);
      const current = index === -1 ? undefined : order[index];

      let target: TreeItemRegistration | undefined;

      switch (direction) {
        case "next":
          target = index === -1 ? undefined : order[index + 1];
          break;
        case "prev":
          target = index === -1 ? undefined : order[index - 1];
          break;
        case "first":
          target = order[0];
          break;
        case "last":
          target = order[order.length - 1];
          break;
        case "parent":
          target = current ? order.find((entry) => entry.path === current.parentPath) : undefined;
          break;
        case "firstChild":
          target = current ? order.find((entry) => entry.parentPath === current.path) : undefined;
          break;
      }

      if (target) {
        focus(target.id);
      }
    },
    [focus],
  );

  const typeAhead = useCallback(
    (fromId: string, character: string) => {
      const order = visibleOrder(registryRef.current);

      if (order.length === 0) {
        return;
      }

      const now = Date.now();
      const buffer = typeAheadRef.current;
      const text = now - buffer.timestamp > TYPEAHEAD_IDLE_MS ? character : buffer.text + character;
      typeAheadRef.current = { text, timestamp: now };

      const needle = text.toLowerCase();
      const startIndex = order.findIndex((entry) => entry.id === fromId);
      const start = startIndex === -1 ? 0 : startIndex;

      for (let offset = 1; offset <= order.length; offset++) {
        const candidate = order[(start + offset) % order.length];

        if (candidate.label.toLowerCase().startsWith(needle)) {
          focus(candidate.id);
          return;
        }
      }
    },
    [focus],
  );

  const loadChildren = useCallback(
    (id: string): Promise<void> => {
      if (!canLoad || graphRef.current.loaded.has(id)) {
        return Promise.resolve();
      }

      const currentRequest = inFlightRef.current.get(id);

      if (currentRequest) {
        return currentRequest;
      }

      const generation = generationRef.current;
      setLoading((current) => new Set(current).add(id));

      const request = apiJson<{ nodes: TreeNodeData[] }>(
        `${endpoint}?parent=${encodeURIComponent(id)}`,
        { ref: componentRef ?? "" },
      )
        .then(({ nodes: fetched }) => {
          if (generation !== generationRef.current) {
            return;
          }

          setGraph((current) => {
            const next = mergeChildren(current, id, fetched);
            graphRef.current = next;

            return next;
          });
        })
        .catch(() => {
          if (generation !== generationRef.current) {
            return;
          }

          setExpanded((current) => {
            const next = new Set(current);
            next.delete(id);

            return next;
          });
        })
        .finally(() => {
          if (generation !== generationRef.current) {
            return;
          }

          inFlightRef.current.delete(id);
          setLoading((current) => {
            const next = new Set(current);
            next.delete(id);

            return next;
          });
        });

      inFlightRef.current.set(id, request);

      return request;
    },
    [canLoad, componentRef, endpoint, setExpanded],
  );

  const childrenFor = useCallback(
    (id: string) => graph.children.get(id)?.map((childId) => graph.nodes.get(childId)!),
    [graph],
  );

  const childrenCount = useCallback(
    (id: string | null) => graphRef.current.children.get(id ?? ROOTS_KEY)?.length ?? 0,
    [],
  );

  const parentFor = useCallback((id: string) => graphRef.current.parents.get(id) ?? null, []);

  const positionFor = useCallback((id: string) => {
    const parentId = graphRef.current.parents.get(id) ?? null;

    return graphRef.current.children.get(parentId ?? ROOTS_KEY)?.indexOf(id) ?? -1;
  }, []);

  const canDropOn = useCallback((sourceId: string, targetId: string) => {
    const current = graphRef.current;
    const source = current.nodes.get(sourceId);
    const target = current.nodes.get(targetId);

    return Boolean(
      source &&
        target &&
        source.disabled !== true &&
        target.disabled !== true &&
        sourceId !== targetId &&
        !isDescendant(current, sourceId, targetId),
    );
  }, []);

  const move = useCallback(
    async (request: TreeMoveRequest): Promise<boolean> => {
      if (!moveAction || movingRef.current) {
        return false;
      }

      const previous = graphRef.current;
      const next = moveTreeNode(previous, request);

      if (!next) {
        return false;
      }

      const generation = generationRef.current;
      movingRef.current = true;
      graphRef.current = next;
      setGraph(next);
      setMoving(true);
      focus(request.nodeId);

      const accepted = await runTreeAction(moveAction, request, dispatch);

      if (!accepted && generation === generationRef.current) {
        graphRef.current = previous;
        setGraph(previous);
        focus(request.nodeId);
      }

      movingRef.current = false;
      setMoving(false);

      return accepted;
    },
    [dispatch, focus, moveAction],
  );

  const isLoading = useCallback((id: string) => loading.has(id), [loading]);

  const isLoaded = useCallback((id: string) => graphRef.current.loaded.has(id), []);

  useEffect(() => {
    if (lazy && !graph.loaded.has(ROOTS_KEY)) {
      void loadChildren(ROOTS_KEY);
    }
  }, [graph.loaded, lazy, loadChildren]);

  const firstRootId = graph.children.get(ROOTS_KEY)?.[0];

  useEffect(() => {
    if (focusedId === null && firstRootId !== undefined) {
      setFocusedId(firstRootId);
    }
  }, [focusedId, firstRootId]);

  useEffect(() => {
    if (!controlledActiveId || !activePath) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setExpanded((current) => new Set([...current, ...activePath]));

      for (const ancestorId of activePath) {
        await loadChildren(ancestorId);

        if (cancelled) {
          return;
        }
      }

      focus(controlledActiveId);
    })();

    return () => {
      cancelled = true;
    };
  }, [activePath, controlledActiveId, focus, loadChildren, setExpanded]);

  return useMemo(
    () => ({
      activate,
      activeId,
      canDropOn,
      canLoad,
      canMove,
      childrenCount,
      childrenFor,
      expand,
      expanded,
      focus,
      focusedId,
      isLoaded,
      isLoading,
      loadChildren,
      move,
      moveFocus,
      moving,
      parentFor,
      positionFor,
      register,
      toggle,
      typeAhead,
      unregister,
    }),
    [
      activate,
      activeId,
      canDropOn,
      canLoad,
      canMove,
      childrenCount,
      childrenFor,
      expand,
      expanded,
      focus,
      focusedId,
      isLoaded,
      isLoading,
      loadChildren,
      move,
      moveFocus,
      moving,
      parentFor,
      positionFor,
      register,
      toggle,
      typeAhead,
      unregister,
    ],
  );
}
