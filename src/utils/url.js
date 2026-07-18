export function pageUrl(page, params = {}) {
  const url = new URL(page, location.href);
  url.search = new URLSearchParams(params).toString();
  return url.toString();
}
export function param(name) { return new URLSearchParams(location.search).get(name); }
