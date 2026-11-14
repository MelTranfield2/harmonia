// All visible text in English and Brazilian Portuguese.
export type Lang = "en" | "pt";

type Word3 = [string, string, string];

export interface Strings {
  htmlLang: string;
  dateLocale: string;
  // static page text (index.html elements with data-i18n / data-i18n-html)
  page: Record<string, string>;
  play: string;
  stop: string;
  loading: (title: string) => string;
  loadError: string;
  fileError: string;
  yourImage: (name: string) => string;
  imageAlt: string;
  quality: { major: string; minor: string };
  meters: { brightness: string; similarity: string; warmth: string };
  brightnessWords: Word3; // low / mid / high
  similarityWords: Word3; // clashing / rich / harmonic
  warmthLabel: (temp: "warm" | "cold" | "neutral", quality: string) => string;
  describe: (p: {
    temp: "warm" | "cold" | "neutral"; chord: string; quality: string; bright: 0 | 1 | 2; similar: 0 | 1 | 2;
  }) => string;
  halves: (left: string, right: string) => string;
  pianoLabel: (left: string, right: string) => string;
  switched: string;
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    htmlLang: "en",
    dateLocale: "en-GB",
    page: {
      tagline: "Hear the colours of our planet. The image is split down the middle: the left half plays in your left ear, the right half in your right.",
      upload: "Upload an image",
      scenesHeading: "NASA satellite images",
      leftHalf: "Left half",
      leftEar: "◀ left ear",
      rightHalf: "Right half",
      rightEar: "right ear ▶",
      rulesHeading: "How the image becomes sound",
      rule1: "<b>Brighter image</b> → more treble: higher notes and a brighter tone.",
      rule2: "<b>Colours close together</b> → more harmonic: a plain chord. Varied colours add extra notes, and very mixed colours clash.",
      rule3: "<b>Warm colours</b> (red, orange, yellow) → major chord. <b>Cold colours</b> (blue, cyan) → minor chord.",
      rule4: "<b>Left / right</b> → each half of the image plays in its own speaker.",
      footer: "Images: NASA MODIS and VIIRS true colour, via NASA Global Imagery Browse Services (GIBS).",
      langGroup: "Language",
      pianoHeading: "The chords on a piano",
      pianoLeft: "Left half: low (octaves 2–3)",
      pianoRight: "Right half: high (octaves 4–5)",
      pianoNote: "A brighter half moves up one octave. During playback, each key lights up as it is played.",
    },
    play: "Play",
    stop: "Stop",
    loading: (t) => `Loading ${t}…`,
    loadError: "Couldn't load the NASA image. Try another one, or upload your own.",
    fileError: "That file couldn't be read as an image.",
    yourImage: (n) => `Your image: ${n}`,
    imageAlt: "Image",
    quality: { major: "major", minor: "minor" },
    meters: {
      brightness: "Brightness → treble",
      similarity: "Colour similarity → harmony",
      warmth: "Cold ↔ warm → minor / major",
    },
    brightnessWords: ["low", "mid", "high"],
    similarityWords: ["clashing", "rich", "harmonic"],
    warmthLabel: (t, q) => (t === "warm" ? "warm → major" : t === "cold" ? "cold → minor" : `neutral → ${q}`),
    describe: ({ temp, chord, quality, bright, similar }) =>
      `${temp} colours, so ${chord} ${quality}. ` +
      `${["Dark", "Medium", "Bright"][bright]}, so ${["low", "middle", "high"][bright]} notes. ` +
      `Colours ${["very varied", "fairly mixed", "close together"][similar]}, so ${["clashing", "rich", "harmonic"][similar]} sound.`,
    halves: (l, r) => `Left half: ${l} Right half: ${r}`,
    pianoLabel: (l, r) => `Piano. Left half, low: ${l}. Right half, high: ${r}.`,
    switched: "Language: English.",
  },
  pt: {
    htmlLang: "pt-BR",
    dateLocale: "pt-BR",
    page: {
      tagline: "Ouça as cores do nosso planeta. A imagem é dividida ao meio: a metade esquerda toca no ouvido esquerdo e a direita, no direito.",
      upload: "Enviar uma imagem",
      scenesHeading: "Imagens de satélite da NASA",
      leftHalf: "Metade esquerda",
      leftEar: "◀ ouvido esquerdo",
      rightHalf: "Metade direita",
      rightEar: "ouvido direito ▶",
      rulesHeading: "Como a imagem vira som",
      rule1: "<b>Imagem mais brilhante</b> → mais agudos: notas mais altas e timbre mais brilhante.",
      rule2: "<b>Cores próximas</b> → som mais harmônico: um acorde simples. Cores variadas acrescentam notas, e cores muito misturadas soam dissonantes.",
      rule3: "<b>Cores quentes</b> (vermelho, laranja, amarelo) → acorde maior. <b>Cores frias</b> (azul, ciano) → acorde menor.",
      rule4: "<b>Esquerda / direita</b> → cada metade da imagem toca na sua própria caixa de som.",
      footer: "Imagens: cor verdadeira dos sensores MODIS e VIIRS da NASA, via NASA Global Imagery Browse Services (GIBS).",
      langGroup: "Idioma",
      pianoHeading: "Os acordes no piano",
      pianoLeft: "Metade esquerda: grave (oitavas 2–3)",
      pianoRight: "Metade direita: aguda (oitavas 4–5)",
      pianoNote: "Uma metade mais clara sobe uma oitava. Durante a música, cada tecla acende quando é tocada.",
    },
    play: "Tocar",
    stop: "Parar",
    loading: (t) => `Carregando ${t}…`,
    loadError: "Não foi possível carregar a imagem da NASA. Tente outra ou envie a sua.",
    fileError: "Não foi possível ler esse arquivo como imagem.",
    yourImage: (n) => `Sua imagem: ${n}`,
    imageAlt: "Imagem",
    quality: { major: "maior", minor: "menor" },
    meters: {
      brightness: "Brilho → agudos",
      similarity: "Cores próximas → harmonia",
      warmth: "Frio ↔ quente → menor / maior",
    },
    brightnessWords: ["grave", "médio", "agudo"],
    similarityWords: ["dissonante", "rico", "harmônico"],
    warmthLabel: (t, q) => (t === "warm" ? "quente → maior" : t === "cold" ? "frio → menor" : `neutro → ${q}`),
    describe: ({ temp, chord, quality, bright, similar }) =>
      `Cores ${{ warm: "quentes", cold: "frias", neutral: "neutras" }[temp]}, então ${chord} ${quality}. ` +
      `${["Escura", "Média", "Clara"][bright]}, então notas ${["graves", "médias", "agudas"][bright]}. ` +
      `Cores ${["muito variadas", "um pouco misturadas", "próximas"][similar]}, então som ${["dissonante", "rico", "harmônico"][similar]}.`,
    halves: (l, r) => `Metade esquerda: ${l} Metade direita: ${r}`,
    pianoLabel: (l, r) => `Piano. Metade esquerda, grave: ${l}. Metade direita, aguda: ${r}.`,
    switched: "Idioma: português.",
  },
};

