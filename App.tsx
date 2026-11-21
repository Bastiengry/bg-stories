import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import { GENRES, Genre, LANGS, Lang, Story } from "./src/lib/config";
import { StoryError, generateStory, storyDurationMinutes } from "./src/lib/mistral";
import { PlaybackState, SpeechController } from "./src/lib/speech";
import { clearApiKey, getApiKey, saveApiKey } from "./src/lib/storage";

const RATE_OPTIONS = [0.8, 1, 1.25, 1.5];

const LABELS = {
  fr: {
    headerTitle: "BG Stories",
    headerSubtitle: "Petites histoires, grandes émotions",
    apiTitle: "Ta clé API Mistral",
    apiHint:
      "Crée une clé gratuite sur console.mistral.ai, puis colle-la ici. Elle reste stockée en sécurité sur ton téléphone.",
    apiPlaceholder: "Colle ta clé API Mistral ici…",
    apiSave: "Enregistrer la clé",
    apiSaved: "Clé enregistrée ✓",
    apiChange: "Changer la clé",
    langTitle: "Langue",
    genreTitle: "Genre",
    topicTitle: "Thème (optionnel)",
    topicPlaceholder: "Ex : un chat astronaute, un phare maudit…",
    generate: "Générer l'histoire",
    generating: "Génération en cours…",
    listen: "▶  Écouter",
    pause: "⏸  Pause",
    resume: "▶  Reprendre",
    stop: "⏹  Arrêter",
    speed: "Vitesse",
    readingTime: "~{min} min de lecture",
    another: "🔄  Nouvelle histoire",
    errorTitle: "Oups",
  },
  en: {
    headerTitle: "BG Stories",
    headerSubtitle: "Short stories, big emotions",
    apiTitle: "Your Mistral API key",
    apiHint:
      "Create a free key at console.mistral.ai and paste it here. It stays safely stored on your phone.",
    apiPlaceholder: "Paste your Mistral API key here…",
    apiSave: "Save key",
    apiSaved: "Key saved ✓",
    apiChange: "Change key",
    langTitle: "Language",
    genreTitle: "Genre",
    topicTitle: "Topic (optional)",
    topicPlaceholder: "e.g. an astronaut cat, a cursed lighthouse…",
    generate: "Generate story",
    generating: "Generating…",
    listen: "▶  Listen",
    pause: "⏸  Pause",
    resume: "▶  Resume",
    stop: "⏹  Stop",
    speed: "Speed",
    readingTime: "~{min} min read",
    another: "🔄  New story",
    errorTitle: "Oops",
  },
} as const;

