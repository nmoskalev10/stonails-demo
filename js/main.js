(function () {
  let d = SITE_DATA;

  /* ---------- helpers ---------- */

  function esc(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  function list(items) {
    return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function waLink(text) {
    return `https://wa.me/${d.settings.contacts.whatsapp}?text=${encodeURIComponent(text)}`;
  }

  function tgLink(text) {
    return `https://t.me/${d.settings.contacts.telegram}?text=${encodeURIComponent(text)}`;
  }

  function ctaButtons(ctaText) {
    const ui = d.settings.ui;
    const text = ctaText || ui.defaultMessage;
    return `
      <div class="cta-row">
        <a class="btn btn-dark" href="${waLink(text)}" target="_blank" rel="noopener">${esc(ui.btnWhatsapp)}</a>
        <a class="btn btn-dark" href="${tgLink(text)}" target="_blank" rel="noopener">${esc(ui.btnTelegram)}</a>
      </div>`;
  }

  /* ---------- hero / about ---------- */

  function renderChrome() {
    const { brand, ui } = d.settings;

    document.getElementById("hero-eyebrow").textContent = brand.eyebrow;
    document.getElementById("hero-title").textContent = brand.name;
    document.getElementById("hero-tagline").textContent = brand.tagline;
    document.getElementById("hero-cta").textContent = ui.heroCta;

    document.getElementById("final-title").textContent = ui.finalTitle;
    document.getElementById("final-text").textContent = ui.finalText;
    document.getElementById("footer-brand").textContent = ui.footerBrand;
    document.getElementById("footer-note").textContent = ui.footerNote;

    document.title = `${brand.name.toLowerCase()} — ${ui.footerNote}`;

    [["footer-whatsapp", waLink], ["sticky-whatsapp", waLink]].forEach(([id, fn]) => {
      const el = document.getElementById(id);
      el.href = fn(ui.defaultMessage);
      el.textContent = ui.btnWhatsapp;
    });
    [["footer-telegram", tgLink], ["sticky-telegram", tgLink]].forEach(([id, fn]) => {
      const el = document.getElementById(id);
      el.href = fn(ui.defaultMessage);
      el.textContent = ui.btnTelegram;
    });
  }

  function renderAbout() {
    const a = d.about;
    // В данных лежит имя файла из хранилища, а не готовый адрес — как и у фото
    // в блоке работ. Без photoUrl браузер искал бы файл в корне сайта.
    const avatar = a.avatar.image
      ? `<img src="${esc(Store.photoUrl(a.avatar.image))}" alt="">`
      : esc(a.avatar.emoji);

    document.getElementById("about").innerHTML = `
      <div class="avatar ${a.avatar.image ? "avatar--photo" : ""}" data-reveal>${avatar}</div>
      <div class="about-text" data-reveal>
        ${a.text.map((p) => `<p>${esc(p)}</p>`).join("")}
      </div>
      <ul class="stats">
        ${a.stats.map((s) => `
          <li data-reveal>
            <strong data-count="${esc(s.value)}">0</strong>
            <span>${esc(s.label)}</span>
          </li>
        `).join("")}
      </ul>
    `;
  }

  /* ---------- courses ---------- */

  // One renderer for every section; `layout` decides how it looks.
  function renderSection(s) {
    const heading = s.heading
      ? `<h4>${esc(s.heading)}</h4>`
      : "";

    let body = "";

    if (s.layout === "columns") {
      body = `
        <div class="blocks-grid">
          ${s.groups.map((g) => `
            <div class="block-item">
              ${g.title ? `<h4>${esc(g.title)}</h4>` : ""}
              ${list(g.items)}
            </div>
          `).join("")}
        </div>`;
    } else if (s.layout === "cards") {
      const items = s.groups.flatMap((g) => g.items);
      body = `
        <div class="blocks-grid">
          ${items.map((i) => `<div class="feature-item">${esc(i)}</div>`).join("")}
        </div>`;
    } else if (s.layout === "grouped") {
      body = `
        <div class="program-grid program-grid--wide">
          ${s.groups.map((g) => `
            <div class="program-item">
              ${g.title ? `<strong>${esc(g.title)}</strong>` : ""}
              ${list(g.items)}
            </div>
          `).join("")}
        </div>`;
    } else {
      // "plain" — a simple bulleted list
      body = s.groups.map((g) => `
        ${g.title ? `<h4>${esc(g.title)}</h4>` : ""}
        ${list(g.items)}
      `).join("");
    }

    return `<div class="card-section">${heading}${body}</div>`;
  }

  function courseCard(c) {
    const classes = ["card"];
    if (c.wide) classes.push("card-wide");
    if (c.highlight) classes.push("highlight");

    const head = c.wide
      ? `
        <header class="card-head">
          <h3>${esc(c.title)}</h3>
          ${c.price ? `<div class="price-tag">${esc(c.price.value)}</div>` : ""}
          ${c.price && c.price.note ? `<p class="price-note">${esc(c.price.note)}</p>` : ""}
        </header>`
      : `
        ${c.badge ? `<span class="card-badge ${c.highlight ? "card-badge--accent" : ""}">${esc(c.badge)}</span>` : ""}
        <h3>${esc(c.title)}</h3>
        ${c.meta && c.meta.length ? `
          <div class="meta-row">
            ${c.meta.map((m) => `<span class="meta-pill">${esc(m)}</span>`).join("")}
          </div>` : ""}
        ${c.price ? `<div class="price-tag">${esc(c.price.value)}</div>` : ""}
        ${c.price && c.price.note ? `<p class="price-note">${esc(c.price.note)}</p>` : ""}`;

    return `
      <article class="${classes.join(" ")}" data-reveal>
        ${head}
        ${(c.sections || []).map(renderSection).join("")}
        ${c.note ? `<div class="audience-box">${esc(c.note)}</div>` : ""}
        ${ctaButtons(c.ctaText)}
      </article>
    `;
  }

  // A block is either a group of cards (tariffs / sibling courses) or a single course.
  function courseBlock(block) {
    const children = block.tariffs || block.courses;

    const header = `
      ${block.title && children ? `<h2 class="section-title" data-reveal>${esc(block.title)}</h2>` : ""}
      ${block.subtitle ? `<p class="section-sub" data-reveal>${esc(block.subtitle)}</p>` : ""}`;

    if (children) {
      return `
        <div class="course-block">
          ${header}
          <div class="card-grid">${children.map(courseCard).join("")}</div>
        </div>`;
    }

    return `<div class="course-block">${courseCard(block)}</div>`;
  }

  function renderGroups() {
    const nav = document.getElementById("tabs-switch");
    const panels = document.getElementById("panels");

    nav.style.setProperty("--tabs-count", d.groups.length);
    nav.innerHTML = `
      <span class="tabs-thumb" aria-hidden="true"></span>
      ${d.groups.map((g) => `<button class="tab-btn" data-tab="${esc(g.id)}">${esc(g.tabLabel)}</button>`).join("")}
    `;

    panels.innerHTML = d.groups.map((g) => `
      <section class="tab-panel container" data-tab="${esc(g.id)}">
        ${g.courses.map(courseBlock).join("")}
      </section>
    `).join("");
  }

  /* ---------- cases ---------- */

  function photoGrid(images) {
    return `
      <div class="photo-grid">
        ${images.map((src) => {
          const url = Store.photoUrl(src);
          return `
            <button class="photo-thumb" type="button" data-full="${esc(url)}" data-reveal>
              <img src="${esc(url)}" alt="" loading="lazy">
            </button>`;
        }).join("")}
      </div>`;
  }

  function renderCases() {
    document.getElementById("cases-content").innerHTML = d.cases.map((block) => {
      if (block.type === "testimonials") {
        return `
          <div class="cases-block">
            <h2 class="cases-subtitle" data-reveal>${esc(block.title)}</h2>
            <div class="testimonial-grid">
              ${block.items.map((t) => `
                <blockquote class="testimonial-card" data-reveal>
                  <p>${esc(t.text).replace(/\n/g, "<br>")}</p>
                  <cite>${esc(t.course)}</cite>
                </blockquote>
              `).join("")}
            </div>
          </div>`;
      }

      return `
        <div class="cases-block">
          <h2 class="cases-subtitle" data-reveal>${esc(block.title)}</h2>
          ${block.subtitle ? `<p class="section-sub" data-reveal>${esc(block.subtitle)}</p>` : ""}
          ${block.groups.map((g) => `
            ${g.label ? `<h3 class="day-label" data-reveal>${esc(g.label)}</h3>` : ""}
            <div class="photo-group">
              ${g.caption ? `<p class="photo-caption" data-reveal>${esc(g.caption)}</p>` : ""}
              ${photoGrid(g.images)}
            </div>
          `).join("")}
        </div>`;
    }).join("");
  }

  /* ---------- tabs ---------- */

  function setupTabs() {
    const wrap = document.getElementById("tabs-switch");
    const buttons = wrap.querySelectorAll(".tab-btn");
    const panels = document.querySelectorAll(".tab-panel");
    const ids = Array.from(buttons).map((b) => b.dataset.tab);

    function activate(tab) {
      const index = Math.max(ids.indexOf(tab), 0);
      wrap.style.setProperty("--tabs-index", index);
      buttons.forEach((b) => b.classList.toggle("active", b.dataset.tab === ids[index]));
      panels.forEach((p) => p.classList.toggle("active", p.dataset.tab === ids[index]));
      revealIn(document.querySelector(`.tab-panel[data-tab="${ids[index]}"]`));
    }

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        activate(btn.dataset.tab);
        history.replaceState(null, "", `#${btn.dataset.tab}`);
      });
    });

    const fromHash = location.hash.replace("#", "");
    activate(ids.includes(fromHash) ? fromHash : ids[0]);
  }

  /* ---------- scroll reveal ---------- */

  let observer = null;

  function setupReveal() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-visible"));
      return;
    }

    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        // Stagger is a timer, not a CSS transition-delay: several elements
        // override `transition` for their hover effects, which would wipe out
        // a delay declared on [data-reveal].
        const delay = prefersReducedMotion() ? 0 : Number(entry.target.dataset.revealIndex || 0) * 80;
        setTimeout(() => entry.target.classList.add("is-visible"), delay);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    revealIn(document);
  }

  function revealIn(root) {
    if (!root || !observer) return;

    root.querySelectorAll("[data-reveal]:not(.is-visible)").forEach((el) => {
      if (el.dataset.revealBound) return;
      el.dataset.revealBound = "1";

      const siblings = Array.from(el.parentElement.children).filter((n) => n.hasAttribute("data-reveal"));
      el.dataset.revealIndex = String(Math.min(siblings.indexOf(el), 6));

      observer.observe(el);
    });
  }

  /* ---------- animated counters ---------- */

  function setupCounters() {
    const nodes = document.querySelectorAll("[data-count]");

    if (!("IntersectionObserver" in window) || prefersReducedMotion()) {
      nodes.forEach((n) => (n.textContent = n.dataset.count));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    nodes.forEach((n) => io.observe(n));
  }

  function countUp(el) {
    const raw = el.dataset.count;
    const target = parseInt(raw, 10);
    const suffix = raw.replace(/^\d+/, "");

    if (isNaN(target)) {
      el.textContent = raw;
      return;
    }

    const duration = 1100;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  /* ---------- lightbox ---------- */

  function setupLightbox() {
    const box = document.getElementById("lightbox");
    const img = box.querySelector("img");

    let gallery = [];
    let index = 0;

    function show(i) {
      index = (i + gallery.length) % gallery.length;
      img.src = gallery[index];
    }

    function open(thumb) {
      gallery = Array.from(thumb.closest(".photo-grid").querySelectorAll(".photo-thumb"))
        .map((t) => t.dataset.full);
      show(gallery.indexOf(thumb.dataset.full));
      box.classList.add("is-open");
      box.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function close() {
      box.classList.remove("is-open");
      box.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    document.addEventListener("click", (e) => {
      const thumb = e.target.closest(".photo-thumb");
      if (thumb) open(thumb);
    });

    box.querySelector(".lightbox-close").addEventListener("click", close);
    box.querySelector(".lightbox-prev").addEventListener("click", () => show(index - 1));
    box.querySelector(".lightbox-next").addEventListener("click", () => show(index + 1));

    box.addEventListener("click", (e) => {
      if (e.target === box) close();
    });

    document.addEventListener("keydown", (e) => {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });
  }

  /* ---------- scroll-driven chrome ---------- */

  function setupScrollChrome() {
    const nav = document.querySelector(".tabs-nav");
    const sticky = document.querySelector(".mobile-sticky");
    const hero = document.querySelector(".hero");

    function onScroll() {
      nav.classList.toggle("is-stuck", nav.getBoundingClientRect().top <= 0);
      sticky.classList.toggle("is-visible", window.scrollY > hero.offsetHeight * 0.8);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- boot ---------- */

  function renderAll() {
    renderChrome();
    renderAbout();
    renderGroups();
    renderCases();
    setupTabs();
  }

  // Свежий контент из базы. Снимок в data.js уже отрисован, поэтому обновление
  // происходит незаметно; если база молчит (бесплатный проект мог заснуть),
  // просто остаёмся на снимке.
  async function refresh() {
    if (!Store.configured) return;
    try {
      const fresh = await Store.fetchContent();
      if (!fresh || !fresh.data || !fresh.data.groups) return;
      if (JSON.stringify(fresh.data) === JSON.stringify(d)) return;

      d = fresh.data;
      renderAll();
      revealIn(document);
      setupCounters();
    } catch (e) {
      // тихо: посетитель уже видит рабочую страницу
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Последний удачный ответ базы, если он есть, свежее снимка в файле.
    const cache = Store.cached();
    if (cache && cache.data && cache.data.groups) d = cache.data;

    renderAll();

    setupReveal();
    setupCounters();
    setupLightbox();
    setupScrollChrome();

    refresh();
  });
})();
