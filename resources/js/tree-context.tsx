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

    if (nested) {
      addChildren(graph, child.id, nested);
    }
  }
}

function createGraph(nodes: TreeNodeData[], rootsLoaded: boolean): TreeGraph {
  const graph: TreeGraph = { children: new Map(), loaded: new Set(), nodes: new Map() };

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
  };

  addChildren(next, parentId, children);

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
  canLoad: boolean;
  childrenFor: (id: string) => TreeNodeData[] | undefined;
  expanded: Set<string>;
  focus: (id: string) => void;
  focusedId: string | null;
  isLoading: (id: string) => boolean;
  loadChildren: (id: string) => Promise<void>;
  moveFocus: (fromId: string, direction: TreeFocusDirection) => void;
  register: (entry: TreeItemRegistration) => void;
  toggle: (id: string) => void;
  typeAhead: (fromId: string, character: string) => void;
  unregister: (path: string) => void;
};

const defaultTreeContext: TreeContextValue = {
  activate: () => {},
  activeId: null,
  canLoad: false,
  childrenFor: () => undefined,
  expanded: new Set(),
  focus: () => {},
  focusedId: null,
  isLoading: () => false,
  loadChildren: async () => {},
  moveFocus: () => {},
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
  const registryRef = useRef<Map<string, TreeItemRegistration>>(new Map());
  const typeAheadRef = useRef<{ text: string; timestamp: number }>({ text: "", timestamp: 0 });
  const inFlightRef = useRef<Map<string, Promise<void>>>(new Map());
  const graphRef = useRef(graph);
  const generationRef = useRef(0);
  const pendingFocusRef = useRef<string | null>(null);
  const selectionRef = useRef(0);
  const activeIdRef = useRef(activeId);
  const wireRef = useRef({ nodes, revision });
  const dispatch = useEffectDispatcher();
  graphRef.current = graph;
  activeIdRef.current = activeId;
  const canLoad = endpoint !== null && endpoint !== "";

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

  const isLoading = useCallback((id: string) => loading.has(id), [loading]);

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
      canLoad,
      childrenFor,
      expanded,
      focus,
      focusedId,
      isLoading,
      loadChildren,
      moveFocus,
      register,
      toggle,
      typeAhead,
      unregister,
    }),
    [
      activate,
      activeId,
      canLoad,
      childrenFor,
      expanded,
      focus,
      focusedId,
      isLoading,
      loadChildren,
      moveFocus,
      register,
      toggle,
      typeAhead,
      unregister,
    ],
  );
}
