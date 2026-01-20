import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

interface CreateChatDialogProps {
  onCreateChat: (data: { name: string; description: string }) => Promise<void>;
}

export function CreateChatDialog({ onCreateChat }: CreateChatDialogProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim() && !isLoading) {
      setIsLoading(true);
      try {
        await onCreateChat({ name: "", description: description.trim() });
        setDescription("");
        setOpen(false);
      } catch (error) {
        console.error('Failed to create chat:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="create" size="xl" className="gap-3">
          <Plus className="h-5 w-5" />
          {t('createChat')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('createPartner')}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Describe your ideal conversation partner. Their personality, role, and tone.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">{t('describePartner')}</Label>
            <Textarea
              id="description"
              placeholder={t('promptPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              variant="create"
              className="flex-1"
              disabled={!description.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                t('createPartner')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
