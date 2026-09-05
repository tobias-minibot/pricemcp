import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

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

const trueForgeAgent = JSON.parse(await readFile(new URL('../trueforge/agent.json', import.meta.url), 'utf8'));
const trueForgeManifest = trueForgeAgent.manifest;
const priceMcpServer = trueForgeManifest?.mcp_servers?.find((server) => server.name === 'pricemcp-demo');
assert(priceMcpServer, 'TrueForge agent is missing the pricemcp-demo connector');
assert(
  priceMcpServer.require_approval_for_tools?.includes('record_decision'),
  'TrueForge agent does not require approval for record_decision',
);
assert(trueForgeManifest.config?.sandbox?.enabled === true, 'TrueForge agent sandbox is not enabled');
assert(trueForgeManifest.config?.sandbox?.file_downloads === true, 'TrueForge sandbox artifacts are not downloadable');
for (const disclosure of ['synthetic benchmark dataset', 'not purchasable', 'pause for human approval']) {
  assert(
    trueForgeManifest.instructions?.toLowerCase().includes(disclosure),
    `TrueForge instructions are missing boundary: ${disclosure}`,
  );
}
for (const evidenceAsset of [
  '../docs/assets/pricemcp-mac-mini.png',
  '../docs/assets/trueforge-approval.png',
  '../docs/assets/trueforge-complete.png',
]) {
  const evidence = await stat(new URL(evidenceAsset, import.meta.url));
  assert(evidence.isFile() && evidence.size > 1_000, `TrueForge evidence asset is missing or empty: ${evidenceAsset}`);
}

const repo = await (await fetchOk('https://api.github.com/repos/tobias-minibot/pricemcp')).json();
assert(repo.private === false, 'GitHub repository is not public');
assert(repo.default_branch === 'main', `unexpected default branch: ${repo.default_branch}`);

const mainCommit = await (await fetchOk('https://api.github.com/repos/tobias-minibot/pricemcp/commits/main')).json();
assert(mainCommit.sha, 'GitHub main branch did not resolve to a commit');
const mainChecks = await (
  await fetchOk(`https://api.github.com/repos/tobias-minibot/pricemcp/commits/${mainCommit.sha}/check-runs`, {
    headers: { accept: 'application/vnd.github+json' },
  })
).json();
const successfulCi = mainChecks.check_runs?.find(
  (check) => ['verify', 'refresh-verify'].includes(check.name) && check.status === 'completed' && check.conclusion === 'success',
);
assert(successfulCi, `current main commit ${mainCommit.sha.slice(0, 7)} does not have a successful CI verify check`);

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

const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const pitchUrl = readme.match(/narrated investor pitch\]\((https:\/\/youtu\.be\/[^)]+)\)/)?.[1];
assert(pitchUrl, 'README is missing the narrated investor pitch URL');
const pitchVideo = await (await fetchOk(`https://www.youtube.com/oembed?url=${encodeURIComponent(pitchUrl)}&format=json`)).json();
assert(pitchVideo.type === 'video', 'Investor pitch URL does not resolve to a video');

const releaseApiUrl = 'https://api.github.com/repos/tobias-minibot/pricemcp/releases/tags/hackathon-demo-v1';
const releaseMetadata = await (await fetchOk(releaseApiUrl)).json();
const releaseAsset = releaseMetadata.assets?.find((asset) => asset.name === 'pricemcp-demo.mp4');
assert(releaseAsset, 'GitHub release is missing pricemcp-demo.mp4');
const pitchReleaseAsset = releaseMetadata.assets?.find((asset) => asset.name === 'pricemcp-investor-pitch.mp4');
assert(pitchReleaseAsset, 'GitHub release is missing pricemcp-investor-pitch.mp4');
const deckReleaseAsset = releaseMetadata.assets?.find((asset) => asset.name === 'pricemcp-pitch-deck.pdf');
assert(deckReleaseAsset, 'GitHub release is missing pricemcp-pitch-deck.pdf');

const demoChecksum = (await readFile(new URL('../docs/assets/pricemcp-demo.sha256', import.meta.url), 'utf8')).trim();
const checksumMatch = demoChecksum.match(/^([a-f0-9]{64})\s+pricemcp-demo\.mp4$/);
assert(checksumMatch, 'demo checksum manifest is malformed');
const expectedVideoDigest = `sha256:${checksumMatch[1]}`;
assert(releaseAsset.digest === expectedVideoDigest, `release video digest ${releaseAsset.digest} does not match manifest ${expectedVideoDigest}`);

const release = await fetchOk(releaseAsset.browser_download_url, { method: 'HEAD' });
assert(release.url.includes('release-assets.githubusercontent.com'), 'GitHub release video did not resolve to a release asset');
const pitchRelease = await fetchOk(pitchReleaseAsset.browser_download_url, { method: 'HEAD' });
assert(pitchRelease.url.includes('release-assets.githubusercontent.com'), 'Investor pitch backup did not resolve to a release asset');

const deckBytes = await readFile(new URL('../docs/assets/pricemcp-pitch-deck.pdf', import.meta.url));
const deckDigest = `sha256:${createHash('sha256').update(deckBytes).digest('hex')}`;
assert(deckReleaseAsset.digest === deckDigest, `release pitch deck digest ${deckReleaseAsset.digest} does not match repository ${deckDigest}`);

const developer = await (await fetchOk('https://pricemcp.vercel.app/developer')).text();
for (const marker of ['Live MCP infrastructure console', 'Actual MCP request', 'search_price', 'synthetic and non-bookable']) {
  assert(developer.includes(marker), `live developer console is missing marker: ${marker}`);
}

console.log(JSON.stringify({
  status: 'ready',
  repository: `${repo.full_name} (${repo.visibility.toLowerCase()})`,
  ci: `current main ${mainCommit.sha.slice(0, 7)} verified`,
  qodo_evidence: `PR #2 merged; ${qodoComments.length} public comments inspected`,
  youtube_url: youtubeUrl,
  youtube_video: video.title,
  release_backup: 'reachable; sha256 matches the tracked demo manifest',
  investor_assets: 'YouTube pitch and release backups reachable; deck sha256 matches repository',
  developer_console: 'reachable with live MCP and synthetic-flight disclosures',
  trueforge_evidence: 'sandbox enabled; evidence assets present; record_decision approval gate preserved',
  local_disclosures: 'synthetic dataset and non-purchasable boundaries preserved',
  manual_gate: 'official submission form and receipt require human/external confirmation',
}, null, 2));
