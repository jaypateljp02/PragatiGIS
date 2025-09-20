import { Globe, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage, languages, LanguageCode } from "@/contexts/LanguageContext";

export default function LanguageSwitcher() {
  const { currentLanguage, setLanguage, isLoading } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="h-9 w-9"
          data-testid="button-language-switcher"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          <span className="sr-only">Switch language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        {Object.entries(languages).map(([code, language]) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLanguage(code as LanguageCode)}
            className={`cursor-pointer ${
              currentLanguage === code ? "bg-accent" : ""
            }`}
            data-testid={`language-option-${code}`}
            disabled={isLoading}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{language.name}</span>
                {currentLanguage === code && !isLoading && (
                  <Check className="h-3 w-3 text-green-600" />
                )}
                {currentLanguage === code && isLoading && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
              </div>
              <span className="text-sm text-muted-foreground ml-2">
                {language.nativeName}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}