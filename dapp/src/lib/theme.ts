import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const root = document.documentElement;

function current(): Theme {
  return root.classList.contains("dark") ? "dark" : "light";
}

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** The theme applied on the document, set by `index.html` before render. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, current, () => "light");
}

export function setTheme(theme: Theme) {
  root.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // storage may be unavailable
  }
}
