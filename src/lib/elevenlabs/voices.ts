/**
 * ElevenLabs preset voice library.
 * Voice IDs are ElevenLabs Premade Voices — available on all plans.
 * Agents can preview and select any of these from the Secretary settings page.
 */
export type PresetVoice = {
  id: string;
  name: string;
  gender: "female" | "male";
  tone: string;          // Short descriptor shown in the UI
  description: string;   // Longer copy for the settings selector
};

export const PRESET_VOICES: PresetVoice[] = [
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    gender: "female",
    tone: "Calm & professional",
    description: "Warm, measured female voice. Great for professional real estate calls.",
  },
  {
    id: "AZnzlk1XvdvUeBnXmlld",
    name: "Domi",
    gender: "female",
    tone: "Strong & confident",
    description: "Bold, confident female voice with a clear presence on the phone.",
  },
  {
    id: "jsCqWAovK2LkecY7zXl4",
    name: "Freya",
    gender: "female",
    tone: "Energetic & approachable",
    description: "Bright and approachable female voice that puts callers at ease.",
  },
  {
    id: "oWAxZDx7w5VEj9dCyTzz",
    name: "Grace",
    gender: "female",
    tone: "Polished & trustworthy",
    description: "Polished female voice with a trustworthy, conversational style.",
  },
  {
    id: "29vD33N1CtxCmqQRPOHJ",
    name: "Drew",
    gender: "male",
    tone: "Conversational & natural",
    description: "Natural, well-rounded male voice suited for friendly lead intake.",
  },
  {
    id: "nPczCjzI2devNBz1zQrb",
    name: "Brian",
    gender: "male",
    tone: "Professional & authoritative",
    description: "Deep, authoritative male voice that instills confidence.",
  },
  {
    id: "CYw3kZ74U7U0k1aWqBeE",
    name: "Dave",
    gender: "male",
    tone: "Warm & easygoing",
    description: "Friendly British-accented male voice with a warm, easygoing delivery.",
  },
  {
    id: "2EiwWnXFnvU5JabPnv8n",
    name: "Clyde",
    gender: "male",
    tone: "Steady & grounded",
    description: "Steady, grounded male voice that sounds trustworthy and calm under pressure.",
  },
];

export const DEFAULT_VOICE_ID = PRESET_VOICES[0].id; // Rachel

export function findPresetVoice(voiceId: string): PresetVoice | null {
  return PRESET_VOICES.find((v) => v.id === voiceId) ?? null;
}
