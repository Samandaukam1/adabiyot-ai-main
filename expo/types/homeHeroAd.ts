export type HomeHeroAdMediaType = "image" | "video";
export type HomeHeroAdTargetType =
  | "internal"
  | "external"
  | "none"
  | "book"
  | "poem"
  | "article"
  | "screenplay"
  | "marathon"
  | "application";

export interface HomeHeroAd {
  id: string;
  title: string | null;
  subtitle: string | null;
  media_type: HomeHeroAdMediaType;
  image_url: string | null;
  video_url: string | null;
  poster_url: string | null;
  thumbnail_url?: string | null;
  button_text: string | null;
  target_type: HomeHeroAdTargetType;
  anchor_link: string | null;
  is_hidden_by_default?: boolean | null;
  sort_order: number | null;
  created_at?: string | null;
}
