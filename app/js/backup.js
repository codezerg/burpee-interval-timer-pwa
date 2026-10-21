// Backup export/import (a JSON file you keep somewhere safe), install help,
// and the "new version available" check.

import van from 'vanjs-core';
import * as store from './store.js';

// ------------------------------------------------------------------ export
export async function exportBackup() {
  const json = store.exportData();
  const date = new Date().toISOString().slice(0, 10);
  const name = `burpee-backup-${date}.json`;
  const file = new File([json], name, { type: 'application/json' });

  // On phones the share sheet lets you save to Files / Drive / email.
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (mobile && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Burpee Timer backup' });
      store.markBackedUp();
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
      // fall through to a plain download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  store.markBackedUp();
  return 'downloaded';
}

// ------------------------------------------------------------------ import
// Opens a file picker; resolves with the parsed backup (not yet applied), or null.
export function pickBackup() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(store.parseBackup(await file.text()));
      } catch (err) {
        reject(err);
      }
    });
    input.click();
  });
}

// ------------------------------------------------------------------ install
let deferredPrompt = null;

function computeInstallState() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) return 'installed';
  if (deferredPrompt) return 'prompt';
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios';
  return 'manual';
}

// installed | prompt (Android install button) | ios (Add to Home Screen steps) | manual
export const installState = van.state(computeInstallState());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // show our own button in Settings instead
  deferredPrompt = e;
  installState.val = computeInstallState();
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  installState.val = 'installed';
});

export async function promptInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installState.val = computeInstallState();
}

// ------------------------------------------------------------------ updates
// version.json is written by the deploy workflow (git commit id).
let loadedVersion = null;
export const version = van.state(null);

async function fetchVersion() {
  try {
    const res = await fetch('version.json', { cache: 'no-store' });
    return res.ok ? (await res.json()).version : null;
  } catch {
    return null;
  }
}

// Opened offline, the app runs the saved copy from its last online visit,
// so remember which version that was.
const SEEN_KEY = 'burpee-interval-timer:version';

export async function initVersion() {
  loadedVersion = await fetchVersion();
  try {
    if (loadedVersion) localStorage.setItem(SEEN_KEY, loadedVersion);
    else loadedVersion = localStorage.getItem(SEEN_KEY);
  } catch { /* storage unavailable */ }
  version.val = loadedVersion;
  return loadedVersion;
}

export async function updateAvailable() {
  const latest = await fetchVersion();
  return Boolean(latest && loadedVersion && latest !== loadedVersion);
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker failed', err));
}
