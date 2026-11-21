import { Genre, Lang, MAX_WORDS, TARGET_WORDS } from "./config";

export type ProviderId = "google" | "groq" | "mistral";

export interface ProviderDef {
  id: ProviderId;
  label: string;
  emoji: string;
  recommended?: boolean;
  free: boolean;
  keyUrl: string;
  fr: {
    hint: string;
    label: string;
  };
  en: {
    hint: string;
    label: string;
  };
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "google",
    label: "Google Gemini",
    emoji: "✨",
    recommended: true,
    free: true,
    keyUrl: "https://aistudio.google.com/apikey",
    fr: { hint: "Gratuit, sans carte bancaire. Crée une clé sur Google AI Studio.", label: "Ta clé Google AI Studio" },
    en: { hint: "Free, no credit card. Create a key on Google AI Studio.", label: "Your Google AI Studio key" },
  },
  {
    id: "groq",
    label: "Groq",
    emoji: "⚡",
    free: true,
    keyUrl: "https://console.groq.com/keys",
    fr: { hint: "Gratuit, sans carte bancaire. Crée une clé sur console.groq.com.", label: "Ta clé Groq" },
    en: { hint: "Free, no credit card. Create a key at console.groq.com.", label: "Your Groq key" },
  },
  {
    id: "mistral",
    label: "Mistral",
    emoji: "🇫🇷",
    free: false,
    keyUrl: "https://console.mistral.ai/api-keys",
    fr: { hint: "Nécessite maintenant une activation de facturation (pay-as-you-go).", label: "Ta clé Mistral" },
    en: { hint: "Requires billing activation (pay-as-you-go).", label: "Your Mistral key" },
  },
];

interface ApiConfig {
  urlForModel: (model: string) => string;
  models: string[];
  headers: (key: string) => Record<string, string>;
  extract: (data: unknown) => { text?: string; errorMessage?: string };
  invalidKeyStatuses: number[];
  modelUnavailable: (status: number, data: unknown) => boolean;
}

const SYSTEM_PROMPTS: Record<Lang, (genreLabel: string, topic: string) => string> = {
  fr: (genreLabel, topic) =>
    `Écris une courte histoire originale en français, dans le genre « ${genreLabel} »` +
    (topic.trim() ? `, sur le thème : ${topic.trim()}` : "") +
    `.

Contraintes impératives :
- Entre ${TARGET_WORDS / 2} et ${MAX_WORDS} mots (environ 5 minutes de lecture à voix haute).
- Découpe l'histoire en paragraphes courts, séparés par des lignes vides.
- Phrase d'accroche forte dès le début, chute satisfaisante à la fin.
- Style vivant et imagé, rythme soutenu, dialogues si le genre s'y prête.
- Aucun contenu violent ou inadapté aux enfants.

Réponds UNIQUEMENT avec ce format exact, rien d'autre :
TITRE: <titre de l'histoire, une seule ligne, sans guillemets>
HISTOIRE:
<le texte de l'histoire>`,
  en: (genreLabel, topic) =>
    `Write a short original story in English, in the "${genreLabel}" genre` +
    (topic.trim() ? `, about: ${topic.trim()}` : "") +
    `.

Hard constraints:
- Between ${TARGET_WORDS / 2} and ${MAX_WORDS} words (about 5 minutes of reading aloud).
- Split the story into short paragraphs separated by blank lines.
- Strong hook in the first sentence, satisfying ending.
- Vivid, lively style with steady pacing; dialogue where the genre allows it.
- No graphic violence or content unsuitable for children.

Answer ONLY with this format, nothing else:
TITRE: <story title, single line, no quotes>
HISTOIRE:
<the story text>`,
};

const nextUserMessage = (lang: Lang) =>
  lang === "fr"
    ? "Génère l'histoire maintenant, respecte strictement le format demandé."
    : "Generate the story now, strictly follow the requested format.";

const modelUnavailable = (status: number, data: any): boolean => {
  if (status === 404) return true;
  const message = String(data?.error?.message ?? data?.message ?? "").toLowerCase();
  return (
    status === 400 &&
    (message.includes("not found") ||
      message.includes("no longer available") ||
      message.includes("deprecat"))
  );
};

