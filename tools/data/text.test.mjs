// Opis mebla z karty: tytuł sklejony z pierwszym zdaniem (karty DANTE) wraca jako osobny nagłówek.
import test from 'node:test';
import assert from 'node:assert/strict';
import { descriptionBlocks } from '../../src/lib/text.ts';

test('descriptionBlocks: oddziela sklejony tytuł i dzieli opis na akapity', () => {
  const d = descriptionBlocks('Komoda Dante DT03 – Wyrafinowany styl i praktyczność w jednym Odkryj harmonię. Drugie zdanie. Trzecie zdanie. Czwarte zdanie.');
  assert.equal(d.lead, 'Komoda Dante DT03 – Wyrafinowany styl i praktyczność w jednym');
  assert.deepEqual(d.paragraphs, ['Odkryj harmonię. Drugie zdanie. Trzecie zdanie.', 'Czwarte zdanie.']);
});
test('descriptionBlocks: „Twojego” w tytule nie kończy tytułu; zwykły opis nie dostaje nagłówka', () => {
  assert.equal(descriptionBlocks('Lustro Dante DT20 – nowoczesna ozdoba Twojego wnętrza Wprowadź do domu elegancję.').lead, 'Lustro Dante DT20 – nowoczesna ozdoba Twojego wnętrza');
  assert.equal(descriptionBlocks('Szafka RTV ARIS AS01 to szeroka szafka telewizyjna. Ma dwie szuflady.').lead, '');
  assert.deepEqual(descriptionBlocks('').paragraphs, []);
});
