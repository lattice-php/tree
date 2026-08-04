import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

vi.mock("@lattice-php/lattice/dnd", () => ({
  announce: vi.fn(),
  attachTreeItemInstruction: (data: Record<string, unknown>) => data,
  combine:
    (...cleanups: Array<() => void>) =>
    () =>
      cleanups.forEach((cleanup) => cleanup()),
  draggable: vi.fn(() => () => {}),
  dropTargetForElements: vi.fn(() => () => {}),
  extractTreeItemInstruction: (data: Record<string, unknown>) => data.instruction ?? null,
}));

configure({ testIdAttribute: "data-test" });

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    disconnect() {}

    observe() {}

    unobserve() {}
  };
}

afterEach(() => {
  cleanup();
});
