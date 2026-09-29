// Browser storage the screens share.
//
// The API has no "list conversations" or "list rooms" endpoint: the browser
// keeps the ids it created or opened, and every screen that shows those records
// reads the same keys. Keeping the keys and the rooms list in one module is what
// makes the chat, room and graph screens agree on the stored state.

export const CONVERSATION_STORAGE_KEY = "agentRuntimeConsoleConversationId";
export const SAVED_ROOMS_STORAGE_KEY = "agentRuntimeConsoleRooms";
export const ACTIVE_ROOM_STORAGE_KEY = "agentRuntimeConsoleRoomId";

export interface SavedRoom {
  id: string;
  name: string;
}

export function readSavedRooms(): SavedRoom[] {
  try {
    const saved: unknown = JSON.parse(
      window.localStorage.getItem(SAVED_ROOMS_STORAGE_KEY) ?? "[]",
    );
    if (Array.isArray(saved)) {
      return saved.filter(
        (item): item is SavedRoom =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as SavedRoom).id === "string" &&
          typeof (item as SavedRoom).name === "string",
      );
    }
  } catch {
    // A corrupt entry is treated as an empty list; rooms stay reachable
    // through ids this browser records from now on.
  }
  return [];
}

export function writeSavedRooms(rooms: SavedRoom[]): void {
  window.localStorage.setItem(SAVED_ROOMS_STORAGE_KEY, JSON.stringify(rooms));
}
