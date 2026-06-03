/* FF Pollham — minimal vanilla JS
   - Sticky header solid-on-scroll
   - Mobile nav toggle
   - Smooth anchor scroll with header offset
   - Reveal-on-scroll via IntersectionObserver
   - Footer year
*/
(() => {
  "use strict";

  const header = document.getElementById("siteHeader");
  const navToggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("primary-nav");
  const body = document.body;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Header solid on scroll ---------- */
  const setHeaderState = () => {
    if (window.scrollY > 30) {
      header.classList.add("is-solid");
    } else if (!body.classList.contains("nav-open")) {
      header.classList.remove("is-solid");
    }
  };
  setHeaderState();
  window.addEventListener("scroll", setHeaderState, { passive: true });

  /* ---------- Mobile nav toggle ---------- */
  if (navToggle && nav) {
    const closeNav = () => {
      body.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Menü öffnen");
      setHeaderState();
    };
    const openNav = () => {
      body.classList.add("nav-open");
      navToggle.setAttribute("aria-expanded", "true");
      navToggle.setAttribute("aria-label", "Menü schließen");
      header.classList.add("is-solid");
    };

    navToggle.addEventListener("click", () => {
      if (body.classList.contains("nav-open")) closeNav();
      else openNav();
    });

    // Close on link click (mobile)
    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        if (body.classList.contains("nav-open")) closeNav();
      });
    });

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && body.classList.contains("nav-open")) closeNav();
    });

    // Close when viewport grows past mobile breakpoint
    const mq = window.matchMedia("(min-width: 860px)");
    mq.addEventListener("change", (e) => { if (e.matches) closeNav(); });
  }

  /* ---------- Smooth scroll with header offset ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href === "#" || href.length < 2) return;
    link.addEventListener("click", (e) => {
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const headerH = header ? header.offsetHeight : 0;
      const y = target.getBoundingClientRect().top + window.scrollY - headerH + 1;
      window.scrollTo({ top: y, behavior: prefersReduced ? "auto" : "smooth" });
      if (history.replaceState) history.replaceState(null, "", href);
    });
  });

  /* ---------- Reveal on scroll ---------- */
  const revealTargets = document.querySelectorAll(
    ".section-head, .about-text, .stat, .team-card, .tl-item, .news-card, .contact-card, .lead, .ext-command"
  );
  revealTargets.forEach((el) => el.classList.add("reveal"));

  if ("IntersectionObserver" in window && !prefersReduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // tiny stagger inside the same observer batch
          const target = entry.target;
          const delay = Math.min(i * 60, 240);
          setTimeout(() => target.classList.add("is-visible"), delay);
          io.unobserve(target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Lazy-load events + news ---------- */
  const dateFmtFull  = new Intl.DateTimeFormat("de-AT", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const dateFmtDay   = new Intl.DateTimeFormat("de-AT", { day: "2-digit" });
  const dateFmtMonth = new Intl.DateTimeFormat("de-AT", { month: "short" });
  const timeFmt      = new Intl.DateTimeFormat("de-AT", { hour: "2-digit", minute: "2-digit" });
  const newsDateFmt  = new Intl.DateTimeFormat("de-AT", { day: "numeric", month: "long", year: "numeric" });

  const escapeHtml = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const renderEvents = (list, events, fallbackUrl) => {
    list.removeAttribute("aria-busy");
    if (!events || events.length === 0) {
      list.innerHTML = `<li class="event-empty">Aktuell sind keine kommenden Termine eingetragen.</li>`;
      return;
    }
    list.innerHTML = events.map((ev) => {
      const start = new Date(ev.start);
      const day   = dateFmtDay.format(start);
      const month = dateFmtMonth.format(start).replace(".", "");
      const full  = dateFmtFull.format(start);
      const time  = ev.all_day ? "Ganztägig" : timeFmt.format(start) + " Uhr";
      const loc   = ev.location ? `<p class="event-loc">${escapeHtml(ev.location)}</p>` : "";
      return `
        <li class="event-card reveal">
          <div class="event-date" aria-hidden="true">
            <span class="event-day">${escapeHtml(day)}</span>
            <span class="event-month">${escapeHtml(month)}</span>
          </div>
          <div class="event-body">
            <p class="event-when"><time datetime="${start.toISOString()}">${escapeHtml(full)} · ${escapeHtml(time)}</time></p>
            <h3 class="event-title">${escapeHtml(ev.title || "Termin")}</h3>
            ${loc}
          </div>
        </li>`;
    }).join("");
    list.querySelectorAll(".reveal").forEach((el, i) => {
      setTimeout(() => el.classList.add("is-visible"), Math.min(i * 70, 350));
    });
  };

  const renderEventsError = (list, fallbackUrl) => {
    list.removeAttribute("aria-busy");
    list.innerHTML = `
      <li class="event-error">
        Termine konnten gerade nicht geladen werden.
        ${fallbackUrl ? `<a href="${escapeHtml(fallbackUrl)}" target="_blank" rel="noopener">Termine direkt im Kalender ansehen →</a>` : ""}
      </li>`;
  };

  const loadEvents = (wrap) => {
    const list        = wrap.querySelector(".events-list");
    const endpoint    = wrap.dataset.endpoint || "data/events.json";
    const fallbackUrl = wrap.dataset.fallbackUrl;
    fetch(endpoint, { headers: { Accept: "application/json" } })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((data) => {
        if (data && data.error) throw new Error(data.error);
        renderEvents(list, data.events || [], fallbackUrl);
      })
      .catch(() => renderEventsError(list, fallbackUrl));
  };

  const tagLabel = { event: "Termin", news: "Bericht", mission: "Einsatz" };
  const tagClass = { event: "news-tag-event", news: "news-tag-news", mission: "news-tag-mission" };

  const renderNews = (list, items) => {
    list.removeAttribute("aria-busy");
    if (!items || items.length === 0) {
      list.innerHTML = `<li class="news-empty">Aktuell keine Beiträge.</li>`;
      return;
    }
    list.innerHTML = items.map((it) => {
      const tag       = (it.tag || "news").toLowerCase();
      const cls       = tagClass[tag] || tagClass.news;
      const label     = tagLabel[tag] || tagLabel.news;
      const date      = it.date ? new Date(it.date) : null;
      const dateLabel = date ? newsDateFmt.format(date) : "";
      const dateAttr  = date ? date.toISOString().slice(0, 10) : "";
      return `
        <li class="news-card reveal">
          <div class="news-tag ${cls}">${escapeHtml(label)}</div>
          ${dateLabel ? `<p class="news-date"><time datetime="${escapeHtml(dateAttr)}">${escapeHtml(dateLabel)}</time></p>` : ""}
          <h3 class="news-title">${escapeHtml(it.title || "")}</h3>
          ${it.excerpt ? `<p class="news-excerpt">${escapeHtml(it.excerpt)}</p>` : ""}
        </li>`;
    }).join("");
    list.querySelectorAll(".reveal").forEach((el, i) => {
      setTimeout(() => el.classList.add("is-visible"), Math.min(i * 70, 350));
    });
  };

  const loadNews = (list) => {
    // Quelle: entweder ein Inline-<script type="application/json"> (Default, funktioniert lokal)
    // oder optional eine externe JSON-URL via data-endpoint
    const sourceSel = list.dataset.source;
    const endpoint  = list.dataset.endpoint;

    const renderFromText = (text) => {
      try {
        const data  = JSON.parse(text);
        const items = Array.isArray(data) ? data : (data.items || []);
        renderNews(list, items);
      } catch (e) {
        list.removeAttribute("aria-busy");
        list.innerHTML = `<li class="news-empty">Beiträge konnten nicht gelesen werden.</li>`;
      }
    };

    if (sourceSel) {
      const node = document.querySelector(sourceSel);
      if (node) { renderFromText(node.textContent); return; }
    }
    if (endpoint) {
      fetch(endpoint, { headers: { Accept: "application/json" } })
        .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
        .then(renderFromText)
        .catch(() => {
          list.removeAttribute("aria-busy");
          list.innerHTML = `<li class="news-empty">Beiträge konnten gerade nicht geladen werden.</li>`;
        });
      return;
    }
    list.removeAttribute("aria-busy");
    list.innerHTML = `<li class="news-empty">Keine Beitragsquelle konfiguriert.</li>`;
  };

  // Lazy-load when near viewport (saves API call if visitor never scrolls)
  const lazy = (el, fn) => {
    if (!el) return;
    if (!("IntersectionObserver" in window)) { fn(); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { fn(); io.disconnect(); }
      });
    }, { rootMargin: "300px 0px 300px 0px" });
    io.observe(el);
  };

  document.querySelectorAll("[data-events]").forEach((wrap) => lazy(wrap, () => loadEvents(wrap)));
  document.querySelectorAll("[data-news]").forEach((list) => lazy(list, () => loadNews(list)));
})();
