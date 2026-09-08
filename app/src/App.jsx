import { InstallBanner, InstallMenuButton } from "./InstallPrompt.jsx";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
} from "chart.js";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarBlank,
  Camera,
  CaretRight,
  ChartBar,
  CheckCircle,
  Clock,
  FilePdf,
  Info,
  List,
  LockKey,
  MagnifyingGlass,
  SignOut,
  TennisBall,
  Trophy,
  Users,
  X,
} from "@phosphor-icons/react";
Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
);
const plural = (n, forms) => {
  const v = n % 100;
  return `${n} ${forms[v > 10 && v < 20 ? 2 : n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2]}`;
};
const tournamentsCount = (n) => plural(n, ["турнир", "турнира", "турниров"]);
const number = (n) => new Intl.NumberFormat("ru-RU").format(n);
const formatDate = (date, options = { day: "numeric", month: "long" }) =>
  date
    ? new Date(
        date + (date.length === 10 ? "T12:00:00" : ""),
      ).toLocaleDateString("ru-RU", options)
    : "Дата уточняется";
const routeFromLocation = () => location.hash.slice(1) || "/ranking";
const go = (path) => {
  location.hash = path;
};
async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "Не удалось загрузить данные");
    error.status = response.status;
    throw error;
  }
  return body;
}
const ImageVariants = createContext({});
function ClubImage({src, sizes, className = "", loading, ...props}) {
  const variants = useContext(ImageVariants)[src];
  const avatar = className.split(" ").includes("avatar");
  return <img {...props} className={className} decoding="async" loading={loading}
    src={variants?.at(-1)?.url || src}
    srcSet={variants?.map(v => `${v.url} ${v.width}w`).join(", ")}
    sizes={sizes || (avatar ? "64px" : "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw")} />;
}

