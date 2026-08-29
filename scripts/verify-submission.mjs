import { readFile } from 'node:fs/promises';

const timeoutMs = 20_000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchOk(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { 'user-agent': 'pricemcp-submission-preflight', ...init.headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  assert(response.ok, `${url} returned HTTP ${response.status}`);
  return response;
}

const submission = await readFile(new URL('../docs/SUBMISSION.md', import.meta.url), 'utf8');
const normalizedSubmission = submission.replace(/\s+/g, ' ');
for (const disclosure of [
  'synthetic: true',
  'dataset: pricemcp-demo-v1',
  'requires explicit human approval',
  'does not buy, reserve, message a merchant, or spend money',
]) {
  assert(normalizedSubmission.includes(disclosure), `submission copy is missing disclosure: ${disclosure}`);
}

const repo = await (await fetchOk('https://api.github.com/repos/tobias-minibot/pricemcp')).json();
assert(repo.private === false, 'GitHub repository is not public');
assert(repo.default_branch === 'main', `unexpected default branch: ${repo.default_branch}`);

const qodoPr = await (await fetchOk('https://api.github.com/repos/tobias-minibot/pricemcp/pulls/2')).json();
assert(qodoPr.merged_at, 'Qodo evidence PR #2 is not merged');

const qodoComments = await (await fetchOk('https://api.github.com/repos/tobias-minibot/pricemcp/issues/2/comments?per_page=100')).json();
for (const commentId of [5464186759, 5464190900, 5464200382]) {
  assert(qodoComments.some((comment) => comment.id === commentId), `Qodo evidence comment ${commentId} is missing`);
}

const youtubeUrl = submission.match(/Required YouTube submission URL:\s*`(https:\/\/youtu\.be\/[^`]+)`/)?.[1];
assert(youtubeUrl, 'submission copy is missing the required YouTube submission URL');
const video = await (await fetchOk(`https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`)).json();
assert(video.type === 'video', 'YouTube URL does not resolve to a video');

const release = await fetchOk('https://github.com/tobias-minibot/pricemcp/releases/download/hackathon-demo-v1/pricemcp-demo.mp4', { method: 'HEAD' });
assert(release.url.includes('release-assets.githubusercontent.com'), 'GitHub release video did not resolve to a release asset');

const developer = await (await fetchOk('https://pricemcp.vercel.app/developer')).text();
for (const marker of ['Live MCP infrastructure console', 'Actual MCP request', 'search_price', 'synthetic and non-bookable']) {
  assert(developer.includes(marker), `live developer console is missing marker: ${marker}`);
}

console.log(JSON.stringify({
  status: 'ready',
  repository: `${repo.full_name} (${repo.visibility.toLowerCase()})`,
  qodo_evidence: `PR #2 merged; ${qodoComments.length} public comments inspected`,
  youtube_url: youtubeUrl,
  youtube_video: video.title,
  release_backup: 'reachable',
  developer_console: 'reachable with live MCP and synthetic-flight disclosures',
  local_disclosures: 'synthetic dataset and approval boundary preserved',
  manual_gate: 'official submission form and receipt require human/external confirmation',
}, null, 2));
