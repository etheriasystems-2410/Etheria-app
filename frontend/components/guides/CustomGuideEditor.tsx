/**
 * CustomGuideEditor — build a Custom Guide's personality from scratch.
 *
 * One modal, one slot at a time (male / female, separately). Fields are
 * all free text — there is intentionally no preset list to pick from:
 *   - name (kept from the existing rename flow; saving a changed name
 *     goes through the same /custom-names endpoint as RenameModal)
 *   - personality description / traits
 *   - tone / style
 *   - what the guide is like
 *
 * RenameModal is left untouched; this editor is additive. Personality
 * itself is saved locally by the parent (AsyncStorage, see
 * utils/customGuidePersonality.ts); the name, if changed, is saved
 * through the backend custom-names endpoint by the parent.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { styles } from './styles';
import type { CustomGuidePersonality } from '../../utils/customGuidePersonality';

type Slot = 'male' | 'female';

export interface CustomGuideEditorDraft {
  name: string;
  personality: CustomGuidePersonality;
}

interface CustomGuideEditorProps {
  visible: boolean;
  slot: Slot | null;
  /** Current name for the slot (from customNames). */
  initialName: string;
  /** Saved personality for the slot, or null if none. */
  initialPersonality: CustomGuidePersonality | null;
  saving: boolean;
  onSave: (draft: CustomGuideEditorDraft) => void;
  onClose: () => void;
}

export default function CustomGuideEditor({
  visible,
  slot,
  initialName,
  initialPersonality,
  saving,
  onSave,
  onClose,
}: CustomGuideEditorProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialPersonality?.description ?? '');
  const [tone, setTone] = useState(initialPersonality?.tone ?? '');
  const [about, setAbout] = useState(initialPersonality?.about ?? '');

  // Reset the form every time a different slot / modal open is shown.
  useEffect(() => {
    if (visible) {
      setName(initialName);
      setDescription(initialPersonality?.description ?? '');
      setTone(initialPersonality?.tone ?? '');
      setAbout(initialPersonality?.about ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, slot]);

  const hasPersonality = Boolean(initialPersonality);
  const label = slot === 'male' ? 'masculine' : 'feminine';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.renameBackdrop}
      >
        <View style={styles.renameCard}>
          <Text style={styles.renameTitle}>
            {hasPersonality ? 'Edit' : 'Create'} your {label} guide
          </Text>
          <Text style={styles.renameSub}>
            Build this guide from scratch, in your own words — no preset list.
            What you write here is what your guide will answer as in chat.
            Saving all three personality fields empty clears the custom
            personality and returns the guide to its default voice.
          </Text>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.editorLabel}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={slot === 'male' ? 'Male Guide' : 'Female Guide'}
              placeholderTextColor="#7c6aa3"
              style={styles.renameInput}
              maxLength={32}
            />
            <Text style={styles.editorLabel}>Personality description / traits</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. warm, witty, patient, fiercely loyal, loves riddles…"
              placeholderTextColor="#7c6aa3"
              style={styles.editorInputMultiline}
              multiline
              maxLength={1000}
            />
            <Text style={styles.editorLabel}>Tone / style</Text>
            <TextInput
              value={tone}
              onChangeText={setTone}
              placeholder="e.g. gentle and playful, direct and grounding…"
              placeholderTextColor="#7c6aa3"
              style={styles.renameInput}
              maxLength={200}
            />
            <Text style={styles.editorLabel}>What is this guide like?</Text>
            <TextInput
              value={about}
              onChangeText={setAbout}
              placeholder="e.g. A travelling storyteller who… speaks in short, vivid images, helps with courage and grief, never rushes…"
              placeholderTextColor="#7c6aa3"
              style={styles.editorInputMultiline}
              multiline
              maxLength={2000}
            />
          </ScrollView>
          <View style={styles.renameButtons}>
            <TouchableOpacity
              style={[styles.renameBtn, styles.renameBtnGhost]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.renameBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.renameBtn, styles.renameBtnPrimary]}
              onPress={() =>
                onSave({
                  name: name.trim().slice(0, 32),
                  personality: {
                    description: description.trim(),
                    tone: tone.trim(),
                    about: about.trim(),
                  },
                })
              }
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#1a0033" />
              ) : (
                <Text style={styles.renameBtnPrimaryText}>Save Personality</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
