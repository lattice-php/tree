import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { vi } from "vitest";
import {
  RegistryContext,
  type ComponentPropsOf,
  type Node,
  type Registry,
  type Schema,
} from "@lattice-php/lattice/core";

/**
 * The slice of `@inertiajs/react` the tree renderer touches — `router.visit`
 * (Enter/Space on a linked node) and `Link` (an href label). Use inside a mock
 * factory: `vi.mock("@inertiajs/react", async () => (await import("./test-support")).inertiaMock())`.
 */
export function inertiaMock(): Record<string, unknown> {
  return {
    Link: ({ children, ...rest }: { children?: ReactNode }) => <a {...rest}>{children}</a>,
    router: {
      visit: vi.fn<(url: string, options?: unknown) => void>(),
    },
  };
}

/**
 * Renders `ui` with `registry` available to the core `<Renderer>` (used here to
 * render a node's trailing actions), mirroring what the app Provider does.
 */
export function renderWithRegistry(
  ui: ReactElement,
  registry: Registry,
  options?: RenderOptions,
): RenderResult {
  return render(
    <RegistryContext.Provider value={registry}>{ui}</RegistryContext.Provider>,
    options,
  );
}

/**
 * Build a node fixture with only the props a case cares about. The wire always
 * carries the full prop object, but the component defaults what is omitted, so
 * partial props are safe; prop names stay checked via `ComponentPropsOf`.
 */
export function fakeNode<TType extends string>(node: {
  type: TType;
  id?: string;
  key?: string;
  schema?: Schema;
  props?: Partial<ComponentPropsOf<TType>>;
}): Node<TType> {
  return node as unknown as Node<TType>;
}
