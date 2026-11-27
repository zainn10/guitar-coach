// Goal-song readiness: which skills you still need for each goal piece.
import goalsJson from '../../content/goals.json';
import { lessonById, songById } from '../content';
import { Card, useStore } from '../ui';

interface Need { label: string; lesson?: string; song?: string }
interface Goal { id: string; title: string; note: string; needs: Need[] }
export const GOALS = goalsJson.goals as Goal[];

export function GoalReadiness() {
  const d = useStore();
  const done = (n: Need) => {
    if (n.lesson) return d.lessons[n.lesson]?.status === 'passed';
    if (n.song) { const it = d.items[`song:${n.song}`]; return !!it && it.history.some(h => h.pass); }
    return false;
  };
  return (
    <Card title="Goal pieces: how ready are you?">
      <div className="grid-2">
        {GOALS.map(g => {
          const n = g.needs.filter(done).length;
          return (
            <div key={g.id} className="goal">
              <h3>{g.title}</h3>
              <div className="goal-meter"><span style={{ width: `${Math.round((n / g.needs.length) * 100)}%` }} /></div>
              <p className="small muted">{n} of {g.needs.length} skills ready</p>
              <ul className="goal-needs">
                {g.needs.map((x, i) => {
                  const ok = done(x);
                  const href = x.lesson ? `#lesson/${x.lesson}` : x.song ? `#songs/${x.song}` : undefined;
                  const sub = x.lesson ? `Lesson: ${lessonById(x.lesson)?.title ?? x.lesson}` : x.song ? `Play-along: ${songById(x.song)?.title ?? x.song}` : '';
                  return <li key={i} className={ok ? 'ok' : ''}><span className="gn-dot">{ok ? '✓' : ''}</span><span>{href ? <a href={href}>{x.label}</a> : x.label}<br /><span className="small muted">{sub}</span></span></li>;
                })}
              </ul>
              <p className="small">{g.note}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
