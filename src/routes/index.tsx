import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Music, Calendar, Users, Sparkles, ArrowRight, ExternalLink, Trash2 } from "lucide-react";
import { getSavedSessions, saveSession, removeSavedSession, type SavedSession } from "@/lib/local-store";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mySessions, setMySessions] = useState<SavedSession[]>([]);
  useEffect(() => { setMySessions(getSavedSessions()); }, []);
  const today = new Date();
  const twoWeeks = new Date(today.getTime() + 14 * 86400_000);
  const deadlineDefault = new Date(today.getTime() + 3 * 86400_000);
  const toDate = (d: Date) => d.toISOString().slice(0, 10);
  const toDT = (d: Date) => d.toISOString().slice(0, 16);

  const [form, setForm] = useState({
    title: "이번 주 합주",
    deadline: toDT(deadlineDefault),
    range_start: toDate(today),
    range_end: toDate(twoWeeks),
    start_hour: 9,
    end_hour: 22,
    min_available: "",
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const leader_token = crypto.randomUUID().replace(/-/g, "");
    const member_token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("sessions" as never).insert({
      leader_token,
      member_token,
      title: form.title,
      deadline: new Date(form.deadline).toISOString(),
      range_start: form.range_start,
      range_end: form.range_end,
      start_hour: form.start_hour,
      end_hour: form.end_hour,
      min_available: form.min_available ? Number(form.min_available) : null,
      fixed_slots: [],
    } as never);
    if (error) {
      setError(error.message);
      setCreating(false);
      return;
    }
    saveSession({ leaderToken: leader_token, memberToken: member_token, title: form.title, createdAt: new Date().toISOString() });
    nav({ to: "/l/$leaderToken", params: { leaderToken: leader_token } });
  }

  function forgetSession(token: string) {
    if (!confirm("이 세션을 목록에서 제거할까요? (실제 데이터는 삭제되지 않아요)")) return;
    removeSavedSession(token);
    setMySessions(getSavedSessions());
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-yellow">
            <Music className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-semibold tracking-tight">합주각</span>
        </div>
        <a href="#create" className="pill pill-dark text-sm">세션 만들기</a>
      </nav>

      {mySessions.length > 0 && (
        <section className="px-6 pt-2 lg:px-12">
          <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-surface-yellow p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4" /> 이 브라우저에서 만든 세션
              </div>
              <span className="text-xs text-muted-foreground">총 {mySessions.length}개</span>
            </div>
            <div className="space-y-2">
              {mySessions.map((s) => (
                <div key={s.leaderToken} className="flex items-center gap-3 rounded-xl bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.title}</div>
                    <div className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString("ko-KR")}</div>
                  </div>
                  <Link to="/l/$leaderToken" params={{ leaderToken: s.leaderToken }} className="pill pill-outline text-xs">
                    리더 열기 <ExternalLink className="h-3 w-3" />
                  </Link>
                  <button onClick={() => forgetSession(s.leaderToken)} className="text-stone hover:text-destructive p-1" aria-label="목록에서 제거">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              💡 다른 기기에서 열려면 리더 링크를 미리 저장해 두세요. 이 목록은 이 브라우저에만 저장돼요.
            </div>
          </div>
        </section>
      )}


      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-12 pb-24 lg:px-12 lg:pt-20">
        {/* floating sticky notes */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          <div className="sticky-note absolute left-[8%] top-[15%] rotate-[-8deg] bg-brand-coral text-sm">알바 · 화 14–17시</div>
          <div className="sticky-note absolute right-[10%] top-[10%] rotate-[6deg] bg-teal-light text-sm">여행 · 7/30–8/3</div>
          <div className="sticky-note absolute left-[12%] bottom-[8%] rotate-[4deg] bg-brand-mint text-sm">과외 · 매주 목 19시</div>
          <div className="sticky-note absolute right-[8%] bottom-[15%] rotate-[-5deg] bg-brand-rose text-sm">시험 · 6/12 종일</div>
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3" /> 밴드부 일정 조율의 새로운 방식
          </div>
          <h1 className="mt-6 text-5xl font-medium leading-[1.05] tracking-tight md:text-7xl">
            합주 시간, <span className="bg-brand-yellow px-3 py-1 rounded-lg inline-block rotate-[-1deg]">이제 그만</span><br />
            <span className="text-slate">묻고 다니지 마세요.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            부원들은 캘린더처럼 안 되는 일정만 넣으면 끝.<br />
            겹치지 않는 시간을 자동으로 찾아 시각화해 드려요.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="#create" className="pill pill-dark">세션 만들기 <ArrowRight className="h-4 w-4" /></a>
            <a href="#how" className="pill pill-outline">어떻게 작동하나요?</a>
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="bg-surface px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-medium tracking-tight md:text-4xl">이렇게 씁니다</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { n: "01", title: "리더가 세션 생성", desc: "수합 마감일과 후보 기간을 설정하고 링크 두 개를 받아요.", bg: "bg-yellow-light" },
              { n: "02", title: "부원은 이름만 적고 일정 입력", desc: "로그인 없이 캘린더에 안 되는 일정만 넣으면 끝. 반복 일정도 지원.", bg: "bg-teal-light" },
              { n: "03", title: "마감 후 자동 시각화", desc: "모두가 가능한 시간을 히트맵으로 보여드려요. 리더는 확정만 하면 끝.", bg: "bg-brand-rose" },
            ].map((s) => (
              <div key={s.n} className={`${s.bg} rounded-2xl p-6`}>
                <div className="text-xs font-medium text-ink/60">{s.n}</div>
                <div className="mt-4 text-xl font-medium">{s.title}</div>
                <div className="mt-2 text-sm text-ink/70">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Create form */}
      <section id="create" className="px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-brand-yellow px-3 py-1 text-xs font-medium">
              <Calendar className="h-3 w-3" /> 리더용
            </div>
            <h2 className="mt-4 text-3xl font-medium tracking-tight md:text-4xl">세션 만들기</h2>
            <p className="mt-2 text-muted-foreground">몇 초면 링크가 생성돼요. 로그인 필요 없음.</p>
          </div>

          <form onSubmit={create} className="rounded-3xl border border-border bg-white p-6 md:p-8 shadow-[0_1px_0_rgba(0,0,0,0.03),0_20px_40px_-24px_rgba(0,0,0,0.1)]">
            <Field label="세션 제목">
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-xl border border-border px-4 py-3 focus:border-ink focus:outline-none" />
            </Field>

            <Field label="수합 마감기한">
              <input required type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-full rounded-xl border border-border px-4 py-3 focus:border-ink focus:outline-none" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="후보 시작일">
                <input required type="date" value={form.range_start} onChange={(e) => setForm({ ...form, range_start: e.target.value })}
                  className="w-full rounded-xl border border-border px-4 py-3 focus:border-ink focus:outline-none" />
              </Field>
              <Field label="후보 종료일">
                <input required type="date" value={form.range_end} onChange={(e) => setForm({ ...form, range_end: e.target.value })}
                  className="w-full rounded-xl border border-border px-4 py-3 focus:border-ink focus:outline-none" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="하루 시작 시각">
                <select value={form.start_hour} onChange={(e) => setForm({ ...form, start_hour: Number(e.target.value) })}
                  className="w-full rounded-xl border border-border px-4 py-3 focus:border-ink focus:outline-none bg-white">
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}:00</option>)}
                </select>
              </Field>
              <Field label="하루 종료 시각">
                <select value={form.end_hour} onChange={(e) => setForm({ ...form, end_hour: Number(e.target.value) })}
                  className="w-full rounded-xl border border-border px-4 py-3 focus:border-ink focus:outline-none bg-white">
                  {Array.from({ length: 24 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}:00</option>)}
                </select>
              </Field>
            </div>

            <Field label="최소 참석 인원 (선택)" hint="이 인원 이상 가능한 슬롯을 하이라이트합니다. 비워두면 전원 기준.">
              <input type="number" min={1} value={form.min_available} onChange={(e) => setForm({ ...form, min_available: e.target.value })}
                placeholder="예: 5"
                className="w-full rounded-xl border border-border px-4 py-3 focus:border-ink focus:outline-none" />
            </Field>

            {error && <div className="mb-4 rounded-lg bg-coral-light px-4 py-3 text-sm text-ink">{error}</div>}

            <button type="submit" disabled={creating}
              className="pill pill-dark w-full disabled:opacity-50">
              {creating ? "만드는 중..." : "세션 만들고 링크 받기"} <Users className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground lg:px-12">
        합주각 · 밴드부를 위한 일정 조율
      </footer>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="mb-5 block">
      <div className="mb-2 text-sm font-medium text-ink">{label}</div>
      {children}
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </label>
  );
}
