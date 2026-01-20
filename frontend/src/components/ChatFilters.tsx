import { useLanguage } from "@/contexts/LanguageContext";

interface ChatFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export function ChatFilters({ activeFilter, onFilterChange }: ChatFiltersProps) {
  const { t } = useLanguage();

  const filters = [
    { id: "all", label: t('all') },
    { id: "popular", label: t('popular') },
    { id: "recent", label: t('recent') },
  ];
  return (
    <div className="flex items-center gap-2">
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={() => onFilterChange(filter.id)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
            activeFilter === filter.id
              ? "bg-primary text-primary-foreground shadow-soft"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
