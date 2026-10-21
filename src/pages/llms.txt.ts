// /llms.txt — przewodnik po stronie dla modeli językowych (format llmstxt.org), generowany z danych i treści.
import type { APIRoute } from 'astro';
import { llmsTxt } from '../lib/llms';

export const GET: APIRoute = async () =>
  new Response(await llmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