export interface SceneText {
  title: string;
  caption: string;
}

/** Scene titles and captions, in the same order as SCENES in main.ts. */
export const SCENE_TEXT: Record<Lang, SceneText[]> = {
  en: [
    { title: "Namib coast", caption: "The Atlantic Ocean and clouds (left) meet the Namib Desert (right)." },
    { title: "Sahara", caption: "Sand seas and rocky plateaus of the central Sahara, Algeria and Libya." },
    { title: "Australian Outback", caption: "Red desert of central Australia, with clouds at the edges." },
    { title: "Amazon", caption: "Rainforest and rivers of the central Amazon, Brazil, in the dry season." },
    { title: "Bahamas", caption: "Turquoise shallow banks of the Bahamas against the deep blue Atlantic." },
    { title: "Hurricane Milton", caption: "Hurricane Milton in the Gulf of Mexico, with Florida at the top and Cuba at the bottom right." },
    { title: "Greenland", caption: "The Greenland ice sheet in summer, with dark open sea around its coasts." },
  ],
  pt: [
    { title: "Costa da Namíbia", caption: "O Oceano Atlântico e as nuvens (esquerda) encontram o Deserto do Namibe (direita)." },
    { title: "Saara", caption: "Mares de areia e planaltos rochosos do Saara central, na Argélia e na Líbia." },
    { title: "Outback australiano", caption: "Deserto vermelho do centro da Austrália, com nuvens nas bordas." },
    { title: "Amazônia", caption: "Floresta e rios da Amazônia central, no Brasil, na estação seca." },
    { title: "Bahamas", caption: "Os bancos de areia rasos e turquesa das Bahamas contra o azul profundo do Atlântico." },
    { title: "Furacão Milton", caption: "O furacão Milton no Golfo do México, com a Flórida no alto e Cuba embaixo à direita." },
    { title: "Groenlândia", caption: "O manto de gelo da Groenlândia no verão, com mar aberto escuro ao redor da costa." },
  ],
};

const STORAGE_KEY = "harmonia-lang";

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "pt") return saved;
  } catch {
    /* storage blocked: fall back to the browser language */
  }
  return navigator.language.toLowerCase().startsWith("pt") ? "pt" : "en";
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* not essential */
  }
}