export default function App() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [lang, setLang] = useState<Lang>("fr");
  const [genre, setGenre] = useState<Genre>("conte");
  const [topic, setTopic] = useState("");
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>("stopped");
  const [rate, setRate] = useState(1);

  const speechRef = useRef<SpeechController | null>(null);
  if (!speechRef.current) {
    speechRef.current = new SpeechController(setPlayback);
  }
  const speech = speechRef.current;

  useEffect(() => {
    getApiKey().then((stored) => {
      if (stored) {
        setApiKey(stored);
        setHasStoredKey(true);
      }
    });
    return () => speech.stop();
  }, [speech]);

  const t = LABELS[lang];

  const handleGenerate = useCallback(async () => {
    if (!apiKey) {
      setError(lang === "fr" ? "Ajoute d'abord ta clé API Mistral." : "Add your Mistral API key first.");
      return;
    }
    setLoading(true);
    setError(null);
    speech.stop();
    setStory(null);
    try {
      const genreEntry = GENRES.find((g) => g.id === genre)!;
      const genreLabel = lang === "fr" ? genreEntry.labelFr : genreEntry.labelEn;
      const generated = await generateStory({ apiKey, lang, genre, genreLabel, topic });
      setStory(generated);
    } catch (e) {
      if (e instanceof StoryError) {
        setError(e.message);
      } else {
        setError(
          lang === "fr"
            ? "Une erreur inattendue est survenue. Réessaie."
            : "An unexpected error occurred. Try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [apiKey, genre, lang, speech, topic]);

  const handleListen = useCallback(() => {
    if (!story) return;
    if (playback === "paused") {
      speech.resume();
    } else {
      speech.start(story.text, lang, rate);
    }
  }, [lang, playback, rate, speech, story]);

  const handleRateChange = useCallback(
    (nextRate: number) => {
      setRate(nextRate);
      speech.setRate(nextRate);
    },
    [speech]
  );

  const handleSaveKey = useCallback(async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    await saveApiKey(trimmed);
    setApiKey(trimmed);
    setHasStoredKey(true);
    setApiKeyInput("");
    setError(null);
  }, [apiKeyInput]);

  const handleReset = useCallback(() => {
    speech.stop();
    setStory(null);
    setError(null);
  }, [speech]);

  const readingTime = story ? storyDurationMinutes(story.text) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t.headerTitle}</Text>
            <Text style={styles.headerSubtitle}>{t.headerSubtitle}</Text>
          </View>

          {!hasStoredKey && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t.apiTitle}</Text>
              <Text style={styles.hint}>{t.apiHint}</Text>
              <TextInput
                style={styles.input}
                value={apiKeyInput}
                onChangeText={setApiKeyInput}
                placeholder={t.apiPlaceholder}
                placeholderTextColor="#6b6b80"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                multiline={false}
              />
              <Pressable style={styles.primaryButton} onPress={handleSaveKey}>
                <Text style={styles.primaryButtonText}>{t.apiSave}</Text>
              </Pressable>
            </View>
          )}

          {hasStoredKey && (
            <Pressable onPress={() => setHasStoredKey(false)}>
              <Text style={styles.linkSmall}>
                {apiKeyInput ? t.apiSave : t.apiChange}
              </Text>
            </Pressable>
          )}

          {!hasStoredKey ? null : (
            <>
              <View style={styles.row}>
                <Text style={styles.sectionTitle}>{t.langTitle}</Text>
              </View>
              <View style={styles.chipRow}>
                {LANGS.map((l) => (
                  <Chip
                    key={l.id}
                    selected={lang === l.id}
                    label={`${l.flag} ${l.label}`}
                    onPress={() => setLang(l.id)}
                  />
                ))}
              </View>

              <View style={styles.row}>
                <Text style={styles.sectionTitle}>{t.genreTitle}</Text>
              </View>
              <View style={styles.chipWrap}>
                {GENRES.map((g) => (
                  <Chip
                    key={g.id}
                    selected={genre === g.id}
                    label={`${g.emoji} ${lang === "fr" ? g.labelFr : g.labelEn}`}
                    onPress={() => setGenre(g.id)}
                  />
                ))}
              </View>

              <View style={styles.row}>
                <Text style={styles.sectionTitle}>{t.topicTitle}</Text>
              </View>
              <TextInput
                style={styles.input}
                value={topic}
                onChangeText={setTopic}
                placeholder={t.topicPlaceholder}
                placeholderTextColor="#6b6b80"
              />

              <Pressable
                style={[styles.primaryButton, loading && styles.disabled]}
                onPress={handleGenerate}
                disabled={loading}
              >
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.primaryButtonText}>{t.generating}</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {story ? t.another : t.generate}
                  </Text>
                )}
              </Pressable>
            </>
          )}

          {error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>{t.errorTitle}</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {story && (
            <View style={styles.storyCard}>
              <Text style={styles.storyTitle}>{story.title}</Text>
              <Text style={styles.readingTime}>
                {t.readingTime.replace("{min}", Math.max(1, Math.round(readingTime)).toString())}
              </Text>

              {playback === "stopped" ? (
                <Pressable style={styles.primaryButton} onPress={handleListen}>
                  <Text style={styles.primaryButtonText}>{t.listen}</Text>
                </Pressable>
              ) : (
                <View style={styles.playbackRow}>
                  <Pressable style={styles.secondaryButton} onPress={handleListen}>
                    <Text style={styles.secondaryButtonText}>
                      {playback === "paused" ? t.resume : t.pause}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => speech.stop()}
                  >
                    <Text style={styles.secondaryButtonText}>{t.stop}</Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.speedRow}>
                <Text style={styles.speedLabel}>{t.speed}</Text>
                {RATE_OPTIONS.map((r) => (
                  <Chip
                    key={r}
                    selected={rate === r}
                    label={`${r}×`}
                    onPress={() => handleRateChange(r)}
                  />
                ))}
              </View>

              {story.text.split(/\n+/).map((paragraph, i) => (
                <Text key={i} style={styles.paragraph}>
                  {paragraph.trim()}
                </Text>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Chip(props: { selected: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.chip, props.selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, props.selected && styles.chipTextSelected]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#101018" },
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48, gap: 14 },
  header: { marginTop: 8, marginBottom: 8, alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 30, fontWeight: "800" },
  headerSubtitle: { color: "#9a9ab0", fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: "#1b1b28",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  hint: { color: "#9a9ab0", fontSize: 13, lineHeight: 18 },
  row: { marginTop: 6 },
  sectionTitle: { color: "#c9c9dd", fontSize: 15, fontWeight: "600" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3a3a52",
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#1b1b28",
  },
  chipSelected: { borderColor: "#7c5cff", backgroundColor: "#2a2350" },
  chipText: { color: "#c9c9dd", fontSize: 14 },
  chipTextSelected: { color: "#fff", fontWeight: "700" },
  input: {
    backgroundColor: "#1b1b28",
    borderColor: "#3a3a52",
    borderRadius: 12,
    borderWidth: 1,
    color: "#fff",
    padding: 12,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: "#7c5cff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  linkSmall: { color: "#7c5cff", textAlign: "right", fontSize: 13 },
  errorCard: {
    backgroundColor: "#3a1f2b",
    borderColor: "#a04060",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  errorTitle: { color: "#ff8fae", fontWeight: "700", fontSize: 15 },
  errorText: { color: "#f0c6d4", fontSize: 14, lineHeight: 20 },
  storyCard: {
    backgroundColor: "#1b1b28",
    borderRadius: 18,
    padding: 18,
    gap: 12,
    marginTop: 10,
  },
  storyTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  readingTime: { color: "#7c8cff", fontSize: 13, fontWeight: "600" },
  playbackRow: { flexDirection: "row", gap: 10 },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#2a2a40",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#e6e6f2", fontSize: 15, fontWeight: "600" },
  speedRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  speedLabel: { color: "#9a9ab0", fontSize: 13, marginRight: 2 },
  paragraph: { color: "#e6e6f2", fontSize: 16, lineHeight: 25 },
});
