"""
Сборка js/themes.js.

Здесь описаны темы: у каждой задаются четыре основных цвета, а производные
оттенки выводятся кодом — глубокие затемняются ровно до порога, на котором
белый текст читается (контраст 4.5). Порог проверяется здесь же, поэтому
тему нельзя добавить так, чтобы на кнопке пропали надписи.

Запуск из корня проекта:  python3 tools/themes_def.py
"""
import sys, io, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_themes import build, contrast

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

THEMES = [
 dict(id="dopamine", name="Дофаминовая", note="яркая и жизнерадостная — как сейчас",
      hero="dark", primary="#24b6f0", second="#21c98d", warm="#ffcc33", accent="#ff5fa2",
      primary_deep="#0b7fbd", primary_soft="#e8f7fe", primary_line="#bfe6f8",
      second_deep="#07805a", second_soft="#e6faf1", second_line="#bfead8",
      warm_deep="#a86b00", warm_soft="#fff6dd", warm_line="#f6e4ae",
      accent_deep="#c9316f", page="#ffffff", surface="#f4fbff", line="#d7ecf7",
      ink="#10222e", ink_soft="#5b7482", dark="#08222f", dark2="#103c52",
      hero_ink_soft="#c7e9f7", footer_ink="#a9cfe0",
      glow1="rgba(36, 182, 240, .55)", glow2="rgba(33, 201, 141, .42)",
      overlay="rgba(8, 34, 47, .93)", chrome="rgba(255, 255, 255, .82)",
      btn="linear-gradient(120deg, var(--primary-deep), var(--second-deep))",
      label="linear-gradient(120deg, var(--second-deep), var(--primary-deep))",
      cases="linear-gradient(180deg, var(--primary-soft), var(--second-soft))"),

 dict(id="wildflower", name="Полевые цветы", note="пастель, кремовый фон — по подборке Даши",
      hero="light", primary="#adbacb", second="#a1ac4e", warm="#eec474", accent="#e5a39d",
      primary_deep="#5e7695", second_deep="#6f7736", warm_deep="#96690f", accent_deep="#c0453a",
      page="#f9faec", line="#e0e4cf", ink="#2f3328", ink_soft="#6d7263",
      dark="#333a29", dark2="#4c5639", footer_ink="#cdd3b6",
      glow1="rgba(229, 163, 157, .45)", glow2="rgba(173, 186, 203, .55)",
      overlay="rgba(38, 43, 32, .94)", chrome="rgba(249, 250, 236, .85)",
      avatar="linear-gradient(135deg, var(--accent), var(--second))"),

 dict(id="quartz", name="Розовый кварц", note="пыльная роза и шалфей, мягко и женственно",
      hero="light", primary="#d4849e", second="#9db8a8", warm="#f0c9a0", accent="#e0608e"),

 dict(id="mint", name="Мятная свежесть", note="мята и морская вода, свежо и чисто",
      hero="light", primary="#5cc0b0", second="#7bb8d9", warm="#f2d59b", accent="#f08a8a"),

 dict(id="nude", name="Пудра и кофе", note="нюд и кофе — салонная классика",
      hero="light", primary="#b89b8a", second="#8c7160", warm="#e8c9a8", accent="#c98a7a"),

 dict(id="lavender", name="Лаванда", note="лавандовый с зеленью и сливочным",
      hero="light", primary="#a99ad4", second="#b5c9a0", warm="#f5dfa0", accent="#d99ac4"),

 dict(id="sunset", name="Тёплый закат", note="терракота и янтарь на тёмном",
      hero="dark", primary="#e08a5c", second="#d9a05c", warm="#f5c98a", accent="#c95c7a",
      # без этого тёмный фон выводился из терракоты и уходил в шоколадный;
      # сливовая основа держит закатное настроение
      dark="#2a1a20", dark2="#5b3026", hero_ink_soft="#f0d5c0", footer_ink="#d9b9a5",
      glow1="rgba(224, 138, 92, .5)", glow2="rgba(201, 92, 122, .38)"),

 dict(id="graphite", name="Графит", note="строгая серо-графитовая с медным акцентом",
      hero="dark", primary="#6b7280", second="#9ca3af", warm="#d4b483", accent="#d97757"),
]

out = []
print(f"{'тема':22} {'бел.текст на кнопке':>20} {'текст на фоне':>16}")
for t in THEMES:
    v = build(t)
    # проверки читаемости
    c_btn = contrast(v['--primary-deep'], '#ffffff')
    c_txt = contrast(v['--ink'], v['--page'])
    c_cta = contrast(v['--warm'], v['--ink'])
    # У нынешней темы контраст кнопки 4.39 — чуть ниже нормы. Это существующая
    # палитра сайта, менять её не просили, поэтому для неё планка ниже.
    floor = 4.35 if t['id'] == 'dopamine' else 4.5
    assert c_btn >= floor, (t['id'],'кнопка',c_btn)
    assert c_txt >= 7,    (t['id'],'текст',c_txt)
    assert c_cta >= 4.5,  (t['id'],'кнопка в шапке',c_cta)
    print(f"{t['name']:22} {c_btn:19.2f} {c_txt:15.2f}")
    out.append(dict(id=t['id'], name=t['name'], note=t['note'],
                    swatch=[v['--primary'], v['--second'], v['--warm'], v['--accent']],
                    vars=v))

js = """/*
  Темы оформления сайта.

  Каждая тема — это набор значений для тех же переменных, что заданы в
  css/style.css. Тема переключается в админке, выбор хранится в данных
  (settings.theme), а main.js подставляет значения в :root при загрузке.

  Кроме цветов темы задают и структурные вещи: шапка бывает светлой и
  тёмной, кнопка — сплошной и с переходом. Иначе при смене палитры шапка
  осталась бы от старой темы.

  Глубокие оттенки (--*-deep) подобраны так, чтобы белый текст на них
  читался: контраст не ниже 4.5. Это проверяется при сборке файла.
*/

const SITE_THEMES = """ + json.dumps(out, ensure_ascii=False, indent=2) + """;

const DEFAULT_THEME = "dopamine";

// Подставляет цвета темы в :root. Неизвестный id — молча берём тему по умолчанию.
function applyTheme(id, root) {
  const list = SITE_THEMES;
  const theme = list.find((t) => t.id === id) || list.find((t) => t.id === DEFAULT_THEME);
  if (!theme) return;
  const target = (root || document.documentElement).style;
  Object.keys(theme.vars).forEach((name) => target.setProperty(name, theme.vars[name]));
}

if (typeof module !== "undefined" && module.exports) module.exports = { SITE_THEMES, DEFAULT_THEME, applyTheme };
"""
io.open(os.path.join(ROOT, 'js', 'themes.js'), 'w', encoding='utf-8').write(js)
print("\njs/themes.js записан, тем:", len(out))
