// Utility functions for schedule aggregation.
// Slot unit = 1 hour. All times are UTC ISO strings from DB; we work in local time for display.

export type EventRow = {
  id: string;
  member_id: string;
  title: string;
  start_at: string; // ISO
  end_at: string;   // ISO
  all_day: boolean;
  recurrence: string; // 'none' | 'weekly'
  recurrence_until: string | null; // YYYY-MM-DD
};

export type MemberRow = { id: string; name: string; submitted_at: string };

export type SessionRow = {
  id: string;
  leader_token: string;
  member_token: string;
  title: string;
  deadline: string;
  range_start: string; // YYYY-MM-DD
  range_end: string;
  start_hour: number;
  end_hour: number;
  min_available: number | null;
  fixed_slots: Array<{ start: string; end: string; title: string }>;
};

// Generate hourly slot list for range × hour-window
export function generateSlots(
  rangeStart: string,
  rangeEnd: string,
  startHour: number,
  endHour: number,
): Date[] {
  const slots: Date[] = [];
  const start = new Date(rangeStart + "T00:00:00");
  const end = new Date(rangeEnd + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    for (let h = startHour; h < endHour; h++) {
      const slot = new Date(d);
      slot.setHours(h, 0, 0, 0);
      slots.push(slot);
    }
  }
  return slots;
}

// Given an event, does it cover the given hourly slot?
export function eventCoversSlot(ev: EventRow, slot: Date): boolean {
  const slotEnd = new Date(slot.getTime() + 60 * 60 * 1000);
  const evStart = new Date(ev.start_at);
  const evEnd = new Date(ev.end_at);

  if (ev.recurrence === "weekly") {
    // Check if slot's day-of-week matches evStart's day-of-week, and slot's time is within the event's time range on that day.
    if (slot.getDay() !== evStart.getDay()) return false;
    const until = ev.recurrence_until ? new Date(ev.recurrence_until + "T23:59:59") : null;
    if (until && slot > until) return false;
    if (slot < new Date(evStart.getFullYear(), evStart.getMonth(), evStart.getDate())) return false;
    // Build the "occurrence" on slot's date
    const occStart = new Date(slot);
    occStart.setHours(evStart.getHours(), evStart.getMinutes(), 0, 0);
    const occEnd = new Date(slot);
    // duration
    const dur = evEnd.getTime() - evStart.getTime();
    const occEndTime = new Date(occStart.getTime() + dur);
    return slot < occEndTime && slotEnd > occStart;
  }

  if (ev.all_day) {
    // covers full days from evStart date to evEnd date inclusive
    const startDay = new Date(evStart.getFullYear(), evStart.getMonth(), evStart.getDate());
    const endDay = new Date(evEnd.getFullYear(), evEnd.getMonth(), evEnd.getDate(), 23, 59, 59);
    return slot >= startDay && slot <= endDay;
  }

  return slot < evEnd && slotEnd > evStart;
}

// Aggregate: for each slot, how many members are BUSY
export function computeBusyCount(
  slots: Date[],
  members: MemberRow[],
  events: EventRow[],
): Map<number, Set<string>> {
  const busy = new Map<number, Set<string>>();
  for (const slot of slots) busy.set(slot.getTime(), new Set());
  for (const ev of events) {
    for (const slot of slots) {
      if (eventCoversSlot(ev, slot)) {
        busy.get(slot.getTime())!.add(ev.member_id);
      }
    }
  }
  return busy;
}

export function formatDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatKoreanDate(d: Date): string {
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${["일","월","화","수","목","금","토"][d.getDay()]})`;
}
