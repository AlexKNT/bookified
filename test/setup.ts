import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * The DOM project's setup file.
 *
 * `@testing-library/jest-dom/vitest` registers the matchers and their types in
 * one import. The rendered DOM is unmounted after each test by hand, because
 * Testing Library only registers that cleanup itself when the runner's globals
 * are enabled, and this project imports every helper explicitly instead.
 *
 * `next/image` cannot render without a running Next server, so it is replaced by
 * a plain image element; the substitute lives in its own module because a mock
 * factory is hoisted above this file's imports and so cannot use anything
 * imported here.
 */
vi.mock("next/image", () => import("./next-image"));

afterEach(() => {
  cleanup();
});
