"use client";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  CalendarDays,
  Check,
  CircleCheckBig,
  FolderKanban,
  GanttChart,
  Layers,
  LayoutGrid,
  LogIn,
  Menu,
  MessageSquare,
  Network,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  UserPlus,
  UsersRound,
  X,
  Eye,
  ChartColumn,
  ListChecks,
  Clock3,
} from "lucide-react";
import { SanaaBrand } from "./sanaa-brand";
import "./landing.css";

/** The sign-in screen is the same view, reached through this hash so the browser back button returns here. */
export const LOGIN_HASH = "#login";
const DEMO_HREF = `mailto:?subject=${encodeURIComponent("طلب عرض توضيحي لنظام Sanaa Tasks")}`;

const NAV = [
  { href: "#platform", label: "الإمكانات" },
  { href: "#benefits", label: "المزايا" },
  { href: "#why", label: "لماذا Tasks" },
  { href: "#start", label: "كيف تبدأ" },
];

function StarMark({ size = 14 }: { size?: number }) {
  return (
    <svg
      className="login-star"
      width={size}
      height={size}
      viewBox="-16 -16 32 32"
      aria-hidden="true"
    >
      <path
        d="M-11.3-11.3H11.3V11.3H-11.3Z M0-16L16 0 0 16-16 0Z"
        fill="currentColor"
        fillRule="nonzero"
      />
    </svg>
  );
}

/** The capabilities in the order a project meets them, grouped into three stages. */
const STAGES = [
  {
    title: "التخطيط",
    modules: [
      {
        Icon: FolderKanban,
        name: "المشاريع",
        lead: "مشروع لكل هدف بمسؤول وتواريخ وأقسام وأعضاء، وتقدّم يُحسب تلقائيًا من المهام.",
        points: ["أقسام وقوالب", "تقدّم تلقائي"],
      },
      {
        Icon: GanttChart,
        name: "الجدول الزمني والخريطة",
        lead: "مخطط جانت وخريطة للمشروع ومراحل رئيسية تُظهر ما تم وما تأخر وما هو قادم.",
        points: ["مخطط جانت", "مراحل رئيسية"],
      },
      {
        Icon: ShieldCheck,
        name: "الأعضاء والصلاحيات",
        lead: "كل شخص يرى ما يخصه فقط، مع صلاحيات إدارة يتحكم بها المسؤول.",
        points: ["أدوار واضحة", "مهام شخصية خاصة"],
      },
    ],
  },
  {
    title: "التنفيذ",
    modules: [
      {
        Icon: ListChecks,
        name: "المهام",
        lead: "مهام بمسؤولين متعددين ومهام فرعية وأولويات ومواعيد، ولا تُغلق إلا عند اكتمال الجميع.",
        points: ["مهام فرعية", "إنجاز لكل مسؤول"],
      },
      {
        Icon: LayoutGrid,
        name: "طرق العرض",
        lead: "بدّل بين القائمة واللوحة والتقويم والجدول الزمني بحسب طريقة عملك.",
        points: ["قائمة ولوحة", "تقويم شهري"],
      },
      {
        Icon: MessageSquare,
        name: "التعليقات والمرفقات",
        lead: "نقاش المهمة وملفاتها وسجل نشاطها في مكان واحد، مع إشارات للزملاء.",
        points: ["إشارات @", "سجل النشاط"],
      },
    ],
  },
  {
    title: "المتابعة",
    modules: [
      {
        Icon: UsersRound,
        name: "مهام الفريق",
        lead: "المدير يرى مهام فريقه وفق الهيكل الفعلي في الموارد البشرية، ويعرف من لديه عبء أكبر.",
        points: ["فريقي", "عبء العمل"],
      },
      {
        Icon: Bell,
        name: "التنبيهات والتذكيرات",
        lead: "إشعارات التكليف والتعليق والتحديث، وتذكيرات الاستحقاق والتأخر دون تكرار.",
        points: ["تنبيهات فورية", "تذكير بالموعد"],
      },
      {
        Icon: ChartColumn,
        name: "التقارير والمؤشرات",
        lead: "لوحة مؤشرات وتقارير عن الحالة والأولوية والموظفين تدعم قرار الإدارة.",
        points: ["لوحات مؤشرات", "تقارير للإدارة"],
      },
    ],
  },
] as const;

