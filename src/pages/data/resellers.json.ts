// /data/resellers.json — sklepy partnerskie dla wyszukiwarki w przeglądarce (publiczne pola, bez danych handlowych).
import type { APIRoute } from 'astro';
import { resellers } from '../../lib/site';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      resellers.map(({ id, name, address, city, district, postcode, voivodeship, lat, lng, phone, email, collections, services, openingHours }) => ({
        id, name, address, city, district, postcode, voivodeship, lat, lng, phone, email, collections, services, openingHours,
      })),
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
