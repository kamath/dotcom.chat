"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";

interface GitHubStarsProps {
  owner: string;
  repo: string;
}

export function GitHubStars({ owner, repo }: GitHubStarsProps) {
  const [starCount, setStarCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchStarCount() {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}`
        );
        if (response.ok) {
          const data = await response.json();
          setStarCount(data.stargazers_count);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchStarCount();
  }, [owner, repo]);

  if (loading) {
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Star className="h-3 w-3" />
        <span>...</span>
      </Badge>
    );
  }

  if (error || starCount === null) {
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Star className="h-3 w-3" />
        <span>-</span>
      </Badge>
    );
  }

  return (
    <a
      href={`https://github.com/${owner}/${repo}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block hover:opacity-80 transition-opacity"
    >
      <Badge variant="outline" className="flex items-center gap-1">
        <Star className="h-3 w-3" />
        <span>{starCount.toLocaleString()}</span>
      </Badge>
    </a>
  );
}
