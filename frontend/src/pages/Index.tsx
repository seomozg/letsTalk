import { useState, useMemo, useEffect } from "react";
import { Header } from "@/components/Header";
import { ChatCard } from "@/components/ChatCard";
import { ChatFilters } from "@/components/ChatFilters";
import { CreateChatDialog } from "@/components/CreateChatDialog";
import { api, Chat } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface ChatPartner {
  id: string;
  prompt: string;
  voice: string;
  image: string;
  likes: number;
}

// Helper to extract name from prompt
const getNameFromPrompt = (prompt: string): string => {
  const firstSentence = prompt.split('.')[0];
  return firstSentence.length > 20 ? firstSentence.substring(0, 20) + '...' : firstSentence;
};

export default function Index() {
  const [partners, setPartners] = useState<ChatPartner[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      const chats = await api.getChats();
      const partnersList = Object.entries(chats)
        .filter(([id]) => id !== 'default')
        .map(([id, chat]) => ({
          id,
          prompt: chat.prompt,
          voice: chat.voice,
          image: chat.image_url || '/static/placeholder.svg',
          likes: chat.likes,
        }));
      setPartners(partnersList);
    } catch (error) {
      console.error('Failed to load chats:', error);
      toast({
        title: "Error",
        description: t('failedToLoad'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPartners = useMemo(() => {
    let result = [...partners];

    switch (activeFilter) {
      case "popular":
        result.sort((a, b) => b.likes - a.likes);
        break;
      default:
        break;
    }

    return result;
  }, [partners, activeFilter]);

  const handleLikeChat = async (id: string) => {
    try {
      const response = await api.likeChat({ chat_id: id });
      setPartners((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, likes: response.likes } : p
        )
      );
    } catch (error) {
      console.error('Failed to like chat:', error);
      toast({
        title: "Error",
        description: t('failedToLike'),
        variant: "destructive",
      });
    }
  };

  const handleCreateChat = async (data: { name: string; description: string }) => {
    try {
      const prompt = data.description;
      await api.createChat({ prompt });
      // Reload chats to get the new one
      await loadChats();
      toast({
        title: "Success",
        description: t('conversationCreated'),
      });
    } catch (error) {
      console.error('Failed to create chat:', error);
      toast({
        title: "Error",
        description: t('failedToCreate'),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {t('heroTitle')},
            <br />
            <span className="text-primary">{t('heroTitleSuffix')}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            {t('heroSubtitle')}
          </p>

          {/* Create New Chat */}
          <div className="mt-8">
            <CreateChatDialog onCreateChat={handleCreateChat} />
          </div>
        </section>

        {/* Filters */}
        <section className="mb-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <h2 className="text-xl font-semibold text-foreground">{t('conversationsTitle')}</h2>
            <ChatFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} />
          </div>
        </section>

        {/* Chat Cards Grid */}
        <section>
          {filteredPartners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <svg
                  className="h-8 w-8 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-foreground">{t('noConversations')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('noConversationsDesc')}</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredPartners.map((partner, index) => (
                <div
                  key={partner.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <ChatCard
                    id={partner.id}
                    name={getNameFromPrompt(partner.prompt)}
                    description={partner.prompt}
                    image={partner.image}
                    likes={partner.likes}
                    onLike={handleLikeChat}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
