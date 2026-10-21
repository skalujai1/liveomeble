// /robots.txt — docs/ia.md 7.2: wyszukiwarki i boty wyszukiwania AI mile widziane,
// zamknięte: strefa partnera i API. Boty trenujące modele — decyzja klienta (domyślnie bez blokady).
import type { APIRoute } from 'astro';
import { SITE_URL } from '../config';

export const GET: APIRoute = () => {
  const body = `# Liveo Meble — ${SITE_URL}
User-agent: *
Allow: /
Disallow: /strefa-partnera/
Disallow: /api/

# Boty wyszukiwania AI (odpowiedzi z cytowaniem źródła)
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: PerplexityBot
User-agent: Claude-SearchBot
Allow: /
Disallow: /strefa-partnera/
Disallow: /api/

# [do decyzji klienta] boty trenujące modele (GPTBot, ClaudeBot, Google-Extended, CCBot):
# aby zablokować, dopisz dla każdego:  User-agent: GPTBot  +  Disallow: /

Sitemap: ${SITE_URL}/sitemap-index.xml
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
