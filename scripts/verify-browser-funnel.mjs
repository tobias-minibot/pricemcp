import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

const baseUrl = new URL(process.env.PRICEMCP_LIVE_URL || 'https://pricemcp.vercel.app');
const timeoutMs = 30_000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function chromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const executable = candidates.find(existsSync);
  assert(executable, 'Chrome/Chromium is required for live browser verification (or set CHROME_PATH)');
  return executable;
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function waitFor(check, message, timeout = timeoutMs) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(message);
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  assert(!result.exceptionDetails, result.exceptionDetails?.text || 'Browser evaluation failed');
  return result.result.value;
}

async function waitForBrowser(client, expression, message) {
  return waitFor(() => evaluate(client, expression), message);
}

async function navigate(client, url) {
  await client.call('Page.navigate', { url: new URL(url, baseUrl).href });
  await waitForBrowser(client, "document.readyState === 'complete'", `Browser did not load ${url}`);
}

const profileDir = await mkdtemp(join(tmpdir(), 'pricemcp-live-browser-'));
const port = await availablePort();
const chrome = spawn(chromeExecutable(), [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--no-sandbox',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  'about:blank',
], { stdio: 'ignore' });

let client;
try {
  const version = await waitFor(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      return response.ok ? response.json() : null;
    } catch {
      return null;
    }
  }, 'Chrome DevTools did not become available');
  assert(version.webSocketDebuggerUrl, 'Chrome DevTools has no browser endpoint');

  const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl.href)}`, { method: 'PUT' });
  assert(targetResponse.ok, 'Could not create browser verification target');
  const target = await targetResponse.json();
  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.call('Page.enable');
  await client.call('Runtime.enable');
  await client.call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

  await navigate(client, '/cheap-apples');
  const cheapApples = await evaluate(client, `(() => ({
    title: document.title,
    freshLabel: document.querySelector('.ca-kicker')?.textContent.trim(),
    deals: document.querySelectorAll('.ca-deal').length,
    searchAction: document.querySelector('.ca-search')?.getAttribute('action'),
    companionLinks: [...document.querySelectorAll('.ca-deal a')].filter((link) => link.getAttribute('href')?.startsWith('/companion?q=')).length,
    evidenceLinks: [...document.querySelectorAll('.ca-deal a')].filter((link) => link.getAttribute('href')?.startsWith('/products/')).length,
    primaryCompanionHref: document.querySelector('.ca-deal a[href^="/companion?q="]')?.getAttribute('href'),
    primaryProduct: document.querySelector('.ca-deal h3')?.textContent,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))()`);
  assert(cheapApples.title.startsWith('Cheap Apples'), 'Cheap Apples has the wrong browser title');
  assert(cheapApples.deals > 0, 'Cheap Apples rendered no fresh deal cards');
  assert(cheapApples.searchAction === '/companion', 'Cheap Apples search does not lead to Companion');
  assert(cheapApples.companionLinks === cheapApples.deals, 'A Cheap Apples deal is missing its Companion path');
  assert(cheapApples.evidenceLinks === cheapApples.deals, 'A Cheap Apples deal is missing its evidence path');
  assert(cheapApples.primaryCompanionHref && cheapApples.primaryProduct, 'Cheap Apples has no executable featured deal');
  assert(cheapApples.overflow <= 0, `Cheap Apples overflows mobile viewport by ${cheapApples.overflow}px`);

  await navigate(client, '/');
  const companionHref = await evaluate(client, "document.querySelector('a[href^=\"/companion?q=\"]')?.getAttribute('href')");
  assert(companionHref, 'Homepage has no consumer Companion entry point');
  await navigate(client, cheapApples.primaryCompanionHref);
  await waitForBrowser(
    client,
    "document.querySelector('#decision-tag')?.textContent === 'READY TO DECIDE'",
    'Companion did not render a ready consumer decision',
  );
  const companion = await evaluate(client, `(() => {
    const handoff = document.querySelector('#retailer-handoff');
    const save = document.querySelector('#save-choice');
    return {
      product: document.querySelector('#decision-name')?.textContent,
      price: document.querySelector('#decision-price')?.textContent,
      provider: document.querySelector('#decision-provider')?.textContent,
      handoff: handoff && !handoff.hidden ? handoff.href : null,
      saveEnabled: save && !save.disabled,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assert(companion.product === cheapApples.primaryProduct, 'Cheap Apples resolved a different Companion product');
  assert(companion.handoff?.startsWith('https://'), 'Companion exposed no safe HTTPS retailer handoff');
  assert(companion.saveEnabled, 'Companion decision cannot be saved');
  assert(companion.overflow <= 0, `Companion overflows mobile viewport by ${companion.overflow}px`);
  await evaluate(client, "document.querySelector('#save-choice').click()");
  await waitForBrowser(client, "document.querySelector('#saved-state')?.hidden === false", 'Companion did not save the decision');

  await navigate(client, '/decisions');
  await waitForBrowser(client, "document.querySelectorAll('.watch-card').length === 1", 'Saved decision did not reach the watchlist');
  await evaluate(client, "document.querySelector('#recheck-all').click()");
  await waitForBrowser(
    client,
    "document.querySelector('#watch-status')?.textContent.startsWith('All 1 saved decision rechecked')",
    'Watchlist batch recheck did not complete',
  );
  const watchlist = await evaluate(client, `(() => {
    const handoff = [...document.querySelectorAll('.watch-card a')].find((link) => link.textContent.includes('Continue'));
    return {
      cards: document.querySelectorAll('.watch-card').length,
      status: document.querySelector('#watch-status')?.textContent,
      result: document.querySelector('.watch-card .tag')?.textContent,
      handoff: handoff?.href || null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assert(watchlist.result, 'Watchlist did not render a comparison state');
  assert(watchlist.handoff?.startsWith('https://'), 'Watchlist exposed no safe HTTPS retailer handoff');
  assert(watchlist.overflow <= 0, `Watchlist overflows mobile viewport by ${watchlist.overflow}px`);

  console.log(JSON.stringify({
    status: 'ok',
    viewport: '390x844',
    cheap_apples: cheapApples,
    companion,
    watchlist,
  }, null, 2));
} finally {
  client?.close();
  chrome.kill('SIGTERM');
  await new Promise((resolve) => chrome.once('exit', resolve)).catch(() => {});
  await rm(profileDir, { recursive: true, force: true });
}
