/*
  Настройки подключения к базе.

  Оба значения ПУБЛИЧНЫЕ — их не страшно держать в коде и в репозитории:
  ключ anon сам по себе ничего не открывает, права разграничены на стороне
  базы (читать может любой, писать — только вошедший в админку).

  Взять их можно так:
  Supabase → ваш проект → Settings → API
    • Project URL         → поле url
    • Project API keys → anon public → поле anonKey

  Пока поля пустые, сайт работает на встроенном снимке js/data.js,
  а админка при входе честно скажет, что база не настроена.
*/

const SUPABASE_CONFIG = {
  url: "https://nrgcwrpphnixafodeaxl.supabase.co",
  anonKey: "sb_publishable_lLfp7Duls5n5h61OGXrqWw_BMaqb1_U",

  // Адреса, где настроена подмена /img/* на хранилище (правило в vercel.json).
  // Там фотографии идут через CDN и не тратят трафик базы. На остальных
  // площадках — например на GitHub Pages — такого правила нет, поэтому файлы
  // запрашиваются из хранилища напрямую. Добавьте сюда свой домен, когда
  // подключите его к Vercel.
  imageProxyHosts: ["vercel.app"]
};

if (typeof module !== "undefined" && module.exports) module.exports = SUPABASE_CONFIG;
