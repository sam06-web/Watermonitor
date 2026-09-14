import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import config from '../../config/config.js';

const MAX_DOWNLOAD_BYTES = config.providers.earthdata.maxDownloadBytes;

function isEarthdataUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (
      host === 'earthdata.nasa.gov' || host.endsWith('.earthdata.nasa.gov') ||
      host === 'podaac.jpl.nasa.gov' || host.endsWith('.podaac.jpl.nasa.gov')
    );
  } catch {
    return false;
  }
}

function safeExtension(url, contentType) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.zip')) return '.zip';
  if (pathname.endsWith('.nc4')) return '.nc4';
  if (pathname.endsWith('.nc')) return '.nc';
  if (contentType?.includes('zip')) return '.zip';
  return '.nc';
}

function metadataPath(id) {
  return path.join(config.providers.earthdata.cacheDir, `${id}.json`);
}

/**
 * Downloads an Earthdata product once and keeps it in the server-side cache.
 * The bearer token is used only for NASA's redirect chain and is never sent
 * back to a browser or persisted in metadata.
 */
export async function downloadEarthdataProduct(sourceUrl) {
  if (!isEarthdataUrl(sourceUrl)) {
    throw new Error('Only HTTPS NASA Earthdata or PO.DAAC product URLs are allowed.');
  }

  const token = config.providers.earthdata.token;
  if (!token) throw new Error('NASA_EARTHDATA_TOKEN is not configured on the server.');

  const id = crypto.createHash('sha256').update(sourceUrl).digest('hex').slice(0, 24);
  fs.mkdirSync(config.providers.earthdata.cacheDir, { recursive: true });

  const existingMetadataFile = metadataPath(id);
  if (fs.existsSync(existingMetadataFile)) {
    const existing = JSON.parse(fs.readFileSync(existingMetadataFile, 'utf8'));
    if (existing.file && fs.existsSync(path.join(config.providers.earthdata.cacheDir, existing.file))) {
      return existing;
    }
  }

  const response = await fetch(sourceUrl, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow',
    signal: AbortSignal.timeout(5 * 60 * 1000)
  });
  if (!response.ok) {
    throw new Error(response.status === 401 || response.status === 403
      ? 'NASA Earthdata rejected the server token.'
      : `NASA Earthdata returned HTTP ${response.status}.`);
  }
  if (!response.body) throw new Error('NASA Earthdata returned an empty response body.');

  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`NASA product exceeds the ${Math.floor(MAX_DOWNLOAD_BYTES / 1024 / 1024)} MB download limit.`);
  }

  const extension = safeExtension(sourceUrl, response.headers.get('content-type') || '');
  const file = `${id}${extension}`;
  const outputPath = path.join(config.providers.earthdata.cacheDir, file);
  const temporaryPath = `${outputPath}.part`;
  try {
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temporaryPath));
    const bytes = fs.statSync(temporaryPath).size;
    if (!bytes) throw new Error('NASA Earthdata returned an empty file.');
    if (bytes > MAX_DOWNLOAD_BYTES) throw new Error(`NASA product exceeds the ${Math.floor(MAX_DOWNLOAD_BYTES / 1024 / 1024)} MB download limit.`);
    fs.renameSync(temporaryPath, outputPath);
    const metadata = {
      id,
      file,
      filename: path.basename(new URL(sourceUrl).pathname) || `earthdata-product${extension}`,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      bytes,
      sourceUrl,
      downloadedAt: new Date().toISOString()
    };
    fs.writeFileSync(existingMetadataFile, JSON.stringify(metadata));
    return metadata;
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
}

export function getCachedEarthdataProduct(id) {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  const file = metadataPath(id);
  if (!fs.existsSync(file)) return null;
  const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
  const productPath = path.join(config.providers.earthdata.cacheDir, metadata.file || '');
  return fs.existsSync(productPath) ? { metadata, productPath } : null;
}

export function getEarthdataStatus() {
  return { configured: Boolean(config.providers.earthdata.token) };
}
