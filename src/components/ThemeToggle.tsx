import { Moon, Sun } from "lucide-react";
import { useStore } from "@/store";
import { Button } from "./ui";

export function ThemeToggle() {
  const { theme, toggleTheme } = useStore();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      title={theme === "dark" ? "切换到浅色" : "切换到深色"}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  );
}
