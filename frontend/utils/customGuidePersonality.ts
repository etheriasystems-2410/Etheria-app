/**
 * Custom Guide personalities — created from scratch by the user, per slot.
 *
 * Storage (working first version, 2026-11-04): AsyncStorage on the device.
 * The backend has NO custom-personality storage today (it only stores
 * custom_guide_names). The frontend therefore:
 *   1. saves the personality locally (this module),
 *   2. sends it with every /spirit-guides/chat request (see spirit-guides.tsx),
 * and the backend route in this repo (backend/routes/spirit_guides.py) was
 * extended in the same change to honour `custom_personality` for custom
 * guides. Until that backend code is redeployed, a live server running the
 * old code will ignore the extra field and fall back to the generic
 * Male/Female Guide personality — that deployment gap is real and must
 * not be hidden from the user.
 *
 * Fields are free text only — deliberately no preset list, so the user
 * builds the personality from the ground up.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CustomGuideSlot = 'male' | 'female';

export interface CustomGuidePersonality {
  /** Free-text personality description / traits. */
  description: string;
  /** Free-text tone / style (e.g. "gentle, playful, direct"). */
  tone: string;
  /** Free-text "what the guide is like" — background, manner, what they help with. */
  about: string;
}

export const EMPTY_PERSONALITY: CustomGuidePersonality = {
  description: '',
  tone: '',
  about: '',
};

const keyFor = (slot: CustomGuideSlot) => `custom_guide_personality_${slot}`;

export function isPersonalityEmpty(p: CustomGuidePersonality | null | undefined): boolean {
  if (!p) return true;
  return !p.description.trim() && !p.tone.trim() && !p.about.trim();
}

/** Load one slot's saved personality, or null if none was saved. */
export async function loadCustomPersonality(
  slot: CustomGuideSlot,
): Promise<CustomGuidePersonality | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(slot));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CustomGuidePersonality>;
    const cleaned: CustomGuidePersonality = {
      description: (parsed.description || '').slice(0, 1000),
      tone: (parsed.tone || '').slice(0, 200),
      about: (parsed.about || '').slice(0, 2000),
    };
    return isPersonalityEmpty(cleaned) ? null : cleaned;
  } catch {
    return null;
  }
}

/** Save one slot's personality (empty => clears the saved personality). */
export async function saveCustomPersonality(
  slot: CustomGuideSlot,
  p: CustomGuidePersonality,
): Promise<void> {
  if (isPersonalityEmpty(p)) {
    await AsyncStorage.removeItem(keyFor(slot));
    return;
  }
  const cleaned: CustomGuidePersonality = {
    description: p.description.trim().slice(0, 1000),
    tone: p.tone.trim().slice(0, 200),
    about: p.about.trim().slice(0, 2000),
  };
  await AsyncStorage.setItem(keyFor(slot), JSON.stringify(cleaned));
}

/** Payload sent to /spirit-guides/chat — null when no custom personality exists. */
export function customPersonalityPayload(
  p: CustomGuidePersonality | null | undefined,
): CustomGuidePersonality | null {
  if (isPersonalityEmpty(p)) return null;
  return {
    description: p!.description.trim().slice(0, 1000),
    tone: p!.tone.trim().slice(0, 200),
    about: p!.about.trim().slice(0, 2000),
  };
}
