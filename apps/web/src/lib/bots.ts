/**
 * Crawlers, link previews and scripts. Their visits are not counted in club
 * reports. Real golfers' browsers never match.
 */
const BOT =
  /bot\b|bot\/|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|httpx|go-http|java\/|headless|lighthouse|pingdom|uptime|monitor/i;

export function isBot(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT.test(userAgent);
}
