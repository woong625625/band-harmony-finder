import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SessionRow, EventRow } from "@/lib/schedule-utils";
import { formatKoreanDate } from "@/lib/schedule-utils";
import { getMemberId, saveMemberId, clearMemberId } from "@/lib/local-store";
import { Music, Plus, Trash2, Check, Calendar, Clock, Repeat, CalendarDays, LogOut } from "lucide-react";

export const Route = createFileRoute("/m/$memberToken")({
  component: MemberPage,
});

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type NewEvent = {
  title: string;
  date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  weekly: boolean;
  weekday: number; // 0-6 (used when weekly)
  weekly_until: string;
};

function emptyEvent(defaultDate: string): NewEvent {
  return {
    title: "",
    date: defaultDate,
    end_date: defaultDate,
    start_time: "14:00",
    end_time: "17:00",
    all_day: false,
    weekly: false,
    weekday: new Date(defaultDate + "T00:00:00").getDay(),
    weekly_until: "",
  };
}

// First date in [rangeStart, rangeEnd] whose day-of-week matches `weekday`.
function firstDateWithWeekday(rangeStart: string, rangeEnd: string, weekday: number): string {
  const start = new Date(rangeStart + "T00:00:00");
  const end = new Date(rangeEnd + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === weekday) return d.toISOString().slice(0, 10);
  }
  return rangeStart;
}

