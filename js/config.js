/*
  Настройки подключения к базе.

  Пусты: проект Supabase принадлежал владелице сайта и отключён по её
  просьбе. Пока поля пустые, сайт работает на встроенном снимке
  js/data.js, а админка при входе честно скажет, что база не настроена.

  Чтобы подключить свою базу: Supabase → проект → Settings → API
    • Project URL         → поле url
    • Project API keys → anon public → поле anonKey
*/

const SUPABASE_CONFIG = {
  url: "",
  anonKey: "",
  imageProxyHosts: []
};

if (typeof module !== "undefined" && module.exports) module.exports = SUPABASE_CONFIG;
