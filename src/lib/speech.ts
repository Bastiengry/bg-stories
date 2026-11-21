import * as Speech from "expo-speech";
import { Lang } from "./config";

const CHUNK_MAX_CHARS = 600;

export type PlaybackState = "stopped" | "playing" | "paused";

export function pickVoice(lang: Lang): { language: string; rateMultiplier: number } {
  return lang === "fr" ? { language: "fr-FR", rateMultiplier: 1 } : { language: "en-US", rateMultiplier: 1 };
}

/**
 * Découpe le texte en morceaux (phrase par phrase, regroupées) pour contourner
 * les limites de longueur des moteurs de synthèse (Android limite à 4000 chars,
 * iOS peut couper les longs passages).
 */
export function splitIntoChunks(text: string): string[] {
  const paragraphs = text.split(/\n+/);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    const clean = paragraph.replace(/\s+/g, " ").trim();
    if (!clean) continue;
    if (clean.length <= CHUNK_MAX_CHARS) {
      chunks.push(clean);
      continue;
    }
    const sentences = clean.match(/[^.!?…]+[.!?…]+["»)]?\s*/g) ?? [clean];
    let current = "";
    for (const sentence of sentences) {
      if ((current + sentence).length > CHUNK_MAX_CHARS && current) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  }

  return chunks;
}

export class SpeechController {
  private chunks: string[] = [];
  private index = 0;
  private language = "fr-FR";
  private baseRate = 1;
  private userRate = 1;
  private state: PlaybackState = "stopped";
  private onStateChange: (state: PlaybackState) => void;

  constructor(onStateChange: (state: PlaybackState) => void) {
    this.onStateChange = onStateChange;
  }

  private setState(next: PlaybackState) {
    this.state = next;
    this.onStateChange(next);
  }

  private speakChunk(i: number, rate: number) {
    if (i >= this.chunks.length) {
      this.setState("stopped");
      this.index = 0;
      return;
    }
    this.index = i;
    Speech.speak(this.chunks[i], {
      language: this.language,
      rate: this.baseRate * this.userRate,
      pitch: 1,
      onDone: () => {
        if (this.state === "playing") this.speakChunk(i + 1, rate);
      },
      onError: () => {
        this.setState("stopped");
      },
    });
  }

  start(text: string, lang: Lang, userRate: number) {
    this.stop();
    const voice = pickVoice(lang);
    this.chunks = splitIntoChunks(text);
    this.language = voice.language;
    this.baseRate = voice.rateMultiplier;
    this.userRate = userRate;
    this.setState("playing");
    this.speakChunk(0, this.userRate);
  }

  private resumeFrom(index: number) {
    this.setState("playing");
    this.speakChunk(index, this.userRate);
  }

  pause() {
    if (this.state !== "playing") return;
    Speech.stop();
    this.pauseSavedIndex = this.index;
    this.setState("paused");
  }

  private pauseSavedIndex = 0;

  resume() {
    if (this.state !== "paused") return;
    this.resumeFrom(this.pauseSavedIndex);
  }

  stop() {
    Speech.stop();
    this.index = 0;
    this.pauseSavedIndex = 0;
    this.setState("stopped");
  }

  setRate(rate: number) {
    this.userRate = rate;
    if (this.state === "playing") {
      const wasPlayingIndex = this.index;
      Speech.stop();
      this.resumeFrom(wasPlayingIndex);
    }
  }

  getState(): PlaybackState {
    return this.state;
  }
}