function MemberPage() {
  const { memberToken } = Route.useParams();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [name, setName] = useState("");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string>("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [drafts, setDrafts] = useState<NewEvent[]>([]);
  const [mode, setMode] = useState<"register" | "edit" | "add">("register");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("sessions" as never).select("*").eq("member_token", memberToken).maybeSingle();
      if (!data) { setNotFoundState(true); setLoading(false); return; }
      const s = data as unknown as SessionRow;
      setSession(s);

      // Restore returning member from localStorage
      const savedId = getMemberId(memberToken);
      if (savedId) {
        const [{ data: m }, { data: evs }] = await Promise.all([
          supabase.from("members" as never).select("*").eq("id", savedId).maybeSingle(),
          supabase.from("events" as never).select("*").eq("member_id", savedId),
        ]);
        if (m) {
          setMemberId(savedId);
          setMemberName((m as unknown as { name: string }).name);
          setEvents((evs as unknown as EventRow[]) ?? []);
          setMode("edit");
        } else {
          clearMemberId(memberToken);
        }
      }
      setLoading(false);
    })();
  }, [memberToken]);

  const deadlinePassed = session ? new Date(session.deadline) < new Date() : false;

  async function registerMember() {
    if (!name.trim() || !session) return;
    const { data, error } = await supabase.from("members" as never)
      .insert({ session_id: session.id, name: name.trim() } as never)
      .select("*").single();
    if (error || !data) return;
    const id = (data as unknown as { id: string }).id;
    setMemberId(id);
    setMemberName(name.trim());
    saveMemberId(memberToken, id);
    setDrafts([emptyEvent(session.range_start)]);
    setMode("add");
  }

  function startAdd() {
    if (!session) return;
    setDrafts([emptyEvent(session.range_start)]);
    setMode("add");
  }
  function cancelAdd() { setDrafts([]); setMode("edit"); }

  function addDraft() {
    if (!session) return;
    setDrafts([...drafts, emptyEvent(session.range_start)]);
  }
  function removeDraft(i: number) { setDrafts(drafts.filter((_, idx) => idx !== i)); }
  function updateDraft(i: number, patch: Partial<NewEvent>) {
    setDrafts(drafts.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  }

  async function saveAll() {
    if (!memberId || !session) return;
    const rows = drafts.map((d) => {
      let start_at: string, end_at: string;
      // Weekly uses weekday → compute first matching date in range
      const baseDate = d.weekly
        ? firstDateWithWeekday(session.range_start, session.range_end, d.weekday)
        : d.date;
      if (d.all_day) {
        start_at = new Date(`${baseDate}T00:00:00`).toISOString();
        end_at = new Date(`${(d.weekly ? baseDate : d.end_date) || baseDate}T23:59:59`).toISOString();
      } else {
        start_at = new Date(`${baseDate}T${d.start_time}:00`).toISOString();
        end_at = new Date(`${baseDate}T${d.end_time}:00`).toISOString();
      }
      return {
        member_id: memberId,
        title: d.title || "일정",
        start_at, end_at,
        all_day: d.all_day,
        recurrence: d.weekly ? "weekly" : "none",
        recurrence_until: d.weekly && d.weekly_until ? d.weekly_until : null,
      };
    });
    if (rows.length) {
      const { data } = await supabase.from("events" as never).insert(rows as never).select("*");
      if (data) setEvents([...events, ...(data as unknown as EventRow[])]);
    }
    setDrafts([]);
    setMode("edit");
  }

  async function deleteEvent(id: string) {
    await supabase.from("events" as never).delete().eq("id", id);
    setEvents(events.filter(e => e.id !== id));
  }

  function switchMember() {
    if (!confirm("다른 이름으로 참여할까요? (기존 일정은 서버에 남아있어요)")) return;
    clearMemberId(memberToken);
    setMemberId(null);
    setMemberName("");
    setEvents([]);
    setDrafts([]);
    setName("");
    setMode("register");
  }

  if (loading) return <FullPageMessage>불러오는 중...</FullPageMessage>;
  if (notFoundState) return <FullPageMessage>이 링크는 유효하지 않아요.</FullPageMessage>;
  if (!session) return null;

  if (deadlinePassed) {
    return <FullPageMessage title="수합 마감됨">
      마감 시각이 지났습니다. 리더에게 확정된 합주 시간을 확인하세요.
    </FullPageMessage>;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-light px-3 py-1 text-xs font-medium">
            <Calendar className="h-3 w-3" /> 부원용 · {session.title}
          </div>
          <h1 className="mt-4 text-3xl font-medium tracking-tight md:text-4xl">
            {mode === "register" ? "안 되는 일정을 알려주세요" : `${memberName}님, 안녕하세요 👋`}
          </h1>
          <p className="mt-2 text-muted-foreground">
            수합 마감: <b>{new Date(session.deadline).toLocaleString("ko-KR")}</b><br />
            후보 기간: {session.range_start} ~ {session.range_end}
          </p>
        </div>

        {mode === "register" && (
          <div className="rounded-3xl border border-border bg-white p-6 md:p-8">
            <label className="block">
              <div className="mb-2 text-sm font-medium">이름</div>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="예: 김밴드"
                className="w-full rounded-xl border border-border px-4 py-3 focus:border-ink focus:outline-none" />
            </label>
            <button onClick={registerMember} disabled={!name.trim()}
              className="pill pill-yellow mt-4 w-full disabled:opacity-50">
              시작하기
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              💡 이 브라우저에 이름이 기억돼요. 다음에 이 링크를 다시 열면 바로 일정을 수정할 수 있어요.
            </p>
          </div>
        )}

        {mode === "edit" && (
          <div className="rounded-3xl border border-border bg-white p-6 md:p-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-mint">
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="font-medium">제출된 일정 {events.length}개</div>
                  <div className="text-xs text-muted-foreground">마감 전까지 계속 수정할 수 있어요</div>
                </div>
              </div>
              <button onClick={switchMember} className="text-xs text-muted-foreground hover:text-ink inline-flex items-center gap-1">
                <LogOut className="h-3 w-3" /> 다른 사람
              </button>
            </div>
            <div className="space-y-2">
              {events.length === 0 && <div className="rounded-lg bg-surface p-4 text-center text-sm text-muted-foreground">아직 등록된 일정이 없어요.</div>}
              {events.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{formatEvent(e)}</div>
                  </div>
                  <button onClick={() => deleteEvent(e.id)} className="text-stone hover:text-destructive shrink-0 ml-2">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={startAdd} className="pill pill-dark mt-6 w-full">
              <Plus className="h-4 w-4" /> 일정 추가하기
            </button>
          </div>
        )}

        {mode === "add" && (
          <div className="space-y-4">
            {drafts.map((d, i) => (
              <EventDraftCard key={i} draft={d} sessionRange={{ start: session.range_start, end: session.range_end }}
                onChange={(patch) => updateDraft(i, patch)}
                onRemove={() => removeDraft(i)} />
            ))}
            <button onClick={addDraft} className="w-full rounded-2xl border-2 border-dashed border-border py-4 text-sm font-medium text-muted-foreground hover:border-ink hover:text-ink transition">
              <Plus className="mr-1 inline h-4 w-4" /> 일정 더 추가
            </button>
            <div className="flex gap-2">
              {events.length > 0 && (
                <button onClick={cancelAdd} className="pill pill-outline flex-1">취소</button>
              )}
              <button onClick={saveAll} disabled={drafts.length === 0}
                className="pill pill-dark flex-1 disabled:opacity-50">
                제출하기 ({drafts.length}개)
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function EventDraftCard({ draft, sessionRange, onChange, onRemove }: {
  draft: NewEvent; sessionRange: { start: string; end: string };
  onChange: (patch: Partial<NewEvent>) => void; onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <input value={draft.title} onChange={(e) => onChange({ title: e.target.value })}
          placeholder="일정 이름 (예: 알바, 여행)"
          className="flex-1 rounded-lg border-none bg-transparent px-2 py-1 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-brand-yellow" />
        <button onClick={onRemove} className="text-stone hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Toggle active={!draft.all_day && !draft.weekly} onClick={() => onChange({ all_day: false, weekly: false })} icon={<Clock className="h-3 w-3" />}>일회성 · 시간</Toggle>
        <Toggle active={draft.all_day && !draft.weekly} onClick={() => onChange({ all_day: true, weekly: false })} icon={<CalendarDays className="h-3 w-3" />}>일회성 · 종일</Toggle>
        <Toggle active={draft.weekly} onClick={() => onChange({ weekly: true, all_day: false })} icon={<Repeat className="h-3 w-3" />}>매주 반복</Toggle>
      </div>

      {draft.weekly ? (
        <div className="space-y-3">
          <SmallField label="반복 요일">
            <div className="flex gap-1">
              {WEEKDAYS.map((label, idx) => (
                <button key={idx} type="button" onClick={() => onChange({ weekday: idx })}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                    draft.weekday === idx
                      ? "bg-ink text-white"
                      : "bg-surface text-muted-foreground hover:text-ink"
                  } ${idx === 0 ? "text-coral-light" : ""}`}>
                  {label}
                </button>
              ))}
            </div>
          </SmallField>
          <div className="grid grid-cols-2 gap-3">
            <SmallField label="시작">
              <input type="time" value={draft.start_time} onChange={(e) => onChange({ start_time: e.target.value })} className={inputCls} />
            </SmallField>
            <SmallField label="종료">
              <input type="time" value={draft.end_time} onChange={(e) => onChange({ end_time: e.target.value })} className={inputCls} />
            </SmallField>
          </div>
          <SmallField label="반복 종료일 (선택)" hint="비워두면 후보 기간 끝까지 반복">
            <input type="date" min={sessionRange.start} max={sessionRange.end}
              value={draft.weekly_until} onChange={(e) => onChange({ weekly_until: e.target.value })} className={inputCls} />
          </SmallField>
        </div>
      ) : draft.all_day ? (
        <div className="grid grid-cols-2 gap-3">
          <SmallField label="시작일">
            <input type="date" min={sessionRange.start} max={sessionRange.end}
              value={draft.date} onChange={(e) => onChange({ date: e.target.value })} className={inputCls} />
          </SmallField>
          <SmallField label="종료일">
            <input type="date" min={sessionRange.start} max={sessionRange.end}
              value={draft.end_date} onChange={(e) => onChange({ end_date: e.target.value })} className={inputCls} />
          </SmallField>
        </div>
      ) : (
        <div className="space-y-3">
          <SmallField label="날짜">
            <input type="date" min={sessionRange.start} max={sessionRange.end}
              value={draft.date} onChange={(e) => onChange({ date: e.target.value })} className={inputCls} />
          </SmallField>
          <div className="grid grid-cols-2 gap-3">
            <SmallField label="시작">
              <input type="time" value={draft.start_time} onChange={(e) => onChange({ start_time: e.target.value })} className={inputCls} />
            </SmallField>
            <SmallField label="종료">
              <input type="time" value={draft.end_time} onChange={(e) => onChange({ end_time: e.target.value })} className={inputCls} />
            </SmallField>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ink focus:outline-none bg-white";

function SmallField({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </label>
  );
}

function Toggle({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "border-ink bg-ink text-white" : "border-border bg-white text-muted-foreground hover:border-ink"}`}>
      {icon} {children}
    </button>
  );
}

function Header() {
  return (
    <header className="border-b border-border px-6 py-4">
      <div className="mx-auto flex max-w-5xl items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-yellow">
          <Music className="h-3.5 w-3.5" strokeWidth={2.5} />
        </div>
        <span className="font-semibold tracking-tight">합주각</span>
      </div>
    </header>
  );
}

function FullPageMessage({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-center">
      <div>
        {title && <h1 className="mb-3 text-2xl font-medium">{title}</h1>}
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function formatEvent(e: EventRow): string {
  const s = new Date(e.start_at), en = new Date(e.end_at);
  if (e.recurrence === "weekly") {
    const d = WEEKDAYS[s.getDay()];
    return `매주 ${d} ${s.toTimeString().slice(0,5)}–${en.toTimeString().slice(0,5)}${e.recurrence_until ? ` (~${e.recurrence_until})` : ""}`;
  }
  if (e.all_day) return `${formatKoreanDate(s)} ~ ${formatKoreanDate(en)} 종일`;
  return `${formatKoreanDate(s)} ${s.toTimeString().slice(0,5)}–${en.toTimeString().slice(0,5)}`;
}
