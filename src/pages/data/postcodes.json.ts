// /data/postcodes.json — przybliżone środki okręgów pocztowych (2 pierwsze cyfry kodu) dla wyszukiwarki sklepów.
import type { APIRoute } from 'astro';
import { postcodes } from '../../lib/site';

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ precision: postcodes.precision, prefixes: postcodes.prefixes }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
