import { UserHistoryItem } from '../types';

const HISTORY_KEY = 'qrvault_upload_history_v1';

export function getLocalHistory(): UserHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse local history:', err);
    return [];
  }
}

export function addLocalHistoryItem(item: UserHistoryItem) {
  try {
    const current = getLocalHistory();
    // remove duplicate if exists
    const filtered = current.filter((i) => i.id !== item.id);
    const updated = [item, ...filtered];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated.slice(0, 100))); // keep latest 100
  } catch (err) {
    console.error('Failed to save to history:', err);
  }
}

export function removeLocalHistoryItem(id: string) {
  try {
    const current = getLocalHistory();
    const updated = current.filter((i) => i.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to remove history item:', err);
  }
}
