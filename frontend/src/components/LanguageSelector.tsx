import { Globe, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const languages = [
  { code: "en" as const, name: "English", flag: "🇺🇸" },
  { code: "es" as const, name: "Español", flag: "🇪🇸" },
  { code: "ru" as const, name: "Русский", flag: "🇷🇺" },
  { code: "fr" as const, name: "Français", flag: "🇫🇷" },
  { code: "de" as const, name: "Deutsch", flag: "🇩🇪" },
  { code: "ja" as const, name: "日本語", flag: "🇯🇵" },
  { code: "zh" as const, name: "中文", flag: "🇨🇳" },
];

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  const selectedLanguage = languages.find(lang => lang.code === language) || languages[0];

  const handleSelect = (code: typeof language) => {
    setLanguage(code);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{selectedLanguage.name}</span>
          <span className="sm:hidden">{selectedLanguage.flag}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 bg-card">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            className={language === lang.code ? "bg-accent" : ""}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
