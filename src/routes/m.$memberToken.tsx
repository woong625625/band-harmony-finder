import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SessionRow, EventRow } from "@/lib/schedule-utils";
import { formatKoreanDate } from "@/lib/schedule-utils";
import { Music, Plus, Trash2, Check, Calendar, Clock, Repeat, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/m/$memberToken")({
  component: MemberPage,
});

type NewEvent = {
  title: string;
  date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  weekly: boolean;
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
    weekly_until: "",
  };
}

function MemberPage() {
  const { memberToken } = Route.useParams();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [name, setName] = useState("");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [drafts, setDrafts] = useState<NewEvent[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("sessions" as never).select("*").eq("member_token", memberToken).maybeSingle();
      if (!data) { setNotFoundState(true); setLoading(false); return; }
      const s = data as unknown as SessionRow;
      setSession(s);
      setDrafts([emptyEvent(s.range_start)]);
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
    setMemberId((data as unknown as { id: string }).id);
  }

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
    const rows = drafts.filter(d => d.date).map((d) => {
      let start_at: string, end_at: string;
      if (d.all_day) {
        start_at = new Date(`${d.date}T00:00:00`).toISOString();
        end_at = new Date(`${d.end_date || d.date}T23:59:59`).toISOString();
      } else {
        start_at = new Date(`${d.date}T${d.start_time}:00`).toISOString();
        end_at = new Date(`${d.date}T${d.end_time}:00`).toISOString();
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
    setSaved(true);
  }

  async function deleteEvent(id: string) {
    await supabase.from("events" as never).delete().eq("id", id);
    setEvents(events.filter(e => e.id !== id));
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
            안 되는 일정을 알려주세요
          </h1>
          <p className="mt-2 text-muted-foreground">
            수합 마감: <b>{new Date(session.deadline).toLocaleString("ko-KR")}</b><br />
            후보 기간: {session.range_start} ~ {session.range_end}
          </p>
        </div>

        {!memberId ? (
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
          </div>
        ) : saved ? (
          <div className="rounded-3xl border border-border bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-mint">
              <Check className="h-8 w-8" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-medium">제출 완료!</h2>
            <p className="mt-2 text-muted-foreground">
              총 {events.length}개 일정을 등록했어요. 마감 전까지 계속 추가할 수 있어요.
            </p>
            <div className="mt-6 space-y-2 text-left">
              {events.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <div className="font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{formatEvent(e)}</div>
                  </div>
                  <button onClick={() => deleteEvent(e.id)} className="text-stone hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => { setSaved(false); setDrafts([emptyEvent(session.range_start)]); }}
              className="pill pill-outline mt-6">일정 더 추가하기</button>
          </div>
        ) : (
          <div className="space-y-4">
            {drafts.map((d, i) => (
              <EventDraftCard key={i} draft={d} sessionRange={{ start: session.range_start, end: session.range_end }}
                onChange={(patch) => updateDraft(i, patch)}
                onRemove={() => removeDraft(i)} />
            ))}
            <button onClick={addDraft} className="w-full rounded-2xl border-2 border-dashed border-border py-4 text-sm font-medium text-muted-foreground hover:border-ink hover:text-ink transition">
              <Plus className="mr-1 inline h-4 w-4" /> 일정 추가
            </button>
            <button onClick={saveAll} disabled={drafts.length === 0}
              className="pill pill-dark w-full disabled:opacity-50">
              제출하기 ({drafts.length}개)
            </button>
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
        <Toggle active={!draft.all_day} onClick={() => onChange({ all_day: false })} icon={<Clock className="h-3 w-3" />}>시간 지정</Toggle>
        <Toggle active={draft.all_day} onClick={() => onChange({ all_day: true })} icon={<CalendarDays className="h-3 w-3" />}>종일</Toggle>
        <Toggle active={draft.weekly} onClick={() => onChange({ weekly: !draft.weekly })} icon={<Repeat className="h-3 w-3" />}>매주 반복</Toggle>
      </div>

      {draft.all_day ? (
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

      {draft.weekly && (
        <SmallField label="반복 종료일 (선택)" className="mt-3">
          <input type="date" min={draft.date} max={sessionRange.end}
            value={draft.weekly_until} onChange={(e) => onChange({ weekly_until: e.target.value })} className={inputCls} />
        </SmallField>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ink focus:outline-none bg-white";

function SmallField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>{children}</label>;
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
    const d = ["일","월","화","수","목","금","토"][s.getDay()];
    return `매주 ${d} ${s.toTimeString().slice(0,5)}–${en.toTimeString().slice(0,5)}`;
  }
  if (e.all_day) return `${formatKoreanDate(s)} ~ ${formatKoreanDate(en)} 종일`;
  return `${formatKoreanDate(s)} ${s.toTimeString().slice(0,5)}–${en.toTimeString().slice(0,5)}`;
}
