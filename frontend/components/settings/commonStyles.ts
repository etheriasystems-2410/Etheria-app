/**
 * Shared styles used across multiple settings sub-components.
 * Co-locating these keeps the per-component style blocks small.
 */
import { StyleSheet } from 'react-native';

export const commonStyles = StyleSheet.create({
  section: { paddingHorizontal: 12, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#e9d5ff', marginBottom: 12 },

  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  settingText: { flex: 1, fontSize: 16, color: '#e9d5ff', marginLeft: 12 },
  settingTextContainer: { flex: 1, marginLeft: 12 },
  settingSubtext: { fontSize: 12, color: '#9f7aea', marginTop: 2 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#e9d5ff' },
  modalScrollContent: { paddingHorizontal: 20, paddingVertical: 16 },

  cancelButton: {
    paddingVertical: 14,
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(45, 27, 78, 0.5)',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 16, color: '#9f7aea', fontWeight: '600' },

  emailModalContent: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  emailModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginTop: 16,
  },
  emailModalAddress: {
    fontSize: 18,
    color: '#a855f7',
    marginTop: 8,
    fontWeight: '600',
  },
  emailModalHint: {
    fontSize: 14,
    color: '#9f7aea',
    marginTop: 8,
    textAlign: 'center',
  },
  emailOpenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  emailOpenButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
});
