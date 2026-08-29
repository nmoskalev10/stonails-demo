/*
  Тонкая прослойка над Supabase: чтение контента для сайта и всё
  необходимое для админки (вход, сохранение, фото, история версий).

  Написано на голом fetch — без библиотек, чтобы не тянуть внешний код
  и не зависеть от доступности CDN.
*/

const Store = (function () {
  const cfg = typeof SUPABASE_CONFIG !== "undefined" ? SUPABASE_CONFIG : { url: "", anonKey: "" };
  const TOKEN_KEY = "stonails-token";
  const CACHE_KEY = "stonails-content";

  const configured = Boolean(cfg.url && cfg.anonKey);

  function api(path) {
    return cfg.url.replace(/\/$/, "") + path;
  }

  function token() {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return null;
      const t = JSON.parse(raw);
      return t.expires_at && t.expires_at * 1000 < Date.now() ? null : t;
    } catch (e) {
      return null;
    }
  }

  function headers(extra) {
    const t = token();
    return Object.assign({
      apikey: cfg.anonKey,
      Authorization: `Bearer ${t ? t.access_token : cfg.anonKey}`
    }, extra || {});
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

    const res = await request(
      "/rest/v1/site_content?id=eq.1&select=data,updated_at",
      { headers: headers() }
    );
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

    const res = await request(path, {
      method: "PATCH",
      headers: headers({
        "Content-Type": "application/json",
        Prefer: "return=representation"
      }),
      body: JSON.stringify({ data })
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
    const res = await request("/rest/v1/site_content", {
      method: "POST",
      headers: headers({
        "Content-Type": "application/json",
        Prefer: "return=representation"
      }),
      body: JSON.stringify({ id: 1, data })
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
    const t = await res.json();
    localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    return t;
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function signedIn() {
    return Boolean(token());
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

    await request(`/storage/v1/object/media/${path}`, {
      method: "POST",
      headers: headers({ "Content-Type": "image/webp", "x-upsert": "true" }),
      body: blob
    });

    return path;
  }

  async function deletePhoto(path) {
    await request(`/storage/v1/object/media/${path}`, {
      method: "DELETE",
      headers: headers()
    });
  }

  /* ---------- история версий ---------- */

  async function versions() {
    const res = await request(
      "/rest/v1/site_versions?select=id,created_at&order=created_at.desc&limit=30",
      { headers: headers() }
    );
    return res.json();
  }

  async function version(id) {
    const res = await request(`/rest/v1/site_versions?id=eq.${id}&select=data`, { headers: headers() });
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
    uploadPhoto, deletePhoto, compress,
    versions, version,
    photoUrl
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Store;
