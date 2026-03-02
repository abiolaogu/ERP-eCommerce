import { render } from "@testing-library/react";
import App from "./App";
import { describe, expect, it } from "vitest";
import { BrowserRouter } from "react-router-dom";

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

describe("App", () => {
  it("renders within router context", () => {
    const { container } = render(
      <BrowserRouter future={routerFuture}>
        <App />
      </BrowserRouter>,
    );
    expect(container).toBeTruthy();
  });
});
