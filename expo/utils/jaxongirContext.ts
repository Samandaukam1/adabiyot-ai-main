export interface BookContext {
  id: string;
  title: string;
  author?: string;
  description?: string;
  genre?: string;
}

export interface JaxongirAIContext {
  currentScreen: string;
  promptContext: string;
  relatedContentType: string | null;
  relatedContentId: string | null;
  currentBook: BookContext | null;
}

// Maps expo-router pathname to Jaxongir AI context
export function getContextFromPath(pathname: string): JaxongirAIContext {
  // Home tab
  if (pathname === "/" || pathname === "/index" || pathname === "/(tabs)" || pathname === "/(tabs)/index") {
    return { currentScreen: "home", promptContext: "app_intro", relatedContentType: null, relatedContentId: null, currentBook: null };
  }
  // Book detail
  const bookMatch = pathname.match(/^\/book\/([^/]+)/);
  if (bookMatch) {
    return { currentScreen: "book_detail", promptContext: "book_help", relatedContentType: "book", relatedContentId: bookMatch[1], currentBook: null };
  }
  // Reader screens
  const readerMatch = pathname.match(/^\/(reader|book-reader|rich-reader)\/([^/]+)/);
  if (readerMatch) {
    return { currentScreen: "reader", promptContext: "book_help", relatedContentType: "book", relatedContentId: readerMatch[2], currentBook: null };
  }
  // Audio
  if (pathname.startsWith("/audio/")) {
    return { currentScreen: "audio", promptContext: "book_help", relatedContentType: "book", relatedContentId: pathname.split("/")[2] ?? null, currentBook: null };
  }
  // Poem
  if (pathname.startsWith("/poem/")) {
    return { currentScreen: "poem", promptContext: "book_help", relatedContentType: "poem", relatedContentId: pathname.split("/")[2] ?? null, currentBook: null };
  }
  // Screenplay
  if (pathname.startsWith("/screenplay/")) {
    return { currentScreen: "screenplay", promptContext: "book_help", relatedContentType: "screenplay", relatedContentId: pathname.split("/")[2] ?? null, currentBook: null };
  }
  // So'zLab tab
  if (pathname.includes("sozlab")) {
    return { currentScreen: "sozlab", promptContext: "global", relatedContentType: null, relatedContentId: null, currentBook: null };
  }
  // Tokcha tab
  if (pathname.includes("tokcha") || pathname.includes("library")) {
    return { currentScreen: "tokcha", promptContext: "global", relatedContentType: null, relatedContentId: null, currentBook: null };
  }
  // Profile / settings
  if (pathname.includes("profile")) {
    return { currentScreen: "profile", promptContext: "settings_help", relatedContentType: null, relatedContentId: null, currentBook: null };
  }
  // Reels
  if (pathname.includes("reels")) {
    return { currentScreen: "reels", promptContext: "global", relatedContentType: null, relatedContentId: null, currentBook: null };
  }
  // Author
  if (pathname.startsWith("/author/")) {
    return { currentScreen: "author", promptContext: "book_help", relatedContentType: "author", relatedContentId: pathname.split("/")[2] ?? null, currentBook: null };
  }

  return { currentScreen: "unknown", promptContext: "global", relatedContentType: null, relatedContentId: null, currentBook: null };
}
