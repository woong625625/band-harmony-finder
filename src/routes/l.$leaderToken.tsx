import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  generateSlots, computeBusyCount, formatKoreanDate,
  type SessionRow, type MemberRow, type EventRow,
} from "@/lib/schedule-utils";
import { Music, Copy, Check, Users, Sparkles, Trash2, Plus, Calendar } from "lucide-react";

export const Route = createFileRoute("/l/$leaderToken")({
  component: LeaderPage,
});

function LeaderPage() {
  const { leaderToken } = Route.useParams();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"aggregate" | "members" | "fixed">("aggregate");

  async function refresh(sessionId: string) {
    const [{ data: ms }, { data: evs }] = await Promise.all([
      supabase.from("members" as never).select("*").eq("session_id", sessionId).order("submitted_at"),
      supabase.from("events" as never).select("*, members!inner(session_id)").eq("members.session_id", sessionId),
    ]);
    setMembers((ms as unknown as MemberRow[]) ?? []);
    setEvents((evs as unknown as EventRow[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("sessions" as never).select("*").eq("leader_token", leaderToken).maybeSingle();
      if (!data) { setNotFoundState(true); setLoading(false); return; }
      const s = data as unknown as SessionRow;
      setSession(s);
      await refresh(s.id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderToken]);

  const memberUrl = session ? `${typeof window !== "undefined" ? window.location.origin : ""}/m/${session.member_token}` : "";

  function copyMemberLink() {
    if (!memberUrl) return;
    navigator.clipboard.writeText(memberUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function addFixedSlot(startISO: string, endISO: string, title = "합주") {
    if (!session) return;
    const newSlot = { start: startISO, end: endISO, title };
    const next = [...(session.fixed_slots ?? []), newSlot];
    await supabase.from("sessions" as never).update({ fixed_slots: next } as never).eq("id", session.id);
    setSession({ ...session, fixed_slots: next });
  }

  async function removeFixedSlot(i: number) {
    if (!session) return;
    const next = session.fixed_slots.filter((_, idx) => idx !== i);
    await supabase.from("sessions" as never).update({ fixed_slots: next } as never).eq("id", session.id);
    setSession({ ...session, fixed_slots: next });
  }

  async function deleteMember(id: string) {
    if (!confirm("이 부원의 일정을 모두 삭제할까요?")) return;
    await supabase.from("members" as never).delete().eq("id", id);
    if (session) refresh(session.id);
  }

  async function deleteEvent(id: string) {
    await supabase.from("events" as never).delete().eq("id", id);
    setEvents(events.filter(e => e.id !== id));
  }

  if (loading) return <FullPage>불러오는 중...</FullPage>;
  if (notFoundState) return <FullPage>이 링크는 유효하지 않아요.</FullPage>;
  if (!session) return null;

  const deadlinePassed = new Date(session.deadline) < new Date();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-yellow">
              <Music className="h-3.5 w-3.5" strokeWidth={2.5} />
            </div>
            <span className="font-semibold tracking-tight">합주각</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-yellow-light px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3 w-3" /> 리더 대시보드
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-2 text-sm text-muted-foreground">
          수합 마감: {new Date(session.deadline).toLocaleString("ko-KR")}
          {deadlinePassed && <span className="ml-2 rounded-full bg-coral-light px-2 py-0.5 text-xs">마감됨</span>}
        </div>
        <h1 className="text-4xl font-medium tracking-tight">{session.title}</h1>
        <div className="mt-1 text-muted-foreground">
          {session.range_start} ~ {session.range_end} · {session.start_hour}시–{session.end_hour}시
        </div>

        {/* Share member link */}
        <div className="mt-6 rounded-2xl border border-border bg-surface-yellow p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4" /> 부원에게 이 링크를 공유하세요
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-lg bg-white px-3 py-2 text-sm">{memberUrl}</code>
            <button onClick={copyMemberLink} className="pill pill-dark text-sm">
              {copied ? <><Check className="h-4 w-4" /> 복사됨</> : <><Copy className="h-4 w-4" /> 복사</>}
            </button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            부원 {members.length}명 참여 · 총 {events.length}개 일정 등록
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex gap-1 border-b border-border">
          {([
            ["aggregate", "가능한 시간 찾기"],
            ["members", `부원 (${members.length})`],
            ["fixed", `확정 합주 (${session.fixed_slots.length})`],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-3 text-sm font-medium transition ${tab === k ? "border-b-2 border-ink text-ink" : "text-muted-foreground hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "aggregate" && (
          <AggregateView session={session} members={members} events={events} onPickSlot={addFixedSlot} />
        )}
        {tab === "members" && (
          <MembersView members={members} events={events} onDeleteMember={deleteMember} onDeleteEvent={deleteEvent} />
        )}
        {tab === "fixed" && (
          <FixedView fixed={session.fixed_slots} onRemove={removeFixedSlot} />
        )}
      </main>
    </div>
  );
}

function AggregateView({ session, members, events, onPickSlot }: {
  session: SessionRow; members: MemberRow[]; events: EventRow[];
  onPickSlot: (startISO: string, endISO: string) => void;
}) {
  const slots = useMemo(() => generateSlots(session.range_start, session.range_end, session.start_hour, session.end_hour), [session]);
  const busyMap = useMemo(() => computeBusyCount(slots, members, events), [slots, members, events]);
  const total = members.length;
  const threshold = session.min_available ?? total;

  // Group slots by date
  const byDate = useMemo(() => {
    const m = new Map<string, Date[]>();
    for (const s of slots) {
      const key = s.toDateString();
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    return m;
  }, [slots]);

  const hours = Array.from({ length: session.end_hour - session.start_hour }, (_, i) => session.start_hour + i);

  if (total === 0) {
    return <div className="mt-10 rounded-2xl border-2 border-dashed border-border p-12 text-center text-muted-foreground">
      아직 참여한 부원이 없어요. 위의 링크를 공유해 주세요.
    </div>;
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">가능 인원별 색상:</span>
        {[0, Math.floor(total / 2), total - 1, total].map((v) => (
          <span key={v} className="inline-flex items-center gap-1">
            <span className={`inline-block h-4 w-4 rounded ${slotColor(v, total, threshold)}`} />
            {v}명
          </span>
        ))}
        <span className="ml-auto rounded-full bg-brand-yellow px-3 py-1 text-xs font-medium">
          ≥ {threshold}명 가능 슬롯 강조
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-surface">
            <tr>
              <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium">날짜</th>
              {hours.map(h => <th key={h} className="px-1 py-2 text-xs font-medium text-muted-foreground">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from(byDate.entries()).map(([dateKey, daySlots]) => (
              <tr key={dateKey} className="border-t border-border">
                <td className="sticky left-0 z-10 bg-white px-3 py-1 text-xs font-medium whitespace-nowrap">
                  {formatKoreanDate(daySlots[0])}
                </td>
                {daySlots.map((slot) => {
                  const busy = busyMap.get(slot.getTime())?.size ?? 0;
                  const avail = total - busy;
                  const endISO = new Date(slot.getTime() + 3600_000).toISOString();
                  return (
                    <td key={slot.getTime()} className="p-0.5">
                      <button
                        onClick={() => {
                          if (confirm(`${formatKoreanDate(slot)} ${slot.getHours()}:00–${slot.getHours()+1}:00 를 확정 합주로 추가할까요? (가능 ${avail}/${total})`)) {
                            onPickSlot(slot.toISOString(), endISO);
                          }
                        }}
                        title={`가능: ${avail}/${total}명`}
                        className={`h-9 w-full rounded ${slotColor(avail, total, threshold)} hover:ring-2 hover:ring-ink transition text-[10px] font-medium`}
                      >
                        {avail === total ? "★" : avail >= threshold ? avail : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        슬롯을 클릭하면 확정 합주 일정으로 추가돼요. ★는 전원 가능, 노란색은 {threshold}명 이상 가능.
      </p>
    </div>
  );
}

function slotColor(avail: number, total: number, threshold: number): string {
  if (total === 0) return "bg-surface";
  if (avail === total) return "bg-brand-yellow";
  if (avail >= threshold) return "bg-yellow-light";
  if (avail === 0) return "bg-coral-light";
  const ratio = avail / total;
  if (ratio >= 0.7) return "bg-brand-mint";
  if (ratio >= 0.4) return "bg-teal-light/60";
  return "bg-coral-light/60";
}

function MembersView({ members, events, onDeleteMember, onDeleteEvent }: {
  members: MemberRow[]; events: EventRow[];
  onDeleteMember: (id: string) => void; onDeleteEvent: (id: string) => void;
}) {
  if (members.length === 0) {
    return <div className="mt-10 rounded-2xl border-2 border-dashed border-border p-12 text-center text-muted-foreground">
      아직 참여한 부원이 없어요.
    </div>;
  }
  return (
    <div className="mt-6 space-y-3">
      {members.map(m => {
        const evs = events.filter(e => e.member_id === m.id);
        return (
          <details key={m.id} className="rounded-2xl border border-border bg-white p-4">
            <summary className="flex cursor-pointer items-center justify-between">
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-muted-foreground">{evs.length}개 일정 · {new Date(m.submitted_at).toLocaleString("ko-KR")}</div>
              </div>
              <button onClick={(e) => { e.preventDefault(); onDeleteMember(m.id); }}
                className="text-stone hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </summary>
            <div className="mt-3 space-y-2">
              {evs.length === 0 && <div className="text-sm text-muted-foreground">등록된 일정 없음</div>}
              {evs.map(e => (
                <div key={e.id} className="flex items-center justify-between rounded-lg bg-surface p-3 text-sm">
                  <div>
                    <div className="font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{formatEvent(e)}</div>
                  </div>
                  <button onClick={() => onDeleteEvent(e.id)} className="text-stone hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function FixedView({ fixed, onRemove }: { fixed: Array<{ start: string; end: string; title: string }>; onRemove: (i: number) => void }) {
  if (fixed.length === 0) {
    return <div className="mt-10 rounded-2xl border-2 border-dashed border-border p-12 text-center text-muted-foreground">
      확정된 합주가 없어요. <br />
      '가능한 시간 찾기' 탭에서 슬롯을 클릭해 추가하세요.
    </div>;
  }
  return (
    <div className="mt-6 space-y-3">
      {fixed.map((f, i) => {
        const s = new Date(f.start), e = new Date(f.end);
        return (
          <div key={i} className="flex items-center justify-between rounded-2xl border border-border bg-yellow-light p-5">
            <div>
              <div className="flex items-center gap-2 text-xs text-ink/70">
                <Calendar className="h-3 w-3" /> 확정 합주
              </div>
              <div className="mt-1 text-lg font-medium">{f.title}</div>
              <div className="text-sm">{formatKoreanDate(s)} · {s.getHours()}:00 – {e.getHours()}:00</div>
            </div>
            <button onClick={() => onRemove(i)} className="text-stone hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function formatEvent(e: EventRow): string {
  const s = new Date(e.start_at), en = new Date(e.end_at);
  if (e.recurrence === "weekly") {
    const d = ["일","월","화","수","목","금","토"][s.getDay()];
    return `매주 ${d} ${s.toTimeString().slice(0,5)}–${en.toTimeString().slice(0,5)}${e.recurrence_until ? ` (~${e.recurrence_until})` : ""}`;
  }
  if (e.all_day) return `${formatKoreanDate(s)} ~ ${formatKoreanDate(en)} 종일`;
  return `${formatKoreanDate(s)} ${s.toTimeString().slice(0,5)}–${en.toTimeString().slice(0,5)}`;
}

function FullPage({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-canvas text-muted-foreground">{children}</div>;
}
