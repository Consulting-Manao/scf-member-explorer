import { MoonIcon, SunIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "./ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => {
        const next = !dark;
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem("theme", next ? "dark" : "light");
        } catch {
          // ignore
        }
        setDark(next);
      }}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