const BENEFITS = [
  {
    Icon: Layers,
    title: "مساحة عمل واحدة للجميع",
    text: "المشاريع والمهام والفريق والتقويم في مكان واحد محدّث، بلا جداول متفرقة ولا رسائل ضائعة.",
    wide: true,
  },
  {
    Icon: CalendarDays,
    title: "مواعيد لا تفوتك",
    text: "تقويم وتذكيرات تنبّه صاحب المهمة قبل الاستحقاق وعند التأخر.",
  },
  {
    Icon: UserPlus,
    title: "تكليف بنقرة",
    text: "أسند المهمة لواحد أو أكثر من الفريق ويصله إشعار فورًا.",
  },
  {
    Icon: TrendingUp,
    title: "تقدّم تراه لحظيًا",
    text: "نسبة إنجاز المشروع تُحسب من مهامه، فلا حاجة لتحديثها يدويًا.",
  },
  {
    Icon: ShieldCheck,
    title: "صلاحيات محكمة",
    text: "كل شخص يرى ما يحق له فقط، والمهام الشخصية تبقى خاصة.",
  },
  {
    Icon: Smartphone,
    title: "من المكتب أو الجوال",
    text: "واجهة عربية أصيلة من اليمين لليسار تعمل بسلاسة على كل الشاشات.",
  },
] as const;

const PILLARS = [
  {
    Icon: Eye,
    title: "الوضوح",
    text: "كل فرد يعرف ما المطلوب منه ومتى، وكل مدير يعرف أين وصل العمل.",
  },
  {
    Icon: ShieldCheck,
    title: "التحكم",
    text: "صلاحيات دقيقة لكل دور، وسجل نشاط كامل لكل تغيير على المهام.",
  },
  {
    Icon: Network,
    title: "الارتباط بالهيكل",
    text: "الفِرق والمديرون مستمدّون من الموارد البشرية، فلا إدخال مكرر للبيانات.",
  },
] as const;

const STATS = [
  {
    value: "5",
    unit: "طرق عرض",
    label: "قائمة ولوحة وتقويم وجانت وخريطة المشروع",
  },
  {
    value: "1",
    unit: "دخول",
    label: "بحساب الموارد البشرية نفسه دون كلمات مرور إضافية",
  },
  { value: "100%", unit: "", label: "واجهة عربية أصيلة مع دعم الإنجليزية" },
  { value: "24/7", unit: "", label: "وصول آمن للفريق من المكتب أو الجوال" },
] as const;

const STEPS = [
  {
    title: "سجّل الدخول",
    text: "ادخل بحساب سنع للموارد البشرية نفسه، وتصلك مساحة عمل مرتبطة بهيكل شركتك.",
  },
  {
    title: "أنشئ مشروعك",
    text: "حدّد المسؤول والتواريخ والأقسام، وأضف الأعضاء أو ابدأ من قالب جاهز.",
  },
  {
    title: "وزّع المهام وتابع",
    text: "كلّف الفريق وتابع التقدّم من اللوحة والتقويم والتقارير حتى الإنجاز.",
  },
] as const;

function Wordmark() {
  return (
    <a
      className="landing-wordmark"
      href="#top"
      aria-label="Sanaa Tasks — الصفحة الرئيسية"
    >
      <SanaaBrand />
    </a>
  );
}

const SCENE_TEAM = 24;
const SCENE_TASKS = [
  {
    initial: "س",
    name: "سارة العتيبي",
    task: "مراجعة عقد المورّد",
    project: "التوريدات",
  },
  {
    initial: "م",
    name: "محمد القحطاني",
    task: "إعداد تقرير الربع",
    project: "المالية",
  },
  {
    initial: "ن",
    name: "نورة الدوسري",
    task: "إطلاق النسخة الجديدة",
    project: "التقنية",
  },
] as const;
const SCENE_DONE = [
  { initial: "خ", name: "خالد الشهري", task: "تحديث بيانات العملاء", left: 3 },
  { initial: "ر", name: "ريم الحربي", task: "اعتماد التصميم", left: 5 },
  { initial: "ف", name: "فهد المطيري", task: "اختبار الإصدار", left: 2 },
] as const;
const SCENE_LOAD = [
  [38, 54, 46, 70, 62, 84],
  [42, 50, 58, 66, 60, 88],
  [36, 58, 52, 64, 72, 80],
] as const;

