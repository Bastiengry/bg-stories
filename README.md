# BG Stories 📖🔊

Application mobile **Expo / React Native (TypeScript)** qui génère des petites histoires (français ou anglais) d'environ **5 minutes de lecture** (≤ 750 mots), avec **lecture vocale intégrée**.

## Fonctionnalités

- 🇫🇷 / 🇬🇧 Histoires en français ou en anglais
- 🏰 8 genres : conte, aventure, science-fiction, fantasy, humour, mystère, enfants, tranche de vie
- ✍️ Thème libre en option (ex. « un chat astronaute »)
- ⏱️ Longueur plafonnée (~650 mots visés, max 750 ≈ 5 min à voix haute)
- 🔊 Lecture vocale native via `expo-speech` (voix système du téléphone, gratuite)
- ⏸️ Pause / reprise / arrêt, vitesse 0.8× à 1.5×
- 🔐 Clé API Mistral stockée en sécurité avec `expo-secure-store`

## Installation

```bash
npm install
npx expo start
```

- **Test immédiat** : scanne le QR code avec l'app **Expo Go** (Android/iOS).
- **Android** : appuie sur `a` pour lancer un build.
- **iOS** : appuie sur `i` (macOS + Xcode requis).

## Configuration gratuite

L'app supporte plusieurs fournisseurs — sélectionne le tien dans l'app (par défaut : **Google Gemini**) :

| Fournisseur | Clé | Modèle | Gratuit ? |
|---|---|---|---|
| **Google Gemini** (recommandé, par défaut) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `gemini-2.0-flash` | ✅ Sans carte bancaire |
| **Groq** | [console.groq.com/keys](https://console.groq.com/keys) | `llama-3.3-70b-versatile` | ✅ Sans carte bancaire |
| **Mistral** | [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys) | `mistral-small-latest` | ❌ Facturation requise depuis nov. 2026 |

1. Crée une clé gratuite sur Google AI Studio (compte Google suffit, aucune carte).
2. Lance l'app → fournisseur Google Gemini → colle la clé → **Enregistrer la clé**. Elle est enregistrée en sécurité sur le téléphone.

> Note : le plan « Experiment » gratuit de Mistral ne permet plus de créer des clés API depuis novembre 2026 ; l'option Mistral reste disponible pour les comptes avec facturation activée.

| Composant | Service | Coût |
|---|---|---|
| Génération du texte | API au choix (Gemini par défaut) | Gratuit |
| Lecture vocale | `expo-speech` (moteur TTS du téléphone) | Gratuit |

## Structure

```
App.tsx                  → Interface principale (choix langue, genre, thème, lecture)
src/lib/config.ts        → Langues, genres, limites de longueur
src/lib/generate.ts      → Appels API multi-fournisseurs (Gemini / Groq / Mistral), prompt, parsing, garde-fous
src/lib/speech.ts        → Découpage du texte en morceaux + contrôleur de lecture vocabulaire
src/lib/storage.ts       → Stockage sécurisé de la clé API
```

## Notes techniques

- Le texte est découpé en morceaux de ~600 caractères avant synthèse pour contourner la limite Android (4000 caractères) et les coupures iOS.
- La pause/reprise de la voix système étant limitée, le contrôleur mémorise le morceau en cours et relit depuis celui-ci.
- Si le modèle dépasse la longueur, le texte est tronqué proprement à la fin de la dernière phrase complète.
