import { config } from '../config';

function hostOf(url: string): string | null {
  const match = /^https?:\/\/([^/:?#]+)/i.exec(url);
  return match ? match[1].toLowerCase() : null;
}

function onDomains(url: string, domains: string[]): boolean {
  const host = hostOf(url);
  return !!host && domains.some((d) => host === d || host.endsWith('.' + d));
}

/** Pages a WebView may load without leaving the kiosk (blank pages, inline HTML). */
export function isInternal(url: string): boolean {
  return /^(about:|data:|blob:)/i.test(url);
}

/** A link from the Sensor that should open the browse view. */
export function isBrowseUrl(url: string): boolean {
  return onDomains(url, config.browseDomains);
}

export function isSensorUrl(url: string): boolean {
  return onDomains(url, config.sensorDomains);
}

/** Android WebView cannot display PDFs, so brochure links are blocked with a notice. */
export function isPdf(url: string): boolean {
  return /\.pdf($|[?#])/i.test(url);
}

/**
 * Address-bar view of a URL, like a mobile browser: no scheme, no "www.",
 * no trailing slash, no query or hash. e.g. "seylan.lk/personal/savings".
 */
export function displayAddress(url: string): { host: string; path: string; secure: boolean } {
  const match = /^(https?):\/\/([^/?#]+)([^?#]*)/i.exec(url);
  if (!match) return { host: '', path: '', secure: false };
  const host = match[2].toLowerCase().replace(/^www\./, '');
  const path = match[3] === '/' ? '' : match[3].replace(/\/$/, '');
  return { host, path, secure: match[1].toLowerCase() === 'https' };
}
