import { Genre, Lang, MAX_WORDS, Story, TARGET_WORDS } from "./config";

const API_URL = "https://api.mistral.ai/v1/chat/completions";
const MODEL = "mistral-small-latest";

const PROMPTS: Record<Lang, (genreLabel: string, topic: string) => string> = {
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

Answer ONLY with this exact format, nothing else:
TITRE: <story title, single line, no quotes>
HISTOIRE:
<the story text>`,
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

function parseStory(raw: string): Story {
  const normalized = raw.trim();
  const titleMatch = normalized.match(/^TITRE:\s*(.+)$/im);
  const bodyMatch = normalized.split(/^HISTOIRE:\s*$/im);
  if (!titleMatch || bodyMatch.length < 2 || !bodyMatch[1].trim()) {
    throw new StoryError(
      "Réponse inattendue du modèle. Réessaie, la génération a peut-être échoué."
    );
  }
  return {
    title: titleMatch[1].trim(),
    text: bodyMatch.slice(1).join("").trim(),
  };
}

export async function generateStory(params: {
  apiKey: string;
  lang: Lang;
  genre: Genre;
  genreLabel: string;
  topic: string;
}): Promise<Story> {
  const { apiKey, lang, genre, genreLabel, topic } = params;
  const prompt = PROMPTS[lang](genreLabel, topic);

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.9,
        max_tokens: 1400,
        messages: [
          { role: "system", content: prompt },
          {
            role: "user",
            content:
              lang === "fr"
                ? "Génère l'histoire maintenant, respecte strictement le format demandé."
                : "Generate the story now, strictly follow the requested format.",
          },
        ],
      }),
    });
  } catch {
    throw new StoryError("Connexion impossible. Vérifie ta connexion internet.");
  }

  if (response.status === 401) {
    throw new StoryError("Clé API invalide. Vérifie ta clé Mistral dans les réglages.");
  }
  if (response.status === 429) {
    throw new StoryError(
      "Limite d'utilisation atteinte. Attends un instant avant de réessayer."
    );
  }
  if (!response.ok) {
    throw new StoryError(
      `Erreur de l'API Mistral (code ${response.status}). Réessaie dans un instant.`
    );
  }

  const data = await response.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new StoryError("Le modèle n'a rien renvoyé. Réessaie.");
  }

  const story = parseStory(content);

  if (/^\s*TITRE\b/i.test(story.text)) {
    const reparsed = parseStory(story.text);
    return reparsed;
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
