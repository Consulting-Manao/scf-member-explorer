import { MoonIcon, SunIcon } from "lucide-react";

import { setTheme, useTheme } from "@/lib/theme";

import { Button } from "./ui/button";

export function ThemeToggle() {
  const theme = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
