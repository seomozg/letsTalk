import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { api, Chat } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface CharacterRow {
  id: string;
  data: Chat;
}

const getNameFromPrompt = (prompt: string): string => {
  const firstSentence = prompt.split('.')[0];
  return firstSentence.length > 30 ? `${firstSentence.substring(0, 30)}...` : firstSentence;
};

export default function ManageCharacters() {
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    try {
      const chats = await api.getChats();
      const rows = Object.entries(chats)
        .filter(([id]) => id !== "default")
        .map(([id, data]) => ({ id, data }));
      setCharacters(rows);
    } catch (error) {
      console.error("Failed to load characters", error);
      toast({
        title: t("errorTitle"),
        description: t("failedToLoadCharacters"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      const response = await api.deleteCharacter({ chat_id: id });
      if (!response.success) {
        throw new Error("Delete failed");
      }
      setCharacters((prev) => prev.filter((item) => item.id !== id));
      toast({
        title: t("characterDeleted"),
        description: t("characterDeletedDesc"),
      });
    } catch (error) {
      console.error("Failed to delete character", error);
      toast({
        title: t("errorTitle"),
        description: t("failedToDeleteCharacter"),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("manageCharactersTitle")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("manageCharactersSubtitle")}</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            {t("backToHome")}
          </Button>
        </div>

        {loading ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            {t("loadingCharacters")}
          </div>
        ) : characters.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <h2 className="text-lg font-semibold text-foreground">{t("noCharactersTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("noCharactersDesc")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {characters.map((character) => (
              <div
                key={character.id}
                className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={character.data.image_url || "/static/placeholder.svg"}
                    alt={getNameFromPrompt(character.data.prompt)}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      {getNameFromPrompt(character.data.prompt)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {character.data.prompt}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("voiceLabel")}: {character.data.voice}
                    </p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(character.id)}
                  disabled={deletingId === character.id}
                >
                  {deletingId === character.id ? t("deleting") : t("deleteCharacter")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}