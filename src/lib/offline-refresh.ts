// Upload checks are frequent; downloading the whole saved workspace is not.
export const OFFLINE_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
export function shouldRefreshOffline(downloadedAt: string | undefined, force: boolean, changed: boolean, now = Date.now()) {
  const downloaded = downloadedAt ? Date.parse(downloadedAt) : NaN;
  return force || changed || !Number.isFinite(downloaded) || now - downloaded >= OFFLINE_REFRESH_INTERVAL_MS;
}
