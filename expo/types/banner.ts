export type BannerActionType =
  | "link"
  | "book"
  | "article"
  | "poem"
  | "screenplay"
  | "reel"
  | "author"
  | "publisher"
  | "category"
  | "tokcha"
  | "none";

export interface MobileHomeBanner {
  id: string;
  badge_text: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  button_text: string | null;
  button_action_type: BannerActionType;
  button_link: string | null;
  related_content_type: string | null;
  related_content_id: string | null;
  image_url: string | null;
  background_color: string | null;
  text_color: string | null;
  button_bg_color: string | null;
  button_text_color: string | null;
  enable_glow: boolean;
  glow_primary_color: string | null;
  glow_secondary_color: string | null;
  sort_order: number;
  created_at: string;
  views_count: number;
  clicks_count: number;
}

export interface MobileTokchaBanner {
  id: string;
  image_url: string | null;
  button_action_type: BannerActionType | null;
  button_link: string | null;
  related_content_type: string | null;
  related_content_id: string | null;
  enable_glow: boolean | null;
  glow_primary_color: string | null;
  glow_secondary_color: string | null;
  sort_order: number | null;
  created_at?: string | null;
  views_count?: number | null;
  clicks_count?: number | null;
}
