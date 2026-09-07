/*
  Админка: конструктор контента сайта.

  Всё редактирование идёт через один приём — у каждого поля есть data-path
  вида "groups.0.courses.1.title", по которому значение кладётся в state.
  Структурные кнопки (добавить/удалить/переместить) работают так же: им
  передаётся путь до массива. Благодаря этому не нужен отдельный обработчик
  на каждое поле формы.
*/

(function () {
  let state = null;         // редактируемый контент
  let updatedAt = null;     // метка версии — защита от правки из двух окон
  let dirty = false;
  let current = "general";

  const $ = (id) => document.getElementById(id);

  /* ---------- утилиты ---------- */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function get(path, root) {
    return path.split(".").reduce((o, k) => (o == null ? o : o[k]), root || state);
  }

  function set(path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((o, k) => o[k], state);
    target[last] = value;
  }

  function toast(message, bad) {
    const el = $("toast");
    el.textContent = message;
    el.className = "toast" + (bad ? " bad" : "");
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.hidden = true), 3200);
  }

  function markDirty() {
    dirty = true;
    $("status").textContent = "Есть несохранённые изменения";
    $("status").className = "status dirty";
  }

  function markClean() {
    dirty = false;
    $("status").textContent = "Всё сохранено";
    $("status").className = "status";
  }

  window.addEventListener("beforeunload", (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });

  /* ---------- заготовки новых элементов ---------- */

  const blank = {
    item: () => "Новый пункт",
    group: () => ({ title: "Новая группа", items: ["Новый пункт"] }),
    section: () => ({ heading: "Новый раздел", layout: "plain", groups: [{ title: null, items: ["Новый пункт"] }] }),
    course: () => ({
      id: "course-" + Date.now(),
      title: "Новый курс",
      meta: [],
      sections: [],
      ctaText: "Записаться на курс"
    }),
    tariff: () => ({
      id: "tariff-" + Date.now(),
      title: "Новый тариф",
      badge: "",
      highlight: false,
      meta: [],
      sections: [],
      note: "",
      ctaText: "Записаться"
    }),
    stat: () => ({ value: "0", label: "Показатель" }),
    photoGroup: () => ({ caption: "Новая подпись", images: [] }),
    testimonial: () => ({ course: "Курс", text: "Текст отзыва" }),
    casePhotos: () => ({ type: "photos", title: "Новая галерея", subtitle: "", groups: [] }),
    caseTestimonials: () => ({ type: "testimonials", title: "Отзывы", items: [] })
  };

  /* ---------- переиспользуемые куски формы ---------- */

  function field(label, path, opts) {
    const o = opts || {};
    const value = get(path);
    const input = o.multiline
      ? `<textarea data-path="${path}" rows="${o.rows || 3}">${esc(value)}</textarea>`
      : `<input type="text" data-path="${path}" value="${esc(value)}">`;
    return `
      <div class="field">
        <label>${esc(label)}${input}</label>
        ${o.hint ? `<p class="field-hint">${esc(o.hint)}</p>` : ""}
      </div>`;
  }

  // Список простых строк с кнопками удаления и добавления
  function stringList(path, addLabel) {
    const arr = get(path) || [];
    return `
      ${arr.map((v, i) => `
        <div class="line">
          <input type="text" data-path="${path}.${i}" value="${esc(v)}">
          <button class="icon-btn" data-act="move" data-arr="${path}" data-i="${i}" data-to="${i - 1}" title="Выше">&uarr;</button>
          <button class="icon-btn" data-act="move" data-arr="${path}" data-i="${i}" data-to="${i + 1}" title="Ниже">&darr;</button>
          <button class="icon-btn danger" data-act="del" data-arr="${path}" data-i="${i}" title="Удалить">&times;</button>
        </div>`).join("")}
      <button class="btn btn-add btn-small" data-act="add" data-arr="${path}" data-kind="item">+ ${esc(addLabel || "Добавить пункт")}</button>`;
  }

  // Кнопки «выше / ниже / удалить» для элемента массива
  function rowActions(arrPath, index) {
    return `
      <div class="head-actions">
        <button class="icon-btn" data-act="move" data-arr="${arrPath}" data-i="${index}" data-to="${index - 1}" title="Выше">&uarr;</button>
        <button class="icon-btn" data-act="move" data-arr="${arrPath}" data-i="${index}" data-to="${index + 1}" title="Ниже">&darr;</button>
        <button class="icon-btn danger" data-act="del" data-arr="${arrPath}" data-i="${index}" title="Удалить">&times;</button>
      </div>`;
  }

  function sectionEditor(path, index, arrPath) {
    const s = get(path);
    const layouts = [
      ["plain", "Обычный список"],
      ["columns", "Плитки с заголовками"],
      ["cards", "Плитки со звёздочкой"],
      ["grouped", "Плитки с подсписками"]
    ];

    const grouped = s.layout === "columns" || s.layout === "grouped";

    return `
      <div class="sub">
        <div class="head">
          <span class="head-title">Раздел: ${esc(s.heading || "без заголовка")}</span>
          ${rowActions(arrPath, index)}
        </div>

        <div class="row">
          ${field("Заголовок раздела", path + ".heading")}
          <div class="field">
            <label>Как показывать
              <select data-path="${path}.layout">
                ${layouts.map(([v, t]) => `<option value="${v}"${s.layout === v ? " selected" : ""}>${t}</option>`).join("")}
              </select>
            </label>
          </div>
        </div>

        ${grouped
          ? s.groups.map((g, gi) => `
              <div class="sub">
                <div class="head">
                  <span class="head-title">${esc(g.title || "Группа")}</span>
                  ${rowActions(path + ".groups", gi)}
                </div>
                ${field("Заголовок группы", `${path}.groups.${gi}.title`)}
                ${stringList(`${path}.groups.${gi}.items`)}
              </div>`).join("") +
            `<button class="btn btn-add btn-small" data-act="add" data-arr="${path}.groups" data-kind="group">+ Добавить группу</button>`
          : stringList(`${path}.groups.0.items`)}
      </div>`;
  }

  function courseEditor(path, index, arrPath, isTariff) {
    const c = get(path);

    return `
      <div class="card">
        <div class="head">
          <span class="head-title">${esc(c.title)}</span>
          ${rowActions(arrPath, index)}
        </div>

        ${field("Название", path + ".title")}

        ${isTariff ? `
          <div class="row">
            ${field("Плашка", path + ".badge", { hint: "Например: Популярный выбор" })}
            <div class="field">
              <label>Выделить рамкой
                <select data-path="${path}.highlight">
                  <option value="false"${!c.highlight ? " selected" : ""}>Нет</option>
                  <option value="true"${c.highlight ? " selected" : ""}>Да</option>
                </select>
              </label>
            </div>
          </div>` : ""}

        ${c.price ? `
          <div class="row">
            ${field("Цена", path + ".price.value")}
            ${field("Приписка к цене", path + ".price.note")}
          </div>` : ""}

        <div class="field">
          <label>Короткие подписи (длительность, отработки)</label>
          ${stringList(path + ".meta", "Добавить подпись")}
        </div>

        <div class="field">
          <label>Разделы курса</label>
          ${(c.sections || []).map((s, si) => sectionEditor(`${path}.sections.${si}`, si, `${path}.sections`)).join("")}
          <button class="btn btn-add btn-small" data-act="add" data-arr="${path}.sections" data-kind="section">+ Добавить раздел</button>
        </div>

        ${field("Плашка «для кого»", path + ".note", { multiline: true, rows: 2 })}
        ${field("Текст сообщения при записи", path + ".ctaText", { hint: "С этим текстом придёт сообщение в WhatsApp или Telegram" })}
      </div>`;
  }

  /* ---------- панели ---------- */

  const panels = {
    general() {
      return `
        <div class="card">
          <h2>Шапка сайта</h2>
          ${field("Надпись над названием", "settings.brand.eyebrow")}
          ${field("Название", "settings.brand.name")}
          ${field("Подпись под названием", "settings.brand.tagline")}
          ${field("Кнопка в шапке", "settings.ui.heroCta")}
        </div>

        <div class="card">
          <h2>Цвета сайта</h2>
          <p class="card-note">Выберите набор, нажмите «Сохранить» и откройте сайт — он станет в этих цветах.</p>
          <div class="themes">
            ${SITE_THEMES.map((t) => `
              <button class="theme ${t.id === (state.settings.theme || DEFAULT_THEME) ? "active" : ""}"
                      type="button" data-act="theme" data-theme="${esc(t.id)}">
                <span class="theme-dots">${t.swatch.map((c) => `<i style="background:${esc(c)}"></i>`).join("")}</span>
                <span class="theme-name">${esc(t.name)}</span>
                <span class="theme-note">${esc(t.note)}</span>
              </button>`).join("")}
          </div>
        </div>

        <div class="card">
          <h2>Куда писать клиентам</h2>
          <div class="row">
            ${field("Номер WhatsApp", "settings.contacts.whatsapp", { hint: "Только цифры, например 79991234567" })}
            ${field("Ник в Telegram", "settings.contacts.telegram", { hint: "Без символа @" })}
          </div>
          ${field("Текст сообщения по умолчанию", "settings.ui.defaultMessage")}
          <div class="row">
            ${field("Надпись на кнопке WhatsApp", "settings.ui.btnWhatsapp")}
            ${field("Надпись на кнопке Telegram", "settings.ui.btnTelegram")}
          </div>
        </div>

        <div class="card">
          <h2>Низ страницы</h2>
          ${field("Заголовок", "settings.ui.finalTitle")}
          ${field("Текст", "settings.ui.finalText", { multiline: true, rows: 2 })}
          <div class="row">
            ${field("Название в подвале", "settings.ui.footerBrand")}
            ${field("Подпись в подвале", "settings.ui.footerNote")}
          </div>
        </div>

        <div class="card">
          <h2>Резервная копия</h2>
          <p class="card-note">
            Файл со снимком контента. Его кладут в проект, чтобы сайт продолжал
            работать, даже если база временно недоступна.
          </p>
          <button class="btn btn-ghost" data-act="download" type="button">Скачать снимок data.js</button>
        </div>`;
    },

    about() {
      const a = state.about;
      return `
        <div class="card">
          <h2>Фотография или значок</h2>
          <p class="card-note">Можно оставить значок, а можно загрузить фото — оно встанет в кружок.</p>
          ${field("Значок", "about.avatar.emoji", { hint: "Один символ, например 💅" })}
          <div class="photos">
            ${a.avatar.image ? `
              <div class="photo">
                <img src="${esc(Store.photoUrl(a.avatar.image))}" alt="">
                <button data-act="del-avatar" title="Убрать фото">&times;</button>
              </div>` : ""}
          </div>
          <label class="dropzone" data-drop="avatar">
            Перетащите фото сюда или нажмите, чтобы выбрать
            <input type="file" accept="image/*" data-upload="avatar">
          </label>
        </div>

        <div class="card">
          <h2>Текст о себе</h2>
          <p class="card-note">Каждый блок — отдельный абзац на сайте.</p>
          ${(a.text || []).map((t, i) => `
            <div class="line">
              <textarea data-path="about.text.${i}" rows="2">${esc(t)}</textarea>
              <button class="icon-btn" data-act="move" data-arr="about.text" data-i="${i}" data-to="${i - 1}">&uarr;</button>
              <button class="icon-btn" data-act="move" data-arr="about.text" data-i="${i}" data-to="${i + 1}">&darr;</button>
              <button class="icon-btn danger" data-act="del" data-arr="about.text" data-i="${i}">&times;</button>
            </div>`).join("")}
          <button class="btn btn-add btn-small" data-act="add" data-arr="about.text" data-kind="item">+ Добавить абзац</button>
        </div>

        <div class="card">
          <h2>Цифры</h2>
          <p class="card-note">Показываются плитками под текстом.</p>
          ${(a.stats || []).map((s, i) => `
            <div class="sub">
              <div class="head">
                <span class="head-title">${esc(s.value)} — ${esc(s.label)}</span>
                ${rowActions("about.stats", i)}
              </div>
              <div class="row">
                ${field("Число", `about.stats.${i}.value`, { hint: "Например 8+" })}
                ${field("Подпись", `about.stats.${i}.label`)}
              </div>
            </div>`).join("")}
          <button class="btn btn-add btn-small" data-act="add" data-arr="about.stats" data-kind="stat">+ Добавить цифру</button>
        </div>`;
    },

    courses() {
      return state.groups.map((g, gi) => `
        <div class="card">
          <div class="head">
            <span class="head-title">Вкладка «${esc(g.tabLabel)}»</span>
            ${rowActions("groups", gi)}
          </div>
          ${field("Название вкладки", `groups.${gi}.tabLabel`)}

          ${g.courses.map((block, bi) => {
            const bp = `groups.${gi}.courses.${bi}`;
            const kids = block.tariffs ? "tariffs" : block.courses ? "courses" : null;

            if (!kids) return courseEditor(bp, bi, `groups.${gi}.courses`, false);

            return `
              <div class="card">
                <div class="head">
                  <span class="head-title">Группа: ${esc(block.title)}</span>
                  ${rowActions(`groups.${gi}.courses`, bi)}
                </div>
                ${field("Заголовок группы", `${bp}.title`)}
                ${field("Подзаголовок", `${bp}.subtitle`)}
                ${block[kids].map((c, ci) => courseEditor(`${bp}.${kids}.${ci}`, ci, `${bp}.${kids}`, kids === "tariffs")).join("")}
                <button class="btn btn-add btn-small" data-act="add" data-arr="${bp}.${kids}" data-kind="${kids === "tariffs" ? "tariff" : "course"}">
                  + Добавить ${kids === "tariffs" ? "тариф" : "курс"}
                </button>
              </div>`;
          }).join("")}

          <button class="btn btn-add" data-act="add" data-arr="groups.${gi}.courses" data-kind="course">+ Добавить отдельный курс</button>
        </div>`).join("");
    },

    cases() {
      return state.cases.map((block, bi) => {
        if (block.type === "testimonials") {
          return `
            <div class="card">
              <div class="head">
                <span class="head-title">Отзывы: ${esc(block.title)}</span>
                ${rowActions("cases", bi)}
              </div>
              ${field("Заголовок блока", `cases.${bi}.title`)}
              ${block.items.map((t, ti) => `
                <div class="sub">
                  <div class="head">
                    <span class="head-title">${esc(t.course)}</span>
                    ${rowActions(`cases.${bi}.items`, ti)}
                  </div>
                  ${field("Какой курс", `cases.${bi}.items.${ti}.course`)}
                  ${field("Текст отзыва", `cases.${bi}.items.${ti}.text`, { multiline: true, rows: 6 })}
                </div>`).join("")}
              <button class="btn btn-add btn-small" data-act="add" data-arr="cases.${bi}.items" data-kind="testimonial">+ Добавить отзыв</button>
            </div>`;
        }

        return `
          <div class="card">
            <div class="head">
              <span class="head-title">Галерея: ${esc(block.title)}</span>
              ${rowActions("cases", bi)}
            </div>
            ${field("Заголовок", `cases.${bi}.title`)}
            ${field("Подзаголовок", `cases.${bi}.subtitle`)}

            ${block.groups.map((g, gi) => `
              <div class="sub">
                <div class="head">
                  <span class="head-title">${esc(g.caption || "Без подписи")}</span>
                  ${rowActions(`cases.${bi}.groups`, gi)}
                </div>
                ${field("Плашка над группой", `cases.${bi}.groups.${gi}.label`, { hint: "Например «Первый день». Можно оставить пустым" })}
                ${field("Подпись", `cases.${bi}.groups.${gi}.caption`, { multiline: true, rows: 2 })}

                <div class="photos">
                  ${g.images.map((src, ii) => `
                    <div class="photo">
                      <img src="${esc(Store.photoUrl(src))}" alt="" loading="lazy">
                      <button data-act="del" data-arr="cases.${bi}.groups.${gi}.images" data-i="${ii}" title="Удалить">&times;</button>
                    </div>`).join("")}
                </div>

                <label class="dropzone" data-drop="cases.${bi}.groups.${gi}.images">
                  Перетащите фото сюда или нажмите, чтобы выбрать
                  <input type="file" accept="image/*" multiple data-upload="cases.${bi}.groups.${gi}.images">
                </label>
              </div>`).join("")}

            <button class="btn btn-add btn-small" data-act="add" data-arr="cases.${bi}.groups" data-kind="photoGroup">+ Добавить группу фото</button>
          </div>`;
      }).join("") + `
        <div class="card">
          <button class="btn btn-add" data-act="add" data-arr="cases" data-kind="casePhotos">+ Добавить галерею</button>
          <button class="btn btn-add" data-act="add" data-arr="cases" data-kind="caseTestimonials">+ Добавить блок отзывов</button>
        </div>`;
    },

    history() {
      return `
        <div class="card">
          <h2>История изменений</h2>
          <p class="card-note">Сохраняются 30 последних правок. Можно вернуть любую.</p>
          <div id="versions">Загружаю…</div>
        </div>`;
    }
  };

  function renderPanel() {
    $("panel").innerHTML = panels[current]();
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.panel === current));
    if (current === "history") loadVersions();
    window.scrollTo({ top: 0 });
  }

  /* ---------- история ---------- */

  async function loadVersions() {
    const box = $("versions");
    if (!box) return;

    if (!Store.configured) {
      box.textContent = "База не подключена — история недоступна.";
      return;
    }

    try {
      const rows = await Store.versions();
      box.innerHTML = rows.length
        ? rows.map((v) => `
            <div class="version">
              <span>${new Date(v.created_at).toLocaleString("ru-RU")}</span>
              <button class="btn btn-ghost btn-small" data-act="restore" data-id="${v.id}">Вернуть</button>
            </div>`).join("")
        : "Пока пусто — история появится после первых сохранений.";
    } catch (e) {
      box.textContent = "Не удалось загрузить историю: " + e.message;
    }
  }

  /* ---------- загрузка фото ---------- */

  async function uploadFiles(path, files) {
    if (!files || !files.length) return;

    if (!Store.configured) {
      toast("Сначала подключите базу — без неё некуда загружать фото", true);
      return;
    }

    toast(`Загружаю ${files.length} фото…`);

    try {
      for (const file of files) {
        const name = await Store.uploadPhoto(file);
        if (path === "avatar") {
          state.about.avatar.image = name;
        } else {
          get(path).push(name);
        }
      }
      markDirty();
      renderPanel();
      toast("Фото загружены. Не забудьте нажать «Сохранить»");
    } catch (e) {
      toast("Не удалось загрузить: " + e.message, true);
    }
  }

  /* ---------- сохранение ---------- */

  async function save() {
    if (!Store.configured) {
      toast("База не подключена — сохранять некуда", true);
      return;
    }

    const btn = $("save");
    btn.disabled = true;
    btn.textContent = "Сохраняю…";

    try {
      const res = updatedAt
        ? await Store.saveContent(state, updatedAt)
        : await Store.seedContent(state);
      updatedAt = res.updatedAt;
      markClean();
      toast("Сохранено — изменения уже на сайте");
    } catch (e) {
      toast(e.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Сохранить";
    }
  }

  function downloadSnapshot() {
    const text =
      "/* Снимок контента сайта. Обновлён из админки " +
      new Date().toLocaleString("ru-RU") + " */\n\n" +
      "const SITE_DATA = " + JSON.stringify(state, null, 2) + ";\n\n" +
      'if (typeof module !== "undefined" && module.exports) module.exports = SITE_DATA;\n';

    const url = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.js";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- обработчики ---------- */

  function onInput(e) {
    const el = e.target;
    if (!el.dataset.path) return;

    let value = el.value;
    if (value === "true") value = true;
    else if (value === "false") value = false;

    set(el.dataset.path, value);
    markDirty();

    // Смена вида раздела меняет набор полей — форму нужно перерисовать
    if (el.tagName === "SELECT" && el.dataset.path.endsWith(".layout")) renderPanel();
  }

  async function onClick(e) {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;

    const act = btn.dataset.act;

    if (act === "download") return downloadSnapshot();

    if (act === "theme") {
      state.settings.theme = btn.dataset.theme;
      markDirty();
      return renderPanel();
    }

    if (act === "del-avatar") {
      state.about.avatar.image = null;
      markDirty();
      return renderPanel();
    }

    if (act === "restore") {
      if (!confirm("Вернуть эту версию? Текущие несохранённые правки пропадут.")) return;
      try {
        const data = await Store.version(btn.dataset.id);
        if (!data) return toast("Версия не найдена", true);
        state = data;
        markDirty();
        current = "general";
        renderPanel();
        toast("Версия загружена. Нажмите «Сохранить», чтобы применить");
      } catch (err) {
        toast("Не удалось: " + err.message, true);
      }
      return;
    }

    const arr = btn.dataset.arr ? get(btn.dataset.arr) : null;

    if (act === "add") {
      arr.push(blank[btn.dataset.kind]());
      markDirty();
      return renderPanel();
    }

    if (act === "del") {
      if (!confirm("Удалить? Это действие нельзя отменить кнопкой назад.")) return;
      arr.splice(Number(btn.dataset.i), 1);
      markDirty();
      return renderPanel();
    }

    if (act === "move") {
      const from = Number(btn.dataset.i);
      const to = Number(btn.dataset.to);
      if (to < 0 || to >= arr.length) return;
      arr.splice(to, 0, arr.splice(from, 1)[0]);
      markDirty();
      return renderPanel();
    }
  }

  function bindPanelEvents() {
    const panel = $("panel");
    panel.addEventListener("input", onInput);
    panel.addEventListener("change", onInput);
    panel.addEventListener("click", onClick);

    panel.addEventListener("change", (e) => {
      const input = e.target.closest("[data-upload]");
      if (input) uploadFiles(input.dataset.upload, Array.from(input.files));
    });

    ["dragover", "dragleave", "drop"].forEach((type) => {
      panel.addEventListener(type, (e) => {
        const zone = e.target.closest("[data-drop]");
        if (!zone) return;
        e.preventDefault();
        zone.classList.toggle("over", type === "dragover");
        if (type === "drop") {
          const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
          uploadFiles(zone.dataset.drop, files);
        }
      });
    });
  }

  /* ---------- запуск ---------- */

  async function start(keepState) {
    $("login").hidden = true;
    $("app").hidden = false;

    // Вернулись после повторного входа с несохранёнными правками — оставляем их
    // как есть, иначе свежие данные из базы затрут работу.
    if (keepState) return renderPanel();

    // Берём контент из базы; если её ещё нет — стартуем со снимка в файле
    try {
      const fresh = Store.configured ? await Store.fetchContent() : null;
      if (fresh) {
        state = fresh.data;
        updatedAt = fresh.updatedAt;
        markClean();
      } else {
        state = JSON.parse(JSON.stringify(SITE_DATA));
        markDirty();
        toast(Store.configured
          ? "В базе пока пусто — нажмите «Сохранить», чтобы перенести туда контент"
          : "База не подключена: правки можно посмотреть, но не сохранить", !Store.configured);
      }
    } catch (e) {
      state = JSON.parse(JSON.stringify(SITE_DATA));
      toast("Не удалось получить данные: " + e.message, true);
    }

    renderPanel();
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindPanelEvents();

    // Обычно сессия продлевается сама. Если продлить не вышло — просим войти
    // заново прямо поверх админки: правки остаются в памяти и не пропадают.
    Store.onSessionEnd(() => {
      toast("Сессия закончилась. Войдите заново — несохранённые правки останутся", true);
      $("login-password").value = "";
      $("login").hidden = false;
    });

    if (!Store.configured) {
      $("login-hint").textContent =
        "База пока не подключена. Можно войти без пароля и посмотреть админку — но сохранять будет некуда.";
    }

    $("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("login-error");
      err.hidden = true;

      if (!Store.configured) return start();

      try {
        await Store.signIn($("login-email").value.trim(), $("login-password").value);
        start(dirty);
      } catch (ex) {
        err.textContent = ex.status === 400
          ? "Неверная почта или пароль"
          : "Не удалось войти: " + ex.message;
        err.hidden = false;
      }
    });

    $("tabs").addEventListener("click", (e) => {
      const tab = e.target.closest(".tab");
      if (!tab) return;
      current = tab.dataset.panel;
      renderPanel();
    });

    $("save").addEventListener("click", save);

    $("logout").addEventListener("click", () => {
      if (dirty && !confirm("Есть несохранённые изменения. Всё равно выйти?")) return;
      Store.signOut();
      location.reload();
    });

    if (Store.signedIn()) start();
  });
})();