function Brand({ compact = false }) {
  return (
    <a
      className={`brand ${compact ? "compact" : ""}`}
      href="#/ranking"
      aria-label="OUT Club — рейтинг"
    >
      <span className="brand-mark">
        <ClubImage src="/assets/out-logo.webp" alt="" />
      </span>
      <span>
        <strong>OUT</strong>
        <small>TENNIS CLUB</small>
      </span>
    </a>
  );
}
function Loading() {
  return (
    <main className="loading-screen">
      <TennisBall size={42} weight="duotone" className="loading-ball" />
      <p>Загружаем клуб…</p>
    </main>
  );
}
function Login({ onLogin }) {
  const [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/api/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setPassword("");
      await onLogin();
    } catch (e) {
      setError(
        e.status === 401
          ? "Пароль не подошёл. Проверьте и попробуйте ещё раз."
          : e.status === 429
            ? "Слишком много попыток. Попробуйте немного позже."
            : "Не получилось войти. Проверьте соединение и попробуйте снова.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <header>
        <Brand />
        <span className="private-tag">
          <LockKey size={17} /> Только для клуба
        </span>
      </header>
      <div className="login-layout">
        <div className="login-story">
          <p className="eyebrow">OUT CLUB TOUR · 2026</p>
          <h1>Out Tennis Club</h1>
          <p className="login-lead">Попасть могут не все</p>
          <div className="login-lines">
            <span>РЕЙТИНГ</span>
            <span>ИГРОКИ</span>
            <span>ТУРНИРЫ</span>
          </div>
        </div>
        <section className="login-panel">
          <div className="lock-badge">
            <LockKey size={27} />
          </div>
          <h2>ВХОД В КЛУБ</h2>
          <p>
            Введите общий пароль OUT.
            <br />
            Пароль выдаёт организатор клуба.
          </p>
          <form onSubmit={submit}>
            <label htmlFor="club-password">Пароль клуба</label>
            <input
              id="club-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              required
              aria-describedby={error ? "login-error" : undefined}
            />
            {error && (
              <p className="form-error" id="login-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy || !password}>
              {busy ? "Входим…" : "ВОЙТИ"}
              <ArrowRight size={20} />
            </button>
          </form>
          <div className="login-note">
            <CheckCircle size={18} /> Вход сохранится на этом устройстве
          </div>
        </section>
      </div>
      <footer>Увидимся на корте.</footer>
    </main>
  );
}
function navigationFor(route) {
  const active = route.startsWith("/player")
    ? "players"
    : route.startsWith("/tournament")
      ? "tournaments"
      : "ranking";
  const links = [
    ["ranking", "Рейтинг", ChartBar],
    ["players", "Игроки", Users],
    ["tournaments", "Турниры", Trophy],
  ];
  return {active, links};
}
function Header({ route, season, onLogout }) {
  const {active, links} = navigationFor(route);
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [route]);
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label="Основная навигация">
            {links.map(([id, label]) => (
              <a
                key={id}
                href={"#/" + id}
                className={active === id ? "active" : ""}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="header-right">
            <span className="season">
              СЕЗОН <b>{season}</b>
            </span>
            <span className="private-tag">
              <LockKey size={16} weight="bold" /> Только для клуба
            </span>
            <button
              className="icon-button desktop-logout"
              onClick={onLogout}
              aria-label="Выйти из клуба"
              title="Выйти"
            >
              <SignOut size={20} />
            </button>
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label={menu ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={menu}
            >
              {menu ? <X size={28} /> : <List size={29} />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-dropdown" aria-label="Меню клуба">
            <a href="#/rules">Правила и данные</a>
            <InstallMenuButton />
            <button onClick={onLogout}>
              <SignOut />
              Выйти из клуба
            </button>
          </nav>
        )}
      </header>

    </>
  );
}
function BottomNav({route}) {
  const {active, links} = navigationFor(route);
  return (
      <nav className="bottom-nav" aria-label="Разделы клуба">
        {links.map(([id, label, Icon]) => (
          <a
            key={id}
            href={"#/" + id}
            className={active === id ? "active" : ""}
          >
            <Icon size={24} weight={active === id ? "fill" : "regular"} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
  );
}
function Tabs({ items, value, onChange, label, prefix }) {
  function keydown(event, index) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    onChange(items[next][0]);
    document.getElementById(`${prefix}-tab-${items[next][0]}`)?.focus();
  }
  return (
    <div className="container tabs" role="tablist" aria-label={label}>
      {items.map(([key, text], i) => (
        <button
          key={key}
          id={`${prefix}-tab-${key}`}
          role="tab"
          aria-selected={value === key}
          aria-controls={`${prefix}-panel`}
          tabIndex={value === key ? 0 : -1}
          className={value === key ? "active" : ""}
          onClick={() => onChange(key)}
          onKeyDown={(e) => keydown(e, i)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
function Avatar({ player, large = false }) {
  return player?.portrait || player?.photo ? (
    <ClubImage
      className={`avatar ${large ? "large" : ""}`}
      src={player.portrait || player.photo}
      alt={player.name}
      loading="lazy"
    />
  ) : (
    <span className={`avatar initials ${large ? "large" : ""}`}>
      {player?.name?.slice(0, 1) || "—"}
    </span>
  );
}
function SectionHeading({ title, subtitle, children }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
function Search({ value, onChange, placeholder }) {
  return (
    <label className="search-field">
      <MagnifyingGlass size={20} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button onClick={() => onChange("")} aria-label="Очистить поиск">
          <X size={17} />
        </button>
      )}
    </label>
  );
}
function Empty({ title = "Пока нет данных", text, icon: Icon = Info }) {
  return (
    <div className="empty-state">
      <Icon size={32} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
    </div>
  );
}
function displayPerson(name, club) {
  const candidates = club.players.filter((p) =>
    [p.name, p.sourceName, ...(p.aliases || [])].includes(name),
  );
  return candidates.length === 1 ? candidates[0].name : name;
}
function displaySide(names, club, ids) {
  return names
    .map((name, i) =>
      ids?.[i]
        ? club.players.find((p) => p.id === ids[i])?.name || name
        : displayPerson(name, club),
    )
    .join(" / ");
}
function Category({ tournament }) {
  if (tournament.status === "planned")
    return <span className="category upcoming-label">ПРЕДСТОЯЩИЙ ТУРНИР</span>;
  return (
    <span
      className={`category ${tournament.format === "doubles" ? "doubles" : ""}`}
    >
      {tournament.format === "doubles"
        ? "ПАРНЫЙ · "
        : tournament.format === null
          ? "ФОРМАТ УТОЧНЯЕТСЯ · "
          : ""}
      {tournament.category}
      {!tournament.rated ? " · ВНЕ РЕЙТИНГА" : ""}
    </span>
  );
}
function Ranking({ club }) {
  const [search, setSearch] = useState("");
  const players = [...club.players].sort((a, b) => a.rank - b.rank),
    visible = players.filter((p) =>
      [p.name, ...(p.aliases || [])].some((name) =>
        name
          .toLocaleLowerCase("ru")
          .replaceAll("ё", "е")
          .includes(search.toLocaleLowerCase("ru").replaceAll("ё", "е")),
      ),
    );
  const completed = club.tournaments.filter((t) => t.status === "completed"),
    latest = [...completed].sort((a, b) =>
      (b.date || "").localeCompare(a.date || ""),
    )[0];
  return (
    <>
      <section className="ranking-hero">
        <div className="container">
          <div className="ranking-title">
            <div>
              <p className="eyebrow">OUT CLUB TOUR · {club.season}</p>
              <h1>
                ИГРА ЗА
                <br className="only-mobile" /> ПЕРВОЕ МЕСТО.
              </h1>
            </div>
            <div className="hero-counter">
              <strong>{players.length}</strong>
              <span>
                ИГРОКОВ
                <br />В РЕЙТИНГЕ
              </span>
            </div>
          </div>
          <div className="podium">
            {players.slice(0, 3).map((p) => (
              <a
                className={"podium-player podium-" + p.rank}
                key={p.id}
                href={"#/player/" + p.id}
              >
                <span className="podium-rank">0{p.rank}</span>
                <div className="podium-photo">
                  {p.portrait || p.photo ? (
                    <ClubImage
                      src={p.portrait || p.photo}
                      className={p.portrait ? "cutout" : ""}
                      alt={p.name}
                    />
                  ) : (
                    <Avatar player={p} />
                  )}
                </div>
                <div className="podium-info">
                  <span className="podium-name">{p.name}</span>
                  <strong>{number(p.points)}</strong>
                  <span>ОЧКОВ</span>
                </div>
                <ArrowUpRight className="podium-arrow" size={22} />
              </a>
            ))}
          </div>
        </div>
      </section>
      <main className="container ranking-main">
        <section>
          <SectionHeading
            title="РЕЙТИНГ СЕЗОНА"
            subtitle="Каждый турнир — часть твоей истории."
          >
            <Search
              value={search}
              onChange={setSearch}
              placeholder="Найти игрока"
            />
          </SectionHeading>
          <div className="table-wrap">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>МЕСТО</th>
                  <th>ИГРОК</th>
                  <th>ОЧКИ</th>
                  <th>ТУРНИРЫ</th>
                  <th aria-label="Профиль" />
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td className="rank-number">
                      {p.rank <= 3 ? (
                        <span className="rank-medal">{p.rank}</span>
                      ) : (
                        p.rank
                      )}
                    </td>
                    <td>
                      <a href={"#/player/" + p.id} className="player-cell">
                        <Avatar player={p} />
                        <span>{p.name}</span>
                      </a>
                    </td>
                    <td className="points-number">{number(p.points)}</td>
                    <td className="appearances-number">{p.results.length}</td>
                    <td>
                      <a
                        className="row-link"
                        href={"#/player/" + p.id}
                        aria-label={"Профиль: " + p.name}
                      >
                        <ArrowUpRight size={20} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!visible.length && (
            <Empty title="Игрок не найден" text="Попробуйте другое имя." />
          )}
          <p className="source-note">
            <Clock size={15} />
            Обновлено {formatDate(club.updatedAt)}
            <a href="#/rules">
              Как считается рейтинг <ArrowUpRight size={14} />
            </a>
          </p>
        </section>
        <aside className="ranking-aside">
          {latest && (
            <>
              <div className="aside-eyebrow">
                <Trophy size={23} weight="duotone" />
                ПОСЛЕДНИЙ ТУРНИР
              </div>
              <h2>{latest.name}</h2>
              <Category tournament={latest} />
              <p className="aside-date">{formatDate(latest.date)}</p>
              <a className="text-link" href={"#/tournament/" + latest.id}>
                Смотреть результаты
                <ArrowRight size={20} />
              </a>
              {latest.photos?.[0] && (
                <ClubImage
                  className="aside-photo"
                  src={latest.photos[0].url}
                  alt={latest.photos[0].caption || latest.name}
                  loading="lazy"
                />
              )}
            </>
          )}
          <div className="aside-club">
            <TennisBall size={32} />
            <p>
              Больше, чем счёт.
              <br />
              <strong>Наш клуб. Наша игра.</strong>
            </p>
          </div>
        </aside>
      </main>
    </>
  );
}
function Players({ club }) {
  const [search, setSearch] = useState(""),
    [sort, setSort] = useState("rank");
  const players = club.players
    .filter((p) =>
      [p.name, ...(p.aliases || [])].some((name) =>
        name
          .toLocaleLowerCase("ru")
          .replaceAll("ё", "е")
          .includes(search.toLocaleLowerCase("ru").replaceAll("ё", "е")),
      ),
    )
    .sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name, "ru") : a.rank - b.rank,
    );
  return (
    <main className="container page-pad">
      <div className="page-title">
        <p className="eyebrow green">ЛЮДИ OUT</p>
        <h1>НАШИ ИГРОКИ</h1>
        <p>
          {club.players.length} игроков рейтинга сезона {club.season}
        </p>
      </div>
      <div className="filter-row">
        <Search
          value={search}
          onChange={setSearch}
          placeholder="Найти игрока"
        />
        <label className="select-label">
          Порядок
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="rank">По рейтингу</option>
            <option value="name">По имени</option>
          </select>
        </label>
      </div>
      <div className="player-grid">
        {players.map((p) => (
          <a className="player-card" href={"#/player/" + p.id} key={p.id}>
            <span className="card-rank">{String(p.rank).padStart(2, "0")}</span>
            <div className="player-card-photo">
              {p.portrait || p.photo ? (
                <ClubImage
                  src={p.portrait || p.photo}
                  className={p.portrait ? "cutout" : ""}
                  alt={p.name}
                  loading="lazy"
                />
              ) : (
                <div className="missing-portrait">
                  <Users size={72} weight="thin" />
                  <span>ФОТО СКОРО ПОЯВИТСЯ</span>
                </div>
              )}
            </div>
            <div className="player-card-bottom">
              <h2>{p.name}</h2>
              <ArrowUpRight size={23} />
              <p>
                <strong>{number(p.points)}</strong> очков <span>·</span>{" "}
                {tournamentsCount(p.results.length)}
              </p>
            </div>
          </a>
        ))}
      </div>
      {!players.length && <Empty title="Игрок не найден" />}
    </main>
  );
}
function PointsChart({ player, tournaments }) {
  const canvas = useRef(null);
  const results = useMemo(
    () =>
      player.results
        .map((r) => ({
          ...r,
          tournament: tournaments.find((t) => t.id === r.tournamentId),
        }))
        .filter((r) => r.tournament?.date)
        .sort((a, b) => a.tournament.date.localeCompare(b.tournament.date)),
    [player, tournaments],
  );
  useEffect(() => {
    if (!canvas.current || !results.length) return;
    let sum = 0;
    const chart = new Chart(canvas.current, {
      type: "line",
      data: {
        labels: results.map((r) =>
          formatDate(r.tournament.date, { day: "numeric", month: "short" }),
        ),
        datasets: [
          {
            data: results.map((r) => (sum += r.points)),
            borderColor: "#177252",
            backgroundColor: "rgba(23,114,82,.07)",
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: "#177252",
            borderWidth: 2,
            tension: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 0
            : 450,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => results[items[0].dataIndex].tournament.name,
              label: (item) =>
                `${number(item.parsed.y)} очков · +${results[item.dataIndex].points}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: "Manrope", size: 11 },
              maxRotation: 0,
              maxTicksLimit: 6,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: "#e6eae6" },
            border: { display: false },
            ticks: { font: { family: "Manrope", size: 11 }, maxTicksLimit: 5 },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [results]);
  return (
    <div className="points-chart">
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Накопленные очки игрока ${player.name}: ${results.map((r) => `${r.tournament.name}: плюс ${r.points}`).join(", ")}`}
      />
    </div>
  );
}
function Player({ club, id }) {
  const player = club.players.find((p) => p.id === id),
    [tab, setTab] = useState("overview");
  useEffect(() => setTab("overview"), [id]);
  if (!player) return <NotFound />;
  const results = player.results
    .map((r) => ({
      ...r,
      tournament: club.tournaments.find((t) => t.id === r.tournamentId),
    }))
    .filter((r) => r.tournament)
    .sort((a, b) =>
      (b.tournament.date || "").localeCompare(a.tournament.date || ""),
    );
  const single = results.filter((r) => r.tournament.format === "singles"),
    pairs = results.filter((r) => r.tournament.format === "doubles");
  return (
    <>
      <section className="player-hero">
        <div className="container player-hero-inner">
          <a href="#/players" className="breadcrumb light">
            <ArrowLeft size={16} />
            ИГРОКИ / ПРОФИЛЬ
          </a>
          <div className="hero-number" aria-hidden="true">
            {String(player.rank).padStart(2, "0")}
          </div>
          <div
            className={`player-title ${player.name.length > 5 ? "long-name" : ""}`}
          >
            <p className="eyebrow">OUT CLUB TOUR</p>
            <h1
              className={`${player.name.includes(" ") ? "full-name" : ""} ${Math.max(...player.name.split(" ").map((s) => s.length)) > 8 ? "name-wide" : ""}`}
            >
              {player.name.split(" ").map((part, i) => (
                <span key={i}>{part}</span>
              ))}
            </h1>
          </div>
          <div
            className={"hero-portrait " + (!player.portrait ? "original" : "")}
          >
            {player.portrait || player.photo ? (
              <ClubImage src={player.portrait || player.photo} alt={player.name} />
            ) : (
              <Users size={140} weight="thin" />
            )}
          </div>
          <div className="hero-stat-area">
            <div className="season-label">СЕЗОН {club.season}</div>
            <div className="hero-stats">
              <div>
                <span>МЕСТО</span>
                <strong>{player.rank}</strong>
              </div>
              <div>
                <span>ОЧКИ СЕЗОНА</span>
                <strong>{number(player.points)}</strong>
              </div>
              <div>
                <span>ТУРНИРЫ</span>
                <strong>{player.results.length}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="tabs-shell">
        <Tabs
          items={[
            ["overview", "Обзор"],
            ["tournaments", "Турниры"],
            ["stats", "Статистика"],
          ]}
          value={tab}
          onChange={setTab}
          label="Профиль игрока"
          prefix="profile"
        />
      </div>
      <main
        className="container profile-content"
        role="tabpanel"
        id="profile-panel"
        aria-labelledby={`profile-tab-${tab}`}
      >
        {tab === "overview" && player.bio && <PlayerBio bio={player.bio} />}
        {tab === "stats" ? (
          <>
            <SectionHeading
              title="СЕЗОН В ЦИФРАХ"
              subtitle="Очки и выступления в турнирах клуба."
            />
            <div className="split-stats">
              <div>
                <TennisBall size={27} />
                <h3>ОДИНОЧНЫЕ</h3>
                <strong>
                  {number(single.reduce((s, r) => s + r.points, 0))}
                </strong>
                <span>очков · {tournamentsCount(single.length)}</span>
              </div>
              <div>
                <Users size={27} />
                <h3>ПАРНЫЕ</h3>
                <strong>
                  {number(pairs.reduce((s, r) => s + r.points, 0))}
                </strong>
                <span>очков · {tournamentsCount(pairs.length)}</span>
              </div>
            </div>
            <SectionHeading title="ОЧКИ ЗА СЕЗОН" />
            <PointsChart player={player} tournaments={club.tournaments} />
            <div className="info-note">
              <Info size={20} />
              <p>
                История отдельных матчей дополняется. Процент побед появится
                после проверки результатов.
              </p>
            </div>
          </>
        ) : (
          <>
            <SectionHeading
              title={
                tab === "overview" ? "ПОСЛЕДНИЕ ТУРНИРЫ" : "ТУРНИРЫ ИГРОКА"
              }
              subtitle={
                tab === "tournaments"
                  ? `${plural(results.length, ["выступление", "выступления", "выступлений"])} в сезоне`
                  : undefined
              }
            >
              {tab === "overview" && (
                <button
                  className="text-link"
                  onClick={() => setTab("tournaments")}
                >
                  Все турниры
                  <ArrowRight size={18} />
                </button>
              )}
            </SectionHeading>
            <ResultList
              results={tab === "overview" ? results.slice(0, 4) : results}
            />
            {tab === "overview" && (
              <section className="chart-section">
                <SectionHeading title="ОЧКИ ЗА СЕЗОН" />
                <PointsChart player={player} tournaments={club.tournaments} />
              </section>
            )}
          </>
        )}
        <p className="source-note">
          Рейтинг сезона {club.season} · Обновлено {formatDate(club.updatedAt)}
          <a href="#/rules">
            О данных
            <ArrowUpRight size={14} />
          </a>
        </p>
      </main>
    </>
  );
}
function PlayerBio({bio}) {
  return <section className="player-bio" aria-label="Об игроке">
    <SectionHeading title="ОБ ИГРОКЕ" subtitle="За пределами турнирной таблицы." />
    <div className="player-bio-layout">
      <dl className="player-bio-facts">
        <div><dt>Дата рождения</dt><dd>{formatDate(bio.birthDate, {day: "numeric", month: "long", year: "numeric"})}</dd></div>
        <div><dt>В клубе с</dt><dd>{bio.clubSince} года</dd></div>
        <div><dt>Род деятельности</dt><dd>{bio.occupation}</dd></div>
        <div><dt>Любимый удар</dt><dd>{bio.favoriteShot}</dd></div>
      </dl>
      <figure className="player-bio-quote">
        <span className="eyebrow">ЛЮБИМАЯ ЦИТАТА</span>
        <blockquote>{bio.quote}</blockquote>
        {bio.quoteAttribution && <figcaption>{bio.quoteAttribution}</figcaption>}
      </figure>
    </div>
  </section>;
}

function ResultList({ results }) {
  return results.length ? (
    <div className="result-list">
      {results.map((r) => (
        <a
          key={r.tournamentId}
          href={"#/tournament/" + r.tournamentId}
          className="result-row"
        >
          <div className="result-date">
            <strong>
              {r.tournament.date
                ? new Date(r.tournament.date + "T12:00:00").getDate()
                : "—"}
            </strong>
            <span>
              {r.tournament.date
                ? formatDate(r.tournament.date, { month: "short" }).replace(
                    ".",
                    "",
                  )
                : ""}
            </span>
          </div>
          <div className="result-title">
            <h3>{r.tournament.name}</h3>
            <Category tournament={r.tournament} />
          </div>
          <strong className="result-points">+{number(r.points)}</strong>
          <ArrowUpRight size={20} />
        </a>
      ))}
    </div>
  ) : (
    <Empty title="Выступлений пока нет" />
  );
}
function Tournaments({ club }) {
  const [status, setStatus] = useState("completed"),
    [format, setFormat] = useState("all");
  const visible = club.tournaments
    .filter(
      (t) => t.status === status && (format === "all" || t.format === format),
    )
    .sort((a, b) =>
      status === "completed"
        ? (b.date || "").localeCompare(a.date || "")
        : (a.date || "z").localeCompare(b.date || "z"),
    );
  return (
    <main className="container page-pad">
      <div className="page-title">
        <p className="eyebrow green">OUT CLUB TOUR · {club.season}</p>
        <h1>ТУРНИРЫ КЛУБА</h1>
        <p>Все встречи сезона. Все эмоции на корте.</p>
      </div>
      <div className="filter-row">
        <div className="segmented" aria-label="Статус турниров">
          <button
            className={status === "completed" ? "active" : ""}
            onClick={() => setStatus("completed")}
          >
            Прошедшие
          </button>
          <button
            className={status === "planned" ? "active" : ""}
            onClick={() => setStatus("planned")}
          >
            Впереди
          </button>
        </div>
        <label className="select-label">
          Формат
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="all">Все турниры</option>
            <option value="singles">Одиночные</option>
            <option value="doubles">Парные</option>
          </select>
        </label>
      </div>
      <div className="tournament-grid">
        {visible.map((t) => (
          <a
            className="tournament-card"
            key={t.id}
            href={"#/tournament/" + t.id}
          >
            <div
              className={`tournament-cover ${t.cover ? "art-cover" : "photo-cover"}`}
              data-event={t.id}
            >
              {t.cover ? (
                <ClubImage
                  src={t.cover.url}
                  alt={`Иллюстрация: ${t.name}`}
                  loading="lazy"
                />
              ) : t.photos?.[0] ? (
                <ClubImage
                  src={t.photos[0].url}
                  alt={t.photos[0].caption || t.name}
                  loading="lazy"
                />
              ) : (
                <div className="event-art">
                  <TennisBall size={78} weight="thin" />
                  <span>OUT CLUB TOUR</span>
                </div>
              )}
              <span className="date-badge">
                {formatDate(t.date, { day: "numeric", month: "short" })}
              </span>
            </div>
            <div className="tournament-card-body">
              <Category tournament={t} />
              <h2>{t.name}</h2>
              <p>
                <CalendarBlank size={17} />
                {t.venue || "Место уточняется"}
              </p>
              <div className="card-bottom">
                <span>
                  {t.status === "completed"
                    ? `${t.participants.length} игроков с очками`
                    : "В календаре сезона"}
                </span>
                <ArrowUpRight size={23} />
              </div>
            </div>
          </a>
        ))}
      </div>
      {!visible.length && (
        <Empty title="Турниров пока нет" text="Попробуйте другой формат." />
      )}
      {status === "planned" && (
        <div className="info-note">
          <Info size={20} />
          <p>
            Даты и составы объявляются в чате клуба. Здесь они появятся после
            обновления календаря.
          </p>
        </div>
      )}
    </main>
  );
}
function Gallery({ photos }) {
  const [index, setIndex] = useState(null);
  const close = useRef(null),
    lastFocus = useRef(null);
  useEffect(() => {
    if (index === null) return;
    lastFocus.current = document.activeElement;
    close.current?.focus();
    const key = (e) => {
      if (e.key === "Escape") setIndex(null);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % photos.length);
      if (e.key === "ArrowLeft")
        setIndex((i) => (i - 1 + photos.length) % photos.length);
      if (e.key === "Tab") {
        const buttons = [...document.querySelectorAll(".lightbox button")];
        const i = buttons.indexOf(document.activeElement);
        const next = e.shiftKey
          ? (i - 1 + buttons.length) % buttons.length
          : (i + 1) % buttons.length;
        e.preventDefault();
        buttons[next]?.focus();
      }
    };
    document.addEventListener("keydown", key);
    const scroll = document.getElementById("club-scroll");
    const prevScroll = scroll?.style.overflow;
    if (scroll) scroll.style.overflow = "hidden";
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = prev;
      if (scroll) scroll.style.overflow = prevScroll;
      lastFocus.current?.focus();
    };
  }, [index, photos.length]);
  return photos.length ? (
    <>
      <div className="gallery">
        {photos.map((photo, i) => (
          <button
            key={photo.url}
            onClick={() => setIndex(i)}
            aria-label={`Открыть фото ${i + 1}: ${photo.caption || ""}`}
          >
            <ClubImage
              src={photo.url}
              alt={photo.caption || `Фото турнира ${i + 1}`}
              loading="lazy"
            />
            <span>
              <Camera size={20} />
            </span>
          </button>
        ))}
      </div>
      {index !== null && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Фотографии турнира"
          onClick={() => setIndex(null)}
        >
          <button
            ref={close}
            className="lightbox-close"
            onClick={() => setIndex(null)}
            aria-label="Закрыть фото"
          >
            <X size={28} />
          </button>
          <button
            className="lightbox-prev"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((index - 1 + photos.length) % photos.length);
            }}
            aria-label="Предыдущее фото"
          >
            <ArrowLeft size={27} />
          </button>
          <figure onClick={(e) => e.stopPropagation()}>
            <ClubImage
              src={photos[index].url}
              sizes="100vw"
              alt={photos[index].caption || "Фото турнира"}
            />
            <figcaption>
              {photos[index].caption}
              <span>
                {index + 1} / {photos.length}
              </span>
            </figcaption>
          </figure>
          <button
            className="lightbox-next"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((index + 1) % photos.length);
            }}
            aria-label="Следующее фото"
          >
            <ArrowRight size={27} />
          </button>
        </div>
      )}
    </>
  ) : (
    <Empty
      icon={Camera}
      title="Фотографии появятся позже"
      text="Добавим снимки из клубного архива."
    />
  );
}
function Tournament({ club, id }) {
  const t = club.tournaments.find((t) => t.id === id),
    [tab, setTab] = useState("overview");
  useEffect(() => setTab("overview"), [id]);
  if (!t) return <NotFound />;
  const participants = t.participants
    .map((id) => club.players.find((p) => p.id === id))
    .filter(Boolean);
  const tabs = [
    ["overview", "Обзор"],
    ["participants", "Участники"],
    ["schedule", "Расписание"],
    ["groups", "Группы"],
    ["bracket", "Сетки"],
    ["photos", "Фото"],
  ];
  return (
    <>
      <section className="tournament-hero">
        <div className="container">
          <a href="#/tournaments" className="breadcrumb light">
            <ArrowLeft size={16} />
            ТУРНИРЫ / {club.season}
          </a>
          <div className="tournament-hero-heading">
            <div>
              <Category tournament={t} />
              <h1>{t.name}</h1>
              <p className="event-date">
                {formatDate(t.date)}
                {t.endDate && t.endDate !== t.date
                  ? " — " + formatDate(t.endDate)
                  : ""}
                {t.date ? " " + club.season : ""}
              </p>
              <p className="event-venue">{t.venue || "Место уточняется"}</p>
            </div>
            <div className="event-hero-symbol">
              <Trophy size={106} weight="thin" />
            </div>
          </div>
          {t.documents?.length > 0 && (
            <a
              className="document-hero-link"
              href={t.documents[0].url}
              target="_blank"
              rel="noreferrer"
            >
              <FilePdf size={20} />
              Регламент
              <ArrowUpRight size={18} />
            </a>
          )}
        </div>
      </section>
      {t.phases?.length > 0 && (
        <div className="event-timeline">
          <div className="container">
            {t.phases.map((phase, i) => (
              <div key={i}>
                <span>
                  {formatDate(phase.date, { day: "numeric", month: "short" })}
                </span>
                <strong>{phase.label}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="tabs-shell">
        <Tabs
          items={tabs}
          value={tab}
          onChange={setTab}
          label="Разделы турнира"
          prefix="event"
        />
      </div>
      <main
        className="container event-content"
        role="tabpanel"
        id="event-panel"
        aria-labelledby={`event-tab-${tab}`}
      >
        {tab === "overview" && (
          <>
            <div className="event-overview-grid">
              <section>
                <SectionHeading
                  title={
                    t.status === "completed" ? "ИТОГИ ТУРНИРА" : "О ТУРНИРЕ"
                  }
                />
                {t.description && (
                  <p className="event-description">{t.description}</p>
                )}
                {t.results.length > 0 ? (
                  <div className="event-results">
                    {[...t.results]
                      .sort((a, b) => b.points - a.points)
                      .map((r) => {
                        const p = club.players.find((p) => p.id === r.playerId);
                        return (
                          p && (
                            <a
                              className="event-result"
                              key={p.id}
                              href={"#/player/" + p.id}
                            >
                              <Avatar player={p} />
                              <span>{p.name}</span>
                              <strong>+{number(r.points)}</strong>
                              <ArrowUpRight size={17} />
                            </a>
                          )
                        );
                      })}
                    <p className="tiny-note">
                      Начисленные очки участникам рейтинга клуба
                    </p>
                  </div>
                ) : (
                  <Empty
                    title="Результатов пока нет"
                    text={
                      t.status === "planned"
                        ? "Турнир впереди. Итоги появятся после его проведения."
                        : "История этого турнира дополняется."
                    }
                  />
                )}
              </section>
              <aside className="event-details">
                <h3>О СОБЫТИИ</h3>
                <dl>
                  <div>
                    <dt>Формат</dt>
                    <dd>
                      {t.format === "doubles"
                        ? "Парный"
                        : t.format === "singles"
                          ? "Одиночный"
                          : "Уточняется"}
                    </dd>
                  </div>
                  <div>
                    <dt>Категория</dt>
                    <dd>{t.category || "Уточняется"}</dd>
                  </div>
                  <div>
                    <dt>Рейтинг</dt>
                    <dd>{t.rated ? "Учитывается" : "Вне рейтинга"}</dd>
                  </div>
                </dl>
                {t.documents.length > 0 && (
                  <>
                    <h3>ДОКУМЕНТЫ</h3>
                    {t.documents.map((d) => (
                      <a
                        className="document-link"
                        key={d.url}
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FilePdf size={22} />
                        <span>{d.name}</span>
                        <ArrowUpRight size={17} />
                      </a>
                    ))}
                  </>
                )}
                <div className="club-operations-note">
                  <Info size={20} />
                  <p>Все организационные вопросы — в чате OUT.</p>
                </div>
              </aside>
            </div>
            {t.photos.length > 0 && (
              <section className="event-photo-preview">
                <SectionHeading title="НА КОРТЕ">
                  <button
                    className="text-link"
                    onClick={() => setTab("photos")}
                  >
                    Все фотографии
                    <ArrowRight size={18} />
                  </button>
                </SectionHeading>
                <Gallery photos={t.photos.slice(0, 3)} />
              </section>
            )}
          </>
        )}
        {tab === "participants" && (
          <>
            {t.pairs?.length > 0 && (
              <section className="event-pairs">
                <SectionHeading title="ПАРЫ ТУРНИРА" />
                <div className="pairs-grid">
                  {t.pairs.map((pair, i) => (
                    <div key={i}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <strong>{displaySide(pair.names, club)}</strong>
                    </div>
                  ))}
                </div>
                <p className="tiny-note">
                  Составы пар из объявления клуба. Подтверждённые имена уточнены
                  по составу OUT.
                </p>
              </section>
            )}
            <SectionHeading
              title="УЧАСТНИКИ"
              subtitle="Игроки, представленные в клубном рейтинге этого турнира."
            />
            <div className="participants-grid">
              {participants.map((p) => (
                <a key={p.id} href={"#/player/" + p.id}>
                  <Avatar player={p} />
                  <span>{p.name}</span>
                  <ArrowUpRight size={18} />
                </a>
              ))}
            </div>
            {!participants.length && (
              <Empty
                title="Состав ещё не опубликован"
                text="Добавим участников после объявления в чате."
              />
            )}
            <p className="tiny-note">
              Состав может быть неполным: гости вне рейтинга показаны только
              там, где подтверждены исходными материалами.
            </p>
          </>
        )}
        {tab === "schedule" && (
          <>
            <SectionHeading title="РАСПИСАНИЕ МАТЧЕЙ" />
            {t.schedule?.length > 0 ? (
              <>
                <div className="schedule-list">
                  {t.schedule.map((game, i) => (
                    <div key={i}>
                      <strong>{game.time}</strong>
                      <span>{game.court}</span>
                      <p>
                        {displaySide(game.sideA, club)}
                        <b>—</b>
                        {displaySide(game.sideB, club)}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="tiny-note">
                  Расписание из объявления клуба. Оно не подтверждает, что матч
                  был сыгран; фактические счета показаны отдельно.
                </p>
              </>
            ) : (
              <Empty
                icon={CalendarBlank}
                title="Детальное расписание пока не добавлено"
                text="Дни этапов указаны вверху страницы, подробности — в регламенте турнира."
              />
            )}
          </>
        )}
        {tab === "groups" && (
          <>
            <SectionHeading title="ГРУППОВОЙ ЭТАП" />
            {t.groups?.length > 0 && (
              <div className="groups-grid">
                {t.groups.map((group, i) => (
                  <section key={i}>
                    <h3>{group.name}</h3>
                    {group.standings ? (
                      <table className="group-standings">
                        <thead>
                          <tr>
                            <th>Игрок</th>
                            <th title="Матчи">И</th>
                            <th title="Победы">В</th>
                            <th title="Поражения">П</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.standings.map((row, j) => (
                            <tr
                              key={row.name}
                              className={j === 0 ? "group-winner" : ""}
                            >
                              <td>{displayPerson(row.name, club)}</td>
                              <td>{row.played}</td>
                              <td>{row.wins}</td>
                              <td>{row.losses}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      group.players.map((p, j) => (
                        <p key={j}>
                          <span>{j + 1}</span>
                          {p}
                        </p>
                      ))
                    )}
                  </section>
                ))}
              </div>
            )}
            {t.matches.length > 0 ? (
              <>
                <h3 className="subheading">РЕЗУЛЬТАТЫ МАТЧЕЙ</h3>
                <div className="match-list">
                  {t.matches.map((m) => (
                    <div className="match-row" key={m.id}>
                      <span>{displaySide(m.sideA, club, m.playerAIds)}</span>
                      <strong>{m.score}</strong>
                      <span>{displaySide(m.sideB, club, m.playerBIds)}</span>
                    </div>
                  ))}
                </div>
                <p className="tiny-note">
                  Подтверждённые имена показаны с фамилиями; остальные подписи
                  сохранены из архива.
                </p>
              </>
            ) : (
              <Empty
                icon={TennisBall}
                title="Счета матчей ещё не добавлены"
                text="Добавим подтверждённые результаты из клубного архива."
              />
            )}
            <CoverageNote text={t.coverageNote} />
          </>
        )}
        {tab === "bracket" && (
          <>
            <SectionHeading title="СЕТКИ ТУРНИРА" />
            {t.bracket?.length > 0 ? (
              <div className="bracket-stages">
                {t.bracket.map((stage, i) => (
                  <section key={i}>
                    <span className="stage-index">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3>{stage.name}</h3>
                      <p>{stage.description}</p>
                      {stage.participants?.length > 0 && (
                        <div className="stage-participants">
                          {stage.participants.map((name) => (
                            <span key={name}>{displayPerson(name, club)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {i < t.bracket.length - 1 && (
                      <CaretRight className="stage-arrow" size={25} />
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <Empty
                icon={Trophy}
                title="Сетка пока не восстановлена"
                text="Добавим её по подтверждённым материалам турнира."
              />
            )}
            <CoverageNote
              text={
                t.coverageNote ||
                "Полная сетка с участниками и счетами появится после проверки клубного архива."
              }
            />
          </>
        )}
        {tab === "photos" && (
          <>
            <SectionHeading
              title="ФОТОГРАФИИ"
              subtitle="Наши встречи, победы и моменты на корте."
            />
            <Gallery photos={t.photos} />
          </>
        )}
      </main>
    </>
  );
}
function CoverageNote({ text }) {
  return text ? (
    <div className="info-note">
      <Info size={20} />
      <p>{text}</p>
    </div>
  ) : null;
}
function Rules({ club }) {
  return (
    <main className="container page-pad reading-page">
      <a className="breadcrumb" href="#/ranking">
        <ArrowLeft size={16} />К рейтингу
      </a>
      <p className="eyebrow green">OUT CLUB TOUR</p>
      <h1>РЕЙТИНГ И ДАННЫЕ</h1>
      <p className="lead">
        Результаты сезона — из официальной таблицы клуба и материалов турниров.
      </p>
      <section>
        <h2>КАК СЧИТАЮТСЯ ОЧКИ</h2>
        {club.rules.summary.map((r, i) => (
          <p key={i}>{r}</p>
        ))}
        <CoverageNote text={club.rules.ratingNote} />
      </section>
      <section>
        <h2>ЧТО ЕСТЬ В АРХИВЕ</h2>
        <div className="coverage-stats">
          <div>
            <strong>{club.coverage.players}</strong>
            <span>игроков</span>
          </div>
          <div>
            <strong>{club.coverage.photos}</strong>
            <span>портретов</span>
          </div>
          <div>
            <strong>{club.coverage.tournaments}</strong>
            <span>турниров в календаре</span>
          </div>
        </div>
        {club.coverage.notes.map((r, i) => (
          <p key={i}>{r}</p>
        ))}
      </section>
      <p className="source-note">Обновлено {formatDate(club.updatedAt)}</p>
    </main>
  );
}
function NotFound() {
  return (
    <main className="container page-pad">
      <Empty title="Страница не найдена" text="Возможно, ссылка устарела." />
      <a className="button primary" href="#/ranking">
        К рейтингу
        <ArrowRight />
      </a>
    </main>
  );
}
function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <Brand compact />
        <span>НАШ КЛУБ. НАША ИГРА.</span>
        <a href="#/rules">
          О рейтинге и данных
          <ArrowUpRight size={15} />
        </a>
      </div>
    </footer>
  );
}
export function App() {
  const [status, setStatus] = useState("loading"),
    [club, setClub] = useState(null),
    [route, setRoute] = useState(routeFromLocation),
    [error, setError] = useState("");
  async function load() {
    try {
      const data = await request("/api/club");
      setClub(data);
      setStatus("ready");
      setError("");
    } catch (e) {
      setStatus(e.status === 401 ? "login" : "error");
      setError("Не удалось загрузить клуб. Попробуйте ещё раз.");
    }
  }
  useEffect(() => {
    request("/api/session")
      .then((session) => (session.authenticated ? load() : setStatus("login")))
      .catch(() => {
        setStatus("error");
        setError("Сервис временно недоступен. Попробуйте ещё раз.");
      });
  }, []);
  useEffect(() => {
    const update = () => {
      setRoute(routeFromLocation());
      window.scrollTo({ top: 0, behavior: "instant" });
      document.getElementById("club-scroll")?.scrollTo({top: 0, behavior: "instant"});
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    document.title = club
      ? "OUT Tennis Club · " +
        (route.startsWith("/player/")
          ? club.players.find((p) => p.id === route.split("/")[2])?.name ||
            "Игрок"
          : route.startsWith("/tournament/")
            ? club.tournaments.find((t) => t.id === route.split("/")[2])
                ?.name || "Турнир"
            : "Сезон 2026")
      : "OUT Tennis Club";
  }, [route, club]);
  async function logout() {
    try {
      await request("/api/logout", { method: "POST", body: "{}" });
      setClub(null);
      setStatus("login");
    } catch {
      setError("Не удалось выйти. Проверьте соединение и повторите попытку.");
    }
  }
  if (status === "loading") return <Loading />;
  if (status === "login") return <Login onLogin={load} />;
  if (status === "error")
    return (
      <main className="loading-screen">
        <Info size={38} />
        <h1>НУЖНА ПЕРЕПОДАЧА</h1>
        <p>{error}</p>
        <button className="button primary" onClick={load}>
          Попробовать снова
          <ArrowRight />
        </button>
      </main>
    );
  const parts = route.split("/").filter(Boolean);
  let page;
  if (parts[0] === "ranking") page = <Ranking club={club} />;
  else if (parts[0] === "players") page = <Players club={club} />;
  else if (parts[0] === "player") page = <Player club={club} id={parts[1]} />;
  else if (parts[0] === "tournaments") page = <Tournaments club={club} />;
  else if (parts[0] === "tournament")
    page = <Tournament club={club} id={parts[1]} />;
  else if (parts[0] === "rules") page = <Rules club={club} />;
  else page = <NotFound />;
  return (
    <ImageVariants.Provider value={club.imageVariants || {}}>
      <div className="club-shell">
      <div className="club-scroll" id="club-scroll">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          const el = document.getElementById("main-content");
          el.tabIndex = -1;
          el.focus();
          el.scrollIntoView();
        }}
      >
        К содержимому
      </a>
      <Header route={route} season={club.season} onLogout={logout} />
      <InstallBanner />
      {error && (
        <div className="global-error" role="alert">
          {error}
        </div>
      )}
      <div id="main-content" key={parts[0]}>
        {page}
      </div>
      <Footer />
      </div>
      <BottomNav route={route} />
      </div>
    </ImageVariants.Provider>
  );
}
