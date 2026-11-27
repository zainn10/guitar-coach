// "Ask Claude": sends what you're working on plus your recent results to Claude
// and shows a short, personal tip. Only works once you add your own API key
// (Settings). Nothing is sent until you press the button.
import { useState } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import { store } from '../storage/store';
import { useStore } from '../ui';

const SYSTEM = `You are a warm, practical guitar teacher helping one adult beginner who plays a right-handed nylon-string (classical) guitar and is especially interested in flamenco. They learn visually and are not technical.
Answer in plain British English, in at most about 150 words: one short diagnosis, then 2-4 concrete things to try, ordered by likely impact. Use string names (6th = low E) and finger numbers (1 index, 2 middle, 3 ring, 4 little; right hand p-i-m-a).
Never include song lyrics, melodies, riffs or solo transcriptions of copyrighted songs; chord names and technique are fine.`;

/** A compact summary of recent performance, so the advice is personal. */
export function performanceSummary(): string {
  const d = store.get();
  const items = Object.entries(d.items)
    .sort((a, b) => a[1].strength - b[1].strength)
    .slice(0, 8)
    .map(([k, v]) => `${k}: strength ${(v.strength * 100).toFixed(0)}%, ${v.count} attempts, last ${v.history.at(-1)?.pass ? 'passed' : 'not passed'}`);
  const drills = d.drills.slice(-5).map(r => `${r.from}↔${r.to}: ${r.clean} clean changes/min`);
  const takes = d.takes.slice(-3).map(t => `${t.song}: ${t.headline}${t.trouble?.length ? ' Trouble: ' + t.trouble.join('; ') : ''}`);
  const days = Object.keys(d.practice).length;
  return [
    `Practising for ${days} day(s).`,
    items.length ? `Weakest items: ${items.join(' | ')}` : '',
    drills.length ? `Recent change drills: ${drills.join(' | ')}` : '',
    takes.length ? `Recent play-alongs: ${takes.join(' | ')}` : '',
  ].filter(Boolean).join('\n');
}

export async function askClaude(apiKey: string, context: string, question: string): Promise<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'low' },
    // If the main model declines, the API retries on a suitable fallback model in the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `What I'm working on: ${context}\n\nMy recent practice:\n${performanceSummary()}\n\nMy question: ${question || 'What should I focus on to fix this, and how?'}`,
    }],
  });
  if (response.stop_reason === 'refusal') return "Claude couldn't answer that one. Try rephrasing your question.";
  return response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map(b => b.text).join('\n').trim();
}

export function AskClaude({ context, label = 'Ask Claude for a personal tip' }: { context: string; label?: string }) {
  const { settings } = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const key = settings.claudeKey;

  if (!open) return <button className="btn ask-btn" onClick={() => setOpen(true)}>✦ {label}</button>;
  return (
    <div className="ask-panel">
      <div className="row spread"><strong>✦ Ask Claude</strong><button className="btn link" onClick={() => setOpen(false)}>Close</button></div>
      {!key ? (
        <p className="small">To use this, add your own Anthropic API key in <a href="#settings">Settings</a>. Each question costs a fraction of a penny. Nothing is ever sent without you pressing the button.</p>
      ) : (
        <>
          <p className="small muted">Claude sees what you're working on and your recent results (no recordings).</p>
          <textarea id="ask-q" rows={2} placeholder="Optional: ask something specific, e.g. 'my 2nd string keeps buzzing in C'" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn primary small" disabled={busy} onClick={async () => {
            setBusy(true); setErr(null); setAnswer(null);
            try { setAnswer(await askClaude(key, context, q)); }
            catch (e) {
              if (e instanceof Anthropic.AuthenticationError) setErr('Your API key was rejected. Check it in Settings.');
              else if (e instanceof Anthropic.RateLimitError) setErr('Too many questions at once. Wait a minute and try again.');
              else if (e instanceof Anthropic.APIConnectionError) setErr("Couldn't reach Claude. Are you online?");
              else if (e instanceof Anthropic.APIError) setErr(`Claude returned an error (${e.status}). Try again in a moment.`);
              else setErr(String((e as Error).message ?? e));
            }
            setBusy(false);
          }}>{busy ? 'Thinking…' : 'Ask'}</button>
          {err && <p className="error" role="alert">{err}</p>}
          {answer && <div className="ask-answer" aria-live="polite">{answer.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p.replace(/\*\*/g, '')}</p>)}</div>}
        </>
      )}
    </div>
  );
}
