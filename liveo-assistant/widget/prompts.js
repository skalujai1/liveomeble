// Definicje tego, co model rozpoznaje na zdjęciu.
//
// Model (MobileCLIP) porównuje zdjęcie z opisami tekstowymi. Każda klasa ma kilka
// opisów – ich średnia daje stabilniejszy wynik niż pojedyncze zdanie.
// Opisy są po angielsku, bo w tym języku model był trenowany.
//
// Po każdej zmianie tego pliku uruchom tools/build-embeddings.html,
// żeby przeliczyć gotowe wektory (data/text-embeddings.json). Jeśli tego nie zrobisz,
// widżet sam przeliczy je w przeglądarce, ale pierwsze uruchomienie będzie wolniejsze.

// kind:
//   'room'    – pomieszczenie, do którego Liveo ma meble
//   'unsure'  – wnętrze, ale nie wiadomo jakie (np. puste) → pytamy klienta
//   'nofurn'  – wnętrze, ale Liveo nie ma do niego mebli (łazienka, garaż)
//   'reject'  – to nie jest wnętrze (podjazd, ogród, auto, selfie …)
//               object: true → to "obiekt", który może też stać w pokoju (osoba, pies, talerz),
//               więc odrzucamy tylko, gdy na zdjęciu nie widać wnętrza
//   'product' – zdjęcie pojedynczego mebla
export const SCENES = {
  salon: {
    kind: 'room', label: 'salon',
    prompts: [
      'a photo of a living room',
      'a living room with a sofa, a coffee table and a tv',
      'a cozy lounge area with an armchair in an apartment',
      'a bright living room interior',
    ],
  },
  jadalnia: {
    kind: 'room', label: 'jadalnia',
    prompts: [
      'a photo of a dining room',
      'a dining table with chairs in a home',
      'a dining area with a large table and pendant lamps',
    ],
  },
  kuchnia: {
    kind: 'room', label: 'kuchnia',
    prompts: [
      'a photo of a kitchen',
      'kitchen cabinets with a countertop, a sink and an oven',
      'a modern home kitchen interior',
    ],
  },
  sypialnia: {
    kind: 'room', label: 'sypialnia',
    prompts: [
      'a photo of a bedroom',
      'a double bed with pillows and a duvet in a bedroom',
      'a master bedroom interior with bedside tables',
    ],
  },
  mlodziezowy: {
    kind: 'room', label: 'pokój młodzieżowy',
    prompts: [
      "a photo of a kid's room",
      "a child's bedroom with toys and a single bed",
      "a teenager's room with a desk and a single bed",
    ],
  },
  biuro: {
    kind: 'room', label: 'domowe biuro',
    prompts: [
      'a photo of a home office',
      'a desk with a computer monitor and an office chair',
      'a study room with a desk and bookshelves',
    ],
  },
  przedpokoj: {
    kind: 'room', label: 'przedpokój',
    prompts: [
      'a photo of an entrance hall in a home',
      'a hallway with a front door, a coat rack and shoes',
      'a narrow corridor inside an apartment',
    ],
  },
  pusty: {
    kind: 'unsure', label: 'puste pomieszczenie',
    prompts: [
      'a photo of an empty room with bare walls',
      'an empty unfurnished apartment room',
      'a room under renovation',
    ],
  },
  lazienka: {
    kind: 'nofurn', label: 'łazienka',
    prompts: [
      'a photo of a bathroom',
      'a bathroom with a toilet, a sink and a shower',
      'a bathtub in a bathroom',
    ],
  },
  garaz: {
    kind: 'nofurn', label: 'garaż',
    prompts: [
      'a photo of the inside of a garage',
      'a garage with tools and a car inside',
    ],
  },
  podjazd: {
    kind: 'reject', label: 'podjazd',
    prompts: [
      'a photo of a driveway',
      'a paved driveway in front of a house',
      'paving stones and a garage door seen from outside',
    ],
  },
  budynek: {
    kind: 'reject', label: 'budynek z zewnątrz',
    prompts: [
      'the exterior of a house',
      'a building facade seen from the street',
      'a modern house with a roof and windows, outdoors',
    ],
  },
  ogrod: {
    kind: 'reject', label: 'ogród lub taras',
    prompts: [
      'a garden with grass and plants',
      'a backyard lawn',
      'an outdoor patio or terrace',
      'a balcony with outdoor furniture',
    ],
  },
  samochod: {
    kind: 'reject', label: 'samochód lub ulica',
    prompts: [
      'a photo of a car',
      'a street with cars',
      'a parking lot',
    ],
  },
  krajobraz: {
    kind: 'reject', label: 'krajobraz',
    prompts: [
      'a landscape photo of nature',
      'a forest',
      'a beach and the sea',
      'mountains and sky',
    ],
  },
  osoba: {
    kind: 'reject', object: true, label: 'zdjęcie osoby',
    prompts: [
      'a portrait photo of a person',
      'a selfie of a smiling person',
      'a group of people',
    ],
  },
  zwierze: {
    kind: 'reject', object: true, label: 'zwierzak',
    prompts: [
      'a photo of a dog',
      'a photo of a cat',
      'a close-up of a pet',
    ],
  },
  jedzenie: {
    kind: 'reject', object: true, label: 'jedzenie',
    prompts: [
      'a close-up photo of food on a plate',
      'a dish of food',
    ],
  },
  dokument: {
    kind: 'reject', object: true, label: 'dokument lub zrzut ekranu',
    prompts: [
      'a screenshot of a phone screen',
      'a document with text',
      'an architectural floor plan drawing',
    ],
  },
  mebel: {
    kind: 'product', label: 'pojedynczy mebel',
    prompts: [
      'a product photo of a single piece of furniture on a white background',
      'a studio photo of a wooden cabinet isolated on white',
    ],
  },
};

