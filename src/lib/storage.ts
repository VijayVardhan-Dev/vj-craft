import type { StoredState } from "../types";

export const storage = {
  async get(): Promise<StoredState> {
    return chrome.storage.local.get(["draft", "entries", "profile", "topic"]);
  },
  async set(value: StoredState): Promise<void> {
    await chrome.storage.local.set(value);
  }
};

export async function runInActiveTab<T, A extends unknown[] = []>(func: (...args: A) => T, args?: A): Promise<T> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) {
    throw new Error("No active browser tab was found.");
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func,
    args
  });
  if (!result) {
    throw new Error("MentorPick did not return a result.");
  }
  if (result.result === undefined) {
    throw new Error("The page script returned no data.");
  }
  return result.result as T;
}
