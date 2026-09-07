/*
  Тонкая прослойка над Supabase: чтение контента для сайта и всё
  необходимое для админки (вход, сохранение, фото, история версий).

  Написано на голом fetch — без библиотек, чтобы не тянуть внешний код
  и не зависеть от доступности CDN.
*/

const Store = (function () {
  const cfg = typeof SUPABASE_CONFIG !== "undefined" ? SUPABASE_CONFIG : { url: "", anonKey: "" };
  const TOKEN_KEY = "site-admin-token";
  const CACHE_KEY = "site-content";

  const configured = Boolean(cfg.url && cfg.anonKey);

  function api(path) {
    return cfg.url.replace(/\/$/, "") + path;
  }

  /* ---------- сессия ---------- */

  // Что вернул Supabase при входе. access_token живёт около часа, refresh_token —
  // долго; храним ответ целиком, чтобы по нему молча продлевать сессию.
  function session() {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function keepSession(t) {
    // Обычно Supabase присылает expires_at, но без него срок считать нечем —
    // и токен выглядел бы мёртвым на каждом запросе. Достраиваем из expires_in.
    if (t && !t.expires_at && t.expires_in) {
      t.expires_at = Math.floor(Date.now() / 1000) + t.expires_in;
    }
    try { localStorage.setItem(TOKEN_KEY, JSON.stringify(t)); } catch (e) {}
    return t;
  }

  // Запас в минуту: токен, который истечёт прямо в полёте запроса, считаем мёртвым.
  function alive(t) {
    return Boolean(t && t.access_token && t.expires_at && t.expires_at * 1000 - 60000 > Date.now());
  }

  // Сессия кончилась, и продлить её не вышло. Сообщаем наверх, чтобы админка
  // попросила войти заново, а не падала непонятной ошибкой на сохранении.
  let sessionEndHandler = null;

  function endSession() {
    localStorage.removeItem(TOKEN_KEY);
    if (sessionEndHandler) sessionEndHandler();
  }

  // Один обмен на всех: параллельные запросы ждут общий промис, а не гоняют
  // продление по разу каждый — refresh_token одноразовый, второй обмен упал бы.
  let renewing = null;

  async function renew() {
    if (renewing) return renewing;

    const t = session();
    if (!t || !t.refresh_token) return null;

    renewing = (async () => {
      let res;
      try {
        res = await fetch(api("/auth/v1/token?grant_type=refresh_token"), {
          method: "POST",
          headers: { apikey: cfg.anonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: t.refresh_token })
        });
      } catch (e) {
        return null;      // сеть моргнула — сессию не трогаем, попробуем в следующий раз
      }

      if (!res.ok) {      // refresh_token отозван или протух — это уже конец сессии
        endSession();
        return null;
      }
      return keepSession(await res.json());
    })();

    try {
      return await renewing;
    } finally {
      renewing = null;
    }
  }

  // Заголовки от имени вошедшего; протухший токен по дороге меняется на свежий.
  // Без сессии подставляется анонимный ключ — так же, как читает сайт.
  async function authHeaders(extra) {
    let t = session();
    if (t && !alive(t)) t = await renew();
    return Object.assign({
      apikey: cfg.anonKey,
      Authorization: `Bearer ${t && t.access_token ? t.access_token : cfg.anonKey}`
    }, extra || {});
  }

  // Запрос от имени вошедшего. Если сервер всё-таки ответил 401 — например, часы
  // на телефоне врут и срок мы посчитали неверно — меняем токен и повторяем раз.
  async function authed(path, options, extra) {
    const send = async () =>
      request(path, Object.assign({}, options, { headers: await authHeaders(extra) }));

    try {
      return await send();
    } catch (e) {
      if (e.status !== 401) throw e;
      if (session() && (await renew())) return send();

      // Продлить нечем — вместо сырого «JWT expired» говорим человеческим языком.
      const err = new Error("Сессия закончилась. Войдите заново и сохраните ещё раз");
      err.code = "session";
      throw err;
    }
  }

  async function request(path, options) {
    const res = await fetch(api(path), options);
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).message || (await res.text()); } catch (e) {}
      const err = new Error(detail || `Ошибка ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res;
  }

  /* ---------- контент ---------- */

  // Возвращает { data, updatedAt } либо null, если база не настроена/недоступна.
  async function fetchContent() {
    if (!configured) return null;

    const res = await authed("/rest/v1/site_content?id=eq.1&select=data,updated_at");
    const rows = await res.json();
    if (!rows.length) return null;

    const result = { data: rows[0].data, updatedAt: rows[0].updated_at };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch (e) {}
    return result;
  }

  function cached() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // Сохраняет контент. knownUpdatedAt защищает от перезаписи чужих правок,
  // сделанных в другой вкладке: если метка не совпала — строк обновится 0.
  async function saveContent(data, knownUpdatedAt) {
    let path = "/rest/v1/site_content?id=eq.1";
    if (knownUpdatedAt) path += `&updated_at=eq.${encodeURIComponent(knownUpdatedAt)}`;

    const res = await authed(path, {
      method: "PATCH",
      body: JSON.stringify({ data })
    }, {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    });

    const rows = await res.json();
    if (!rows.length) {
      const err = new Error("Данные успели измениться в другом окне. Обновите страницу.");
      err.code = "conflict";
      throw err;
    }
    return { data: rows[0].data, updatedAt: rows[0].updated_at };
  }

  // Первая запись — если строки ещё нет.
  async function seedContent(data) {
    const res = await authed("/rest/v1/site_content", {
      method: "POST",
      body: JSON.stringify({ id: 1, data })
    }, {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    });
    const rows = await res.json();
    return { data: rows[0].data, updatedAt: rows[0].updated_at };
  }

  /* ---------- вход ---------- */

  async function signIn(email, password) {
    const res = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: cfg.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    return keepSession(await res.json());
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
  }

  // Вошли, если есть чем подтвердить: живой access_token или refresh_token,
  // по которому его обменяют на свежий при первом же запросе.
  function signedIn() {
    const t = session();
    return Boolean(t && (alive(t) || t.refresh_token));
  }

  /* ---------- фотографии ---------- */

  // Ужимаем картинку прямо в браузере: гигабайты исходников с телефона
  // ни к чему ни хранилищу, ни посетителям.
  function compress(file, maxSide, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        let { width, height } = img;
        const scale = Math.min(1, (maxSide || 1400) / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Не удалось обработать изображение"))),
          "image/webp",
          quality || 0.82
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Файл не похож на изображение"));
      };
      img.src = url;
    });
  }

  function slugify(name) {
    return name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "photo";
  }

  // Возвращает имя файла в хранилище — его и кладём в данные.
  async function uploadPhoto(file) {
    const blob = await compress(file, 1400, 0.82);
    const path = `${Date.now()}-${slugify(file.name)}.webp`;

    await authed(`/storage/v1/object/media/${path}`, {
      method: "POST",
      body: blob
    }, { "Content-Type": "image/webp", "x-upsert": "true" });

    return path;
  }

  async function deletePhoto(path) {
    await authed(`/storage/v1/object/media/${path}`, { method: "DELETE" });
  }

  /* ---------- история версий ---------- */

  async function versions() {
    const res = await authed(
      "/rest/v1/site_versions?select=id,created_at&order=created_at.desc&limit=30"
    );
    return res.json();
  }

  async function version(id) {
    const res = await authed(`/rest/v1/site_versions?id=eq.${id}&select=data`);
    const rows = await res.json();
    return rows.length ? rows[0].data : null;
  }

  /* ---------- адреса картинок ---------- */

  // В данных лежит либо файл из репозитория (assets/...), либо имя файла
  // в хранилище. На проде хранилище отдаётся через /img/* — так картинки
  // кэшируются на Vercel и не съедают трафик Supabase.
  function photoUrl(src) {
    if (!src) return "";
    if (/^https?:\/\//.test(src) || src.startsWith("assets/") || src.startsWith("data:")) return src;

    // Через /img/* — только там, где эта подмена настроена (см. config.js).
    // Иначе тянем файл прямо из хранилища, иначе получили бы 404.
    const hosts = cfg.imageProxyHosts || [];
    const viaProxy = hosts.some((h) => location.hostname === h || location.hostname.endsWith("." + h));

    if (viaProxy) return `/img/${src}`;
    return configured ? `${cfg.url.replace(/\/$/, "")}/storage/v1/object/public/media/${src}` : src;
  }

  return {
    configured,
    fetchContent, cached, saveContent, seedContent,
    signIn, signOut, signedIn,
    onSessionEnd(fn) { sessionEndHandler = fn; },
    uploadPhoto, deletePhoto, compress,
    versions, version,
    photoUrl
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Store;
