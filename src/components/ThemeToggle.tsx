import { Moon, Sun } from "lucide-react";
import { useStore } from "@/store";
import { useT } from "@/i18n";
import { Button } from "./ui";

export function ThemeToggle() {
  const { theme, toggleTheme } = useStore();
  const t = useT();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      title={theme === "dark" ? t("switchToLight") : t("switchToDark")}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  );
}
