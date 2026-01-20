import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

interface ChatCardProps {
  id: string;
  name: string;
  description: string;
  image: string;
  likes: number;
  onLike?: (id: string) => void;
}

export function ChatCard({
  id,
  name,
  description,
  image,
  likes,
  onLike,
}: ChatCardProps) {
  return (
    <Link
      to={`/chat/${id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-card shadow-card transition-all duration-300 hover:shadow-elevated hover:-translate-y-1"
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden">
        <img
          src={image}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <p className="mt-1 flex-1 text-sm text-muted-foreground line-clamp-2">{description}</p>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onLike?.(id);
            }}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors bg-muted text-muted-foreground hover:bg-muted/80"
          >
            <Heart className="h-3.5 w-3.5" />
            <span>{likes}</span>
          </button>
        </div>
      </div>
    </Link>
  );
}
