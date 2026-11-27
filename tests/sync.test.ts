import { mergeData, Data } from '../src/storage/store';

const base = (device: string, over: Partial<Data> = {}): Data => ({
  settings: { headphones: true, theme: 'system', diagramView: 'chart', sensitivity: 'medium' },
  attempts: {}, takes: [], lessons: {}, items: {}, drills: [], practice: {}, ladders: {}, quizzes: [],
  startedAt: 1000, device, ...over,
});

describe('syncing progress between Mac and phone', () => {
  it('keeps everything from both devices', () => {
    const mac = base('mac', {
      lessons: { a: { status: 'passed', attempts: [{ t: 1, passed: true, score: 1, shortfall: [] }], checks: { 0: true } }, b: { status: 'started', attempts: [], checks: { 0: true } } },
      practice: { '2026-11-27': 600 },
      drills: [{ t: 5, from: 'Em', to: 'Am', changes: 20, clean: 18, seconds: 60 }],
      items: { 'chord:G': { strength: 0.3, box: 1, due: 0, last: 100, count: 3, history: [{ t: 100, score: 0.3, pass: false }] } },
    });
    const phone = base('phone', {
      lessons: { b: { status: 'started', attempts: [], checks: { 1: true } }, c: { status: 'passed', attempts: [], checks: { 0: true } } },
      practice: { '2026-11-27': 300, '2026-11-28': 900 },
      drills: [{ t: 9, from: 'Em', to: 'Am', changes: 25, clean: 22, seconds: 60 }],
      items: { 'chord:G': { strength: 0.8, box: 2, due: 0, last: 200, count: 2, history: [{ t: 200, score: 0.9, pass: true }] } },
      startedAt: 500,
    });
    const m = mergeData(mac, phone, '2026-11-28T10:00:00Z');
    expect(Object.keys(m.lessons).sort()).toEqual(['a', 'b', 'c']);
    expect(m.lessons.b.checks).toEqual({ 0: true, 1: true });
    expect(m.drills).toHaveLength(2);
    expect(m.items['chord:G'].strength).toBe(0.8);
    expect(m.items['chord:G'].history).toHaveLength(2);
    expect(m.practice).toEqual({ '2026-11-27': 600 });
    expect(m.practiceOthers?.phone).toEqual({ '2026-11-27': 300, '2026-11-28': 900 });
    expect(m.startedAt).toBe(500);
    expect(m.device).toBe('mac');
    // merging the same backup twice changes nothing
    const again = mergeData(m, phone, '2026-11-28T10:00:00Z');
    expect(again.drills).toHaveLength(2);
    expect(again.practiceOthers?.phone).toEqual(m.practiceOthers?.phone);
  });
});
