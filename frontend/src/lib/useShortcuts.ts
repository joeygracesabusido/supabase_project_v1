import { useEffect } from "react";

export function useGlobalShortcuts(
  handlers: Record<string, (e: KeyboardEvent) => void>,
) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        if (e.key === "Escape") {
          handlers["Escape"]?.(e);
        }
        return;
      }
      const handler = handlers[e.key];
      if (handler) {
        handler(e);
      }
      if (e.key === "/") {
        const searchInput =
          document.querySelector<HTMLInputElement>("[data-search]");
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