/** Link paths from the hub (path start) to each card corner, for the side-by-side and the stacked layouts. */
const SCENE_LINKS = {
  wide: {
    tl: "M50 50 C 22 50, 26 25, 0 25",
    bl: "M50 50 C 22 50, 26 75, 0 75",
    tr: "M50 50 C 78 50, 74 25, 100 25",
    br: "M50 50 C 78 50, 74 75, 100 75",
  },
  stacked: {
    tr: "M50 50 C 50 22, 75 26, 75 0",
    tl: "M50 50 C 50 22, 25 26, 25 0",
    br: "M50 50 C 50 78, 75 74, 75 100",
    bl: "M50 50 C 50 78, 25 74, 25 100",
  },
} as const;
type SceneLink = keyof typeof SCENE_LINKS.wide;

/** One beat at a time: each workspace sends an update into the shared project or receives one from it. */
const SCENE_BEATS = [
  {
    card: "project",
    link: "tl",
    inbound: true,
    chip: "مهمة ← مشروع",
    Icon: FolderKanban,
  },
  {
    card: "load",
    link: "bl",
    inbound: false,
    chip: "تكليف ← عبء الفريق",
    Icon: UsersRound,
  },
  {
    card: "done",
    link: "br",
    inbound: true,
    chip: "إنجاز ← إشعار",
    Icon: Check,
  },
  {
    card: "task",
    link: "tr",
    inbound: false,
    chip: "تقدّم ← مهامي",
    Icon: ListChecks,
  },
] as const;
const SCENE_BEAT_MS = 2400;

/** Advances the scene while it is on screen and the tab is visible; stays on the first frame for reduced motion. */
function useSceneClock(ref: RefObject<HTMLDivElement | null>) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    let visible = !("IntersectionObserver" in window);
    let timer = 0;
    const sync = () => {
      if (visible && !document.hidden) {
        if (!timer)
          timer = window.setInterval(
            () => setTick((value) => value + 1),
            SCENE_BEAT_MS,
          );
      } else if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    };
    const observer = visible
      ? null
      : new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          sync();
        });
    observer?.observe(node);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [ref]);
  return tick;
}

