"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { SwapIcon } from "@/components/ui/swap-icon";

const STORAGE_KEY = "theme";

type Theme = "dark" | "light";

/** The theme lives on the html element, so the toggle reads it from there. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return (): void => observer.disconnect();
}

function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Dark is the default; the choice is remembered when storage is available. */
export function ThemeToggle(): ReactElement {
  const theme = useSyncExternalStore<Theme>(subscribe, currentTheme, (): Theme => "dark");

  function toggle(): void {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private windows can block storage; the theme still changes for this visit.
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggle}
      className="size-10 md:size-8"
    >
      <SwapIcon swapped={theme === "light"} from={<SunIcon className="size-4" />} to={<MoonIcon className="size-4" />} />
    </Button>
  );
}

/** Runs before first paint so the page never flashes the wrong theme. */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem("${STORAGE_KEY}")!=="light"){document.documentElement.classList.add("dark")}if(localStorage.getItem("motion")==="off"){document.documentElement.dataset.motion="off"}}catch(e){document.documentElement.classList.add("dark")}`;