const APIS: Record<ProviderId, ApiConfig> = {
  google: {
    urlForModel: (model) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    models: ["gemini-3.5-flash-lite", "gemini-3.8-flash"],
    headers: (key) => ({ "Content-Type": "application/json", "x-goog-api-key": key }),
    extract: (data: any) => {
      const err = data?.error?.message;
      if (err) return { errorMessage: err };
      const text = data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text ?? "")
        .join("");
      return { text };
    },
    invalidKeyStatuses: [400, 401, 403],
    modelUnavailable,
  },
  groq: {
    urlForModel: () => "https://api.groq.com/openai/v1/chat/completions",
    models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
    headers: (key) => ({ "Content-Type": "application/json", Authorization: `Bearer ${key}` }),
    extract: (data: any) => {
      const err = data?.error?.message;
      if (err) return { errorMessage: err };
      return { text: data?.choices?.[0]?.message?.content };
    },
    invalidKeyStatuses: [401, 403],
    modelUnavailable,
  },
  mistral: {
    urlForModel: () => "https://api.mistral.ai/v1/chat/completions",
    models: ["mistral-small-latest"],
    headers: (key) => ({ "Content-Type": "application/json", Authorization: `Bearer ${key}` }),
    extract: (data: any) => {
      const err = data?.message || (typeof data === "string" ? data : undefined);
      if (err) return { errorMessage: err };
      return { text: data?.choices?.[0]?.message?.content };
    },
    invalidKeyStatuses: [401, 403],
    modelUnavailable,
  },
};

export class StoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryError";
  }
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function parseStory(raw: string): Story2 {
  const normalized = raw.trim();
  const titleMatch = normalized.match(/^TITRE:\s*(.+)$/im);
  const bodyParts = normalized.split(/^HISTOIRE:\s*$/im);
  if (!titleMatch || bodyParts.length < 2 || !bodyParts[1].trim()) {
    throw new StoryError(
      "Réponse inattendue du modèle. Réessaie, la génération a peut-être échoué."
    );
  }
  return {
    title: titleMatch[1].trim(),
    text: bodyParts.slice(1).join("").trim(),
  };
}

type Story2 = { title: string; text: string };

export interface Story {
  title: string;
  text: string;
}

function bodyForProvider(
  provider: ProviderId,
  model: string,
  systemPrompt: string,
  userMessage: string
): string {
  if (provider === "google") {
    return JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 4096 },
    });
  }
  if (provider === "groq") {
    return JSON.stringify({
      model,
      temperature: 0.9,
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
  }
  return JSON.stringify({
    model,
    temperature: 0.9,
    max_tokens: 1400,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });
}

export async function generateStory(params: {
  provider: ProviderId;
  apiKey: string;
  lang: Lang;
  genre: Genre;
  genreLabel: string;
  topic: string;
}): Promise<Story> {
  const { provider, apiKey, lang, genre, genreLabel, topic } = params;
  const api = APIS[provider];
  const systemPrompt = SYSTEM_PROMPTS[lang](genreLabel, topic);
  const userMessage = nextUserMessage(lang);

  let response: Response | null = null;
  let data: any = null;

  for (const model of api.models) {
    try {
      response = await fetch(api.urlForModel(model), {
        method: "POST",
        headers: api.headers(apiKey),
        body: bodyForProvider(provider, model, systemPrompt, userMessage),
      });
    } catch {
      throw new StoryError("Connexion impossible. Vérifie ta connexion internet.");
    }

    if (response.status === 429) {
      throw new StoryError(
        "Limite d'utilisation atteinte. Attends un instant avant de réessayer."
      );
    }

    try {
      data = await response.json();
    } catch {
      throw new StoryError(`Réponse illisible du service (code ${response.status}).`);
    }

    if (response.ok) break;
    if (api.modelUnavailable(response.status, data)) continue;
    if (api.invalidKeyStatuses.includes(response.status)) {
      throw new StoryError("Clé API invalide ou refusée. Vérifie ta clé dans les réglages.");
    }

    const extractResult = api.extract(data);
    throw new StoryError(
      extractResult.errorMessage
        ? `Erreur du fournisseur : ${extractResult.errorMessage}`
        : `Erreur de l'API (code ${response.status}). Réessaie dans un instant.`
    );
  }

  if (!response || !response.ok) {
    throw new StoryError(
      "Aucun modèle disponible pour ce fournisseur. Mets l'app à jour ou choisis un autre fournisseur."
    );
  }

  const extraction = api.extract(data);
  if (!extraction.text) {
    const blocked =
      data?.promptFeedback?.blockReason || data?.finishReason || data?.choices?.[0]?.finish_reason;
    throw new StoryError(
      blocked
        ? "La demande a été filtrée par le service. Modifie le thème et réessaie."
        : "Le modèle n'a rien renvoyé. Réessaie."
    );
  }

  let story: Story;
  try {
    story = parseStory(extraction.text);
  } catch (e) {
    if (e instanceof StoryError) throw e;
    throw new StoryError("Le modèle n'a pas respecté le format. Réessaie.");
  }

  if (/^\s*TITRE\b/i.test(story.text)) {
    story = parseStory(story.text);
  }

  const words = countWords(story.text);
  if (words > MAX_WORDS * 1.3) {
    const trimmed = story.text.split(/\s+/).slice(0, MAX_WORDS);
    const lastStop = trimmed.join(" ").match(/^(.*[.!?])[^.!?]*$/s);
    return { title: story.title, text: lastStop ? lastStop[1] : trimmed.join(" ") };
  }

  return story;
}

export function storyDurationMinutes(text: string): number {
  return countWords(text) / 150;
}