/** Subtle 3D tilt and glare that follow the mouse; touch and reduced motion keep the panel flat. */
function tiltScene(event: ReactPointerEvent<HTMLDivElement>) {
  const node = event.currentTarget;
  if (
    event.pointerType !== "mouse" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const rect = node.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  node.style.setProperty("--tilt-x", `${((0.5 - y) * 5).toFixed(2)}deg`);
  node.style.setProperty("--tilt-y", `${((x - 0.5) * 7).toFixed(2)}deg`);
  node.style.setProperty("--glare-x", `${(x * 100).toFixed(1)}%`);
  node.style.setProperty("--glare-y", `${(y * 100).toFixed(1)}%`);
}

function resetScene(event: ReactPointerEvent<HTMLDivElement>) {
  for (const name of ["--tilt-x", "--tilt-y"])
    event.currentTarget.style.setProperty(name, "0deg");
}

/** Decorative live product panel: four task workspaces exchanging updates through one shared project. */
function TasksScene() {
  const rootRef = useRef<HTMLDivElement>(null);
  const tick = useSceneClock(rootRef);
  const beatIndex = tick % SCENE_BEATS.length;
  const round = Math.floor(tick / SCENE_BEATS.length);
  const beat = SCENE_BEATS[beatIndex];
  const previous =
    SCENE_BEATS[(beatIndex + SCENE_BEATS.length - 1) % SCENE_BEATS.length];

  const total = 40;
  const completed = 26 + (round % 10);
  const percent = Math.round((completed / total) * 100);

  const bars =
    SCENE_LOAD[
      (beatIndex >= 1 ? round : Math.max(round - 1, 0)) % SCENE_LOAD.length
    ];

  const doneIndex = round % SCENE_DONE.length;
  const done = SCENE_DONE[doneIndex];
  const finished = beatIndex >= 2;

  const taskIndex = (beatIndex >= 3 ? round + 1 : round) % SCENE_TASKS.length;
  const task = SCENE_TASKS[taskIndex];

  const feed = [
    `تم تحديث تقدّم مشروع ${task.project}`,
    "تكليف جديد وصل إلى الفريق",
    `إنجاز مهمة: ${done.task}`,
    `تحديث مهمة ${task.name}`,
  ][beatIndex];
  const active = (card: string) => (beat.card === card ? " is-active" : "");

  const links = (layout: keyof typeof SCENE_LINKS) =>
    (Object.entries(SCENE_LINKS[layout]) as [SceneLink, string][]).map(
      ([key, d]) => (
        <path
          key={key}
          className={`landing-scene-link${beat.link === key ? " is-active" : ""}`}
          d={d}
        />
      ),
    );
  const packet = (layout: keyof typeof SCENE_LINKS) => (
    <path
      key={`packet-${tick}`}
      className={`landing-scene-packet${beat.inbound ? " is-in" : ""}`}
      d={SCENE_LINKS[layout][beat.link]}
      pathLength={100}
    />
  );

  return (
    <div
      ref={rootRef}
      className="landing-hero-visual"
      role="img"
      aria-label="لوحة Sanaa Tasks: المشاريع والمهام والفريق والإنجاز في مساحة عمل واحدة"
      onPointerMove={tiltScene}
      onPointerLeave={resetScene}
    >
      <span className="landing-glare" aria-hidden="true" />
      <div className="landing-panel-bar" aria-hidden="true">
        <span className="landing-panel-title">
          <StarMark size={14} /> لوحة المهام
        </span>
        <span className="landing-panel-status">
          <span className="landing-panel-live">مباشر</span>
          <span className="landing-panel-dots">
            <i />
            <i />
            <i />
          </span>
        </span>
      </div>

      <div className="landing-scene" aria-hidden="true">
        <div className={`landing-card landing-card-profile${active("task")}`}>
          <header>
            <span className="landing-card-tag">مهامي</span>
            <b>مهمة قيد التنفيذ</b>
          </header>
          <div
            className="landing-person landing-swap"
            key={`task-${taskIndex}`}
          >
            <i>{task.initial}</i>
            <div>
              <b>{task.name}</b>
              <small>{task.task}</small>
            </div>
          </div>
          <ul className="landing-meta">
            <li>
              <span>المشروع</span>
              <b className="landing-swap" key={`project-${taskIndex}`}>
                {task.project}
              </b>
            </li>
            <li>
              <span>الأولوية</span>
              <b className="is-pending">عالية</b>
            </li>
          </ul>
          <p>
            <Clock3 size={14} />{" "}
            <span className="landing-swap" key={`due-${taskIndex}`}>
              الاستحقاق خلال {taskIndex + 2} أيام
            </span>
          </p>
        </div>

        <div
          className={`landing-card landing-card-attendance${active("project")}`}
        >
          {beatIndex === 0 && (
            <span className="landing-toast" key={`toast-${tick}`}>
              <FolderKanban size={12} /> {percent}%
            </span>
          )}
          <header>
            <span className="landing-card-tag">المشاريع</span>
            <b>تقدّم المشروع</b>
          </header>
          <div className="landing-ring-row">
            <span className="landing-ring">
              <svg viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  pathLength="100"
                  style={{ strokeDasharray: `${percent} 100` }}
                />
              </svg>
              <b className="landing-swap" key={`pct-${percent}`}>
                {percent}%
              </b>
            </span>
            <span className="landing-avatars">
              {["س", "م", "ن"].map((name) => (
                <i key={name} className="landing-pop">
                  {name}
                </i>
              ))}
              <i>+</i>
            </span>
          </div>
          <p>
            <CircleCheckBig size={14} />{" "}
            <span className="landing-swap" key={`completed-${completed}`}>
              {completed} من {total} مهمة مكتملة
            </span>
          </p>
        </div>

        <div className="landing-hub">
          <svg
            className="landing-hub-lines landing-hub-lines-wide"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            fill="none"
          >
            {links("wide")}
            {packet("wide")}
          </svg>
          <svg
            className="landing-hub-lines landing-hub-lines-stacked"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            fill="none"
          >
            {links("stacked")}
            {packet("stacked")}
          </svg>
          {(["tr", "tl", "br", "bl"] as const).map((key) => (
            <i
              key={key}
              className={`landing-hub-node landing-hub-node-${key}${beat.link === key ? " is-active" : ""}`}
            />
          ))}
          <span
            className="landing-flow-chip landing-flow-chip-right is-current"
            key={`chip-${tick}`}
          >
            <beat.Icon size={13} strokeWidth={2.6} /> {beat.chip}
          </span>
          <span
            className="landing-flow-chip landing-flow-chip-left"
            key={`chip-prev-${tick}`}
          >
            <previous.Icon size={13} /> {previous.chip}
          </span>
          <div className="landing-core">
            <span className="landing-core-pulse" key={`pulse-${tick}`} />
            <StarMark size={34} />
            <b dir="ltr">Sanaa Tasks</b>
            <small>مساحة عمل واحدة</small>
          </div>
        </div>

        <div className={`landing-card landing-card-leave${active("done")}`}>
          <header>
            <span className="landing-card-tag">الإنجاز</span>
            <b>اعتماد الإنجاز</b>
          </header>
          <div
            className="landing-person landing-swap"
            key={`done-${doneIndex}`}
          >
            <i>{done.initial}</i>
            <div>
              <b>{done.name}</b>
              <small>{done.task}</small>
            </div>
          </div>
          <ul className="landing-meta">
            <li>
              <span>المتبقي في المشروع</span>
              <b className="landing-swap" key={`left-${doneIndex}-${finished}`}>
                {finished ? done.left - 1 : done.left} مهام
              </b>
            </li>
            <li>
              <span>الحالة</span>
              {finished ? (
                <b className="is-ok landing-swap" key="finished">
                  مكتملة
                </b>
              ) : (
                <b className="is-pending" key="open">
                  قيد المراجعة
                </b>
              )}
            </li>
          </ul>
          {finished ? (
            <div className="landing-leave-done landing-swap">
              <Check size={14} strokeWidth={3} /> أُبلغ الفريق بالإنجاز
            </div>
          ) : (
            <div className="landing-leave-actions">
              <span>إنجاز</span>
              <span>تعليق</span>
            </div>
          )}
        </div>

        <div className={`landing-card landing-card-payroll${active("load")}`}>
          <header>
            <span className="landing-card-tag">الفريق</span>
            <b>عبء العمل</b>
          </header>
          <div className="landing-bars">
            {bars.map((height, index) => (
              <i key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
          <p>
            <CalendarDays size={14} />{" "}
            <span className="landing-swap" key={`load-${beatIndex === 1}`}>
              {beatIndex === 1 ? "جارٍ توزيع المهام…" : "العبء متوازن"}
            </span>
          </p>
        </div>
      </div>

      <div className="landing-panel-foot" aria-hidden="true">
        <span>
          <UsersRound size={14} /> {SCENE_TEAM} عضوًا
        </span>
        <span>
          <FolderKanban size={14} /> 6 مشاريع
        </span>
        <span>
          <ListChecks size={14} /> {total} مهمة
        </span>
        <span className="landing-panel-sync">
          <i className="landing-feed-dot" />
          <span className="landing-swap" key={`feed-${tick}`}>
            {feed}
          </span>
        </span>
      </div>
    </div>
  );
}

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Sections fade in once; without JS or with reduced motion everything is simply visible.
  useEffect(() => {
    const root = rootRef.current;
    if (
      !root ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    )
      return;
    root.dataset.motion = "on";
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    root
      .querySelectorAll("[data-reveal]")
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="landing" id="top" dir="rtl" lang="ar" ref={rootRef}>
      <header
        className={`landing-header${scrolled ? " is-scrolled" : ""}${menuOpen ? " is-open" : ""}`}
      >
        <div className="landing-shell landing-header-row">
          <Wordmark />
          <nav className="landing-nav" aria-label="أقسام الصفحة">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={closeMenu}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="landing-header-actions">
            <a className="landing-btn landing-btn-ghost" href={LOGIN_HASH}>
              <LogIn size={18} /> تسجيل الدخول
            </a>
            <a
              className="landing-btn landing-btn-primary landing-header-demo"
              href={DEMO_HREF}
            >
              احجز عرضًا
            </a>
            <button
              type="button"
              className="landing-menu"
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-nav"
              aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        <nav
          id="landing-mobile-nav"
          className="landing-mobile-nav"
          aria-label="أقسام الصفحة"
          hidden={!menuOpen}
        >
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={closeMenu}>
              {item.label}
            </a>
          ))}
          <a
            className="landing-btn landing-btn-primary"
            href={DEMO_HREF}
            onClick={closeMenu}
          >
            احجز عرضًا
          </a>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-shell landing-hero-grid">
            <div className="landing-hero-copy" data-reveal>
              <p className="landing-eyebrow">
                <span dir="ltr">SANAA TASKS</span> إدارة المشاريع والمهام
              </p>
              <h1 className="landing-title">
                كل مشاريعك ومهامك،
                <br />
                <span>في مكان واحد.</span>
              </h1>
              <p className="landing-lead">
                سنع Tasks تجمع المشاريع والمهام والفريق والتقويم والتقارير في
                مساحة عمل واحدة، لتعرف من يعمل على ماذا ومتى، وتنجز في الموعد
                بوضوح.
              </p>
              <div className="landing-cta-row">
                <a
                  className="landing-btn landing-btn-primary landing-btn-lg"
                  href={LOGIN_HASH}
                >
                  ابدأ الآن <ArrowLeft size={20} />
                </a>
                <a
                  className="landing-btn landing-btn-outline landing-btn-lg"
                  href={DEMO_HREF}
                >
                  احجز عرضًا
                </a>
              </div>
            </div>
            <div className="landing-hero-stage" data-reveal>
              <TasksScene />
            </div>
          </div>
        </section>

        <section
          className="landing-section"
          id="platform"
          aria-labelledby="platform-title"
        >
          <div className="landing-shell">
            <div className="landing-section-head" data-reveal>
              <p className="landing-kicker">إمكانات سنع Tasks</p>
              <h2 id="platform-title">من الفكرة إلى الإنجاز، في نظام واحد</h2>
              <p>
                تسع إمكانات مترابطة ترافق مشروعك في كل مرحلة: من التخطيط، إلى
                التنفيذ اليومي، حتى المتابعة والتقارير.
              </p>
            </div>
            <ol className="landing-roadmap">
              {STAGES.map((stage, stageIndex) => (
                <li className="landing-stage" key={stage.title}>
                  <header className="landing-stage-head" data-reveal>
                    <span dir="ltr">
                      {String(stageIndex + 1).padStart(2, "0")}
                    </span>
                    <h3>{stage.title}</h3>
                  </header>
                  <ol className="landing-stage-steps">
                    {stage.modules.map(
                      ({ Icon, name, lead, points }, index) => (
                        <li key={name} data-reveal>
                          <span className="landing-road-node" dir="ltr">
                            {String(stageIndex * 3 + index + 1).padStart(
                              2,
                              "0",
                            )}
                          </span>
                          <article className="landing-step-card">
                            <header>
                              <span className="landing-step-icon">
                                <Icon size={20} strokeWidth={1.8} />
                              </span>
                              <h4>{name}</h4>
                            </header>
                            <p>{lead}</p>
                            <ul>
                              {points.map((point) => (
                                <li key={point}>
                                  <Check size={13} strokeWidth={2.6} />
                                  {point}
                                </li>
                              ))}
                            </ul>
                          </article>
                        </li>
                      ),
                    )}
                  </ol>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="landing-section landing-section-tint"
          id="benefits"
          aria-labelledby="benefits-title"
        >
          <div className="landing-shell">
            <div className="landing-section-head" data-reveal>
              <p className="landing-kicker">المزايا</p>
              <h2 id="benefits-title">مصممة لتجعل العمل الجماعي أسهل كل يوم</h2>
            </div>
            <div className="landing-bento">
              {BENEFITS.map(({ Icon, title, text, ...rest }) => (
                <article
                  className={`landing-benefit${"wide" in rest ? " is-wide" : ""}`}
                  key={title}
                  data-reveal
                >
                  <span className="landing-benefit-icon">
                    <Icon size={24} strokeWidth={1.7} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  {"wide" in rest && (
                    <div className="landing-benefit-flow" aria-hidden="true">
                      <span>إنجاز</span>
                      <i />
                      <span>مهام</span>
                      <i />
                      <span>مشاريع</span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="landing-section"
          id="why"
          aria-labelledby="why-title"
        >
          <div className="landing-shell landing-why">
            <div className="landing-why-copy" data-reveal>
              <p className="landing-kicker">لماذا Tasks</p>
              <h2 id="why-title">لأن فريقك يستحق عملًا أوضح</h2>
              <p className="landing-why-lead">
                حين تُدار المهام بين الرسائل والجداول والاجتماعات، تضيع
                المسؤوليات وتتأخر المواعيد. سنع Tasks يضع كل ذلك في مسار واحد
                واضح.
              </p>
              <div className="landing-pillars">
                {PILLARS.map(({ Icon, title, text }) => (
                  <div className="landing-pillar" key={title}>
                    <span>
                      <Icon size={22} strokeWidth={1.7} />
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="landing-compare" data-reveal>
              <div className="landing-compare-col is-before">
                <h3>قبل سنع Tasks</h3>
                <ul>
                  <li>
                    <X size={16} /> مهام موزعة بين الرسائل والجداول
                  </li>
                  <li>
                    <X size={16} /> لا أحد يعرف من المسؤول عن ماذا
                  </li>
                  <li>
                    <X size={16} /> مواعيد تفوت دون تنبيه
                  </li>
                  <li>
                    <X size={16} /> تقدّم المشروع يُحسب يدويًا
                  </li>
                </ul>
              </div>
              <div className="landing-compare-col is-after">
                <h3>
                  <StarMark size={16} /> مع سنع Tasks
                </h3>
                <ul>
                  <li>
                    <Check size={16} strokeWidth={2.5} /> كل المهام في مساحة
                    واحدة
                  </li>
                  <li>
                    <Check size={16} strokeWidth={2.5} /> مسؤول وموعد وأولوية
                    لكل مهمة
                  </li>
                  <li>
                    <Check size={16} strokeWidth={2.5} /> تذكيرات قبل الاستحقاق
                    وعند التأخر
                  </li>
                  <li>
                    <Check size={16} strokeWidth={2.5} /> تقدّم يُحسب تلقائيًا
                    من المهام
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-stats" aria-label="سنع Tasks بالأرقام">
          <div className="landing-shell">
            <ul>
              {STATS.map((stat) => (
                <li key={stat.label} data-reveal>
                  <b dir="ltr">{stat.value}</b>
                  {stat.unit && <span>{stat.unit}</span>}
                  <p>{stat.label}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          className="landing-section"
          id="start"
          aria-labelledby="start-title"
        >
          <div className="landing-shell">
            <div className="landing-section-head" data-reveal>
              <p className="landing-kicker">كيف تبدأ</p>
              <h2 id="start-title">
                من أول دخول إلى أول مهمة منجزة، بثلاث خطوات
              </h2>
            </div>
            <ol className="landing-steps">
              {STEPS.map((step, index) => (
                <li key={step.title} data-reveal>
                  <span className="landing-step-number" dir="ltr">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="landing-final"
          id="demo"
          aria-labelledby="final-title"
        >
          <div className="landing-shell">
            <div className="landing-final-panel" data-reveal>
              <div>
                <h2 id="final-title">جاهز لتنظيم عمل فريقك؟</h2>
                <p>
                  سجّل الدخول إلى سنع Tasks، أو احجز عرضًا توضيحيًا ليرى فريقك
                  كيف تعمل المنصة على مشاريعكم.
                </p>
              </div>
              <div className="landing-cta-row">
                <a
                  className="landing-btn landing-btn-light landing-btn-lg"
                  href={LOGIN_HASH}
                >
                  <LogIn size={20} /> تسجيل الدخول
                </a>
                <a
                  className="landing-btn landing-btn-onDark landing-btn-lg"
                  href={DEMO_HREF}
                >
                  احجز عرضًا
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer-grid">
          <div className="landing-footer-brand">
            <Wordmark />
            <p>
              سنع Tasks نظام لإدارة المشاريع والمهام ضمن منصة سنع، يجمع المشاريع
              والمهام والفريق والتقارير في مكان واحد.
            </p>
          </div>
          <div>
            <h3>الإمكانات</h3>
            <ul>
              <li>
                <a href="#platform">المشاريع</a>
              </li>
              <li>
                <a href="#platform">المهام</a>
              </li>
              <li>
                <a href="#platform">التقارير</a>
              </li>
            </ul>
          </div>
          <div>
            <h3>تعرّف علينا</h3>
            <ul>
              <li>
                <a href="#benefits">المزايا</a>
              </li>
              <li>
                <a href="#why">لماذا Tasks</a>
              </li>
              <li>
                <a href="#start">كيف تبدأ</a>
              </li>
            </ul>
          </div>
          <div>
            <h3>ابدأ</h3>
            <ul>
              <li>
                <a href={LOGIN_HASH}>تسجيل الدخول</a>
              </li>
              <li>
                <a href={DEMO_HREF}>احجز عرضًا</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="landing-shell landing-footer-base">
          <span>
            © {new Date().getFullYear()} Sanaa Tasks. جميع الحقوق محفوظة.
          </span>
          <span>
            <BadgeCheck size={16} /> عمل منظّم بثقة ووضوح
          </span>
        </div>
      </footer>
    </div>
  );
}
