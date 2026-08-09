// Tracks which conference is currently active for each screen, independent of
// any single socket's lifecycle or of whether the call was ended through the
// Socket.IO path or the REST API. Shared between the Socket.IO handlers in
// index.ts (which populate/consult it for reconnect replay) and the REST
// video-conference controller (whose /end endpoint must also clear it —
// otherwise a call ended from the dashboard never reaches a display that
// only listens for the replayed conference:initiated on reconnect).
export const activeConferences = new Map<string, any>();

export function setActiveConference(screenId: string, data: any) {
  activeConferences.set(screenId, data);
}

export function clearActiveConference(screenId: string) {
  activeConferences.delete(screenId);
}

/** Clears every screen currently tracked as being in the given conference, returning their ids. */
export function clearActiveConferencesForConference(conferenceId: string): string[] {
  const clearedScreenIds: string[] = [];
  for (const [screenId, data] of activeConferences.entries()) {
    if (data?.conferenceId === conferenceId) {
      activeConferences.delete(screenId);
      clearedScreenIds.push(screenId);
    }
  }
  return clearedScreenIds;
}