// Styl wnętrza – oceniany tylko dla pomieszczeń.
// pref: jakich mebli szukać (jasność 0–1, drewno, czarne akcenty, połysk; 0–1)
export const STYLES = {
  nowoczesny: {
    label: 'nowoczesnym',
    prompts: ['a modern minimalist interior with clean lines', 'a contemporary interior in neutral colors'],
    pref: { light: 0.6, wood: 0.35, black: 0.45, gloss: 0.6 },
  },
  skandynawski: {
    label: 'skandynawskim',
    prompts: ['a scandinavian interior with white walls and light wood', 'a bright nordic style room'],
    pref: { light: 0.8, wood: 0.75, black: 0.15, gloss: 0.2 },
  },
  industrialny: {
    label: 'industrialnym (loft)',
    prompts: ['an industrial loft interior with black metal, brick and dark wood', 'a loft with concrete walls'],
    pref: { light: 0.35, wood: 0.8, black: 0.95, gloss: 0.15 },
  },
  klasyczny: {
    label: 'klasycznym',
    prompts: ['a classic traditional interior with wooden furniture', 'an elegant classic room with moldings'],
    pref: { light: 0.45, wood: 0.85, black: 0.1, gloss: 0.3 },
  },
  glamour: {
    label: 'glamour',
    prompts: ['a glamour interior with gold accents, velvet and marble', 'a luxurious elegant interior in white and gold'],
    pref: { light: 0.8, wood: 0.25, black: 0.2, gloss: 0.9 },
  },
  boho: {
    label: 'boho',
    prompts: ['a boho interior with rattan, plants and natural textures', 'a rustic cozy interior with warm wood'],
    pref: { light: 0.6, wood: 0.95, black: 0.1, gloss: 0.05 },
  },
};

// Prosty skrót treści opisów – pozwala wykryć, że gotowe wektory są nieaktualne.
export function promptsHash() {
  const s = JSON.stringify([SCENES, STYLES].map(g => Object.entries(g).map(([k, v]) => [k, v.prompts])));
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
