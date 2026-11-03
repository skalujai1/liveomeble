// /data/resellers.json — salony partnerskie dla wyszukiwarki w przeglądarce (publiczne pola z bazy salonów).
import type { APIRoute } from 'astro';
import { resellers } from '../../lib/site';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      resellers.map(({ id, name, address, city, district, postcode, country, voivodeship, lat, lng, phone, email, collections, offer, approx, services, openingHours }) => ({
        id, name, address, city, district, postcode, country, voivodeship, lat, lng, phone, email, collections, offer, approx, services, openingHours,
      })),
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
