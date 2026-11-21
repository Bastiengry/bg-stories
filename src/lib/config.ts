export type Lang = "fr" | "en";

export const LANGS: { id: Lang; label: string; flag: string; voiceHint: string }[] = [
  { id: "fr", label: "Français", flag: "🇫🇷", voiceHint: "fr-FR" },
  { id: "en", label: "English", flag: "🇬🇧", voiceHint: "en-US" },
];

export type Genre =
  | "conte"
  | "aventure"
  | "sf"
  | "fantasy"
  | "humour"
  | "mystere"
  | "enfants"
  | "tranche-de-vie";

export const GENRES: { id: Genre; labelFr: string; labelEn: string; emoji: string }[] = [
  { id: "conte", labelFr: "Conte", labelEn: "Fairy tale", emoji: "🏰" },
  { id: "aventure", labelFr: "Aventure", labelEn: "Adventure", emoji: "🗺️" },
  { id: "sf", labelFr: "Science-fiction", labelEn: "Sci-fi", emoji: "🚀" },
  { id: "fantasy", labelFr: "Fantasy", labelEn: "Fantasy", emoji: "🐉" },
  { id: "humour", labelFr: "Humour", labelEn: "Humor", emoji: "😄" },
  { id: "mystere", labelFr: "Mystère", labelEn: "Mystery", emoji: "🔍" },
  { id: "enfants", labelFr: "Pour enfants", labelEn: "For kids", emoji: "🧸" },
  { id: "tranche-de-vie", labelFr: "Tranche de vie", labelEn: "Slice of life", emoji: "☕" },
];

export interface Story {
  title: string;
  text: string;
}

export const MAX_WORDS = 750;
export const TARGET_WORDS = 650;
