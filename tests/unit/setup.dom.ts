import { JSDOM } from "jsdom";

if (typeof document === "undefined") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  const globals = globalThis as Record<string, unknown>;
  globals.window = dom.window;
  globals.document = dom.window.document;
  globals.HTMLElement = dom.window.HTMLElement;
  globals.Node = dom.window.Node;
  globals.MutationObserver = dom.window.MutationObserver;
  globals.Event = dom.window.Event;
  globals.CustomEvent = dom.window.CustomEvent;
  globals.KeyboardEvent = dom.window.KeyboardEvent;
  globals.MouseEvent = dom.window.MouseEvent;
  globals.FocusEvent = dom.window.FocusEvent;
  globals.InputEvent = dom.window.InputEvent;
  globals.getComputedStyle = dom.window.getComputedStyle;
  globals.requestAnimationFrame = dom.window.requestAnimationFrame
    ? dom.window.requestAnimationFrame.bind(dom.window)
    : (cb: FrameRequestCallback) => setTimeout(cb, 0) as unknown as number;
  globals.cancelAnimationFrame = dom.window.cancelAnimationFrame
    ? dom.window.cancelAnimationFrame.bind(dom.window)
    : (id: number) => clearTimeout(id);
  globals.IS_REACT_ACT_ENVIRONMENT = true;

  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
}
