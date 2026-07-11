// Browser-only local persistence for identifying returning leaders and members.
// No auth — just remembers what this device created/submitted.

export type SavedSession = {
  leaderToken: string;
  memberToken: string;
  title: string;
  createdAt: string; // ISO
};

const SESSIONS_KEY = "hapjugak:my-sessions";
const MEMBER_KEY_PREFIX = "hapjugak:member:"; // + memberToken -> memberId

export function getSavedSessions(): SavedSession[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveSession(s: SavedSession) {
  if (typeof window === "undefined") return;
  const list = getSavedSessions().filter((x) => x.leaderToken !== s.leaderToken);
  list.unshift(s);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(list.slice(0, 20)));
}

export function removeSavedSession(leaderToken: string) {
  if (typeof window === "undefined") return;
  const list = getSavedSessions().filter((x) => x.leaderToken !== leaderToken);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
}

export function getMemberId(memberToken: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(MEMBER_KEY_PREFIX + memberToken);
}

export function saveMemberId(memberToken: string, memberId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MEMBER_KEY_PREFIX + memberToken, memberId);
}

export function clearMemberId(memberToken: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(MEMBER_KEY_PREFIX + memberToken);
}
