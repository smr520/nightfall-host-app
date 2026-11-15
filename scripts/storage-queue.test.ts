import { createPersistenceQueue } from '../src/storage-queue';

describe('serialized persistence queue', () => {
  it('drops stale queued session snapshots and keeps newest session state', async () => {
    const queue = createPersistenceQueue();
    const writes: number[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });

    const stale = queue.run('current-session', async () => { await firstGate; writes.push(1); });
    const latest = queue.run('current-session', async () => { writes.push(2); });
    releaseFirst();
    await Promise.all([stale, latest]);

    expect(writes).toEqual([2]);
  });

  it('skips pending writes when clear supersedes them', async () => {
    const queue = createPersistenceQueue();
    const operations: string[] = [];
    const pendingWrite = queue.run('session', async () => { operations.push('stale-write'); });
    const clear = queue.run('session', async () => { operations.push('clear'); });
    await Promise.all([pendingWrite, clear]);

    expect(operations).toEqual(['clear']);
  });

  it('rejects the failed operation but continues processing later writes', async () => {
    const queue = createPersistenceQueue();
    const writes: string[] = [];
    const failed = queue.run('session', async () => { throw new Error('storage full'); });
    await expect(failed).rejects.toThrow('storage full');
    const latest = queue.run('session', async () => { writes.push('latest'); });
    await latest;
    expect(writes).toEqual(['latest']);
  });

  it('finishes an active write before clearing its stored value', async () => {
    const queue = createPersistenceQueue();
    const operations: string[] = [];
    let started!: () => void;
    let release!: () => void;
    const start = new Promise<void>(resolve => { started = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const write = queue.run('session', async () => {
      started();
      await gate;
      operations.push('write');
    });
    await start;
    const clear = queue.run('session', async () => { operations.push('clear'); });
    release();
    await Promise.all([write, clear]);
    expect(operations).toEqual(['write', 'clear']);
  });
});
