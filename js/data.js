/*
  Снимок контента сайта.

  Данные владелицы удалены по её просьбе: имя, тексты о себе, телефон,
  мессенджеры, отзывы учениц, программы курсов и фотографии. Осталась
  только пустая структура, по которой видно, какие поля бывают.

  Структура: любой курс — это набор секций, поэтому админка может
  создавать новые курсы, а не только править существующие.

    course.sections[] → { heading, layout, groups[] }
    layout: "plain"   — обычный список внутри карточки
            "columns" — плитки-колонки (каждая группа = плитка с заголовком)
            "cards"   — плитки со звёздочкой (по одному пункту на плитку)
            "grouped" — плитки с вложенными подсписками
*/

const SITE_DATA = {

  settings: {
    brand: {
      eyebrow: "",
      name: "",
      tagline: ""
    },
    contacts: {
      whatsapp: "",
      telegram: ""
    },
    theme: "dopamine",
    legal: {
      company: "",
      inn: "",
      ogrn: "",
      phone: "",
      email: "",
      privacy: "",
      offer: ""
    },
    ui: {
      heroCta: "Перейти к выбору курса",
      btnWhatsapp: "WhatsApp",
      btnTelegram: "Telegram",
      defaultMessage: "Здравствуйте!",
      finalTitle: "Готовы начать?",
      finalText: "",
      footerBrand: "",
      footerNote: ""
    }
  },

  about: {
    avatar: { emoji: "💅", image: null },
    text: [],
    stats: []
  },

  groups: [
    {
      id: "offline",
      tabLabel: "Офлайн",
      courses: []
    },
    {
      id: "online",
      tabLabel: "Онлайн",
      courses: []
    }
  ],

  cases: []
};

if (typeof module !== "undefined" && module.exports) module.exports = SITE_DATA;
