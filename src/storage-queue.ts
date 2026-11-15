export function createPersistenceQueue() {
  let queue: Promise<void> = Promise.resolve();
  const latestVersion = new Map<string, number>();
  let sequence = 0;

  return {
    idle(): Promise<void> {
      return queue;
    },
    // Commands (archive/delete/backup) must run even if a later snapshot supersedes them.
    command(operation: () => Promise<void>): Promise<void> {
      const pending = queue.then(operation);
      queue = pending.catch(() => undefined);
      return pending;
    },
    run(key: string, operation: () => Promise<void>): Promise<void> {
      const version = ++sequence;
      latestVersion.set(key, version);
      const pending = queue.then(async () => {
        if (latestVersion.get(key) !== version) return;
        await operation();
      });
      queue = pending.catch(() => undefined);
      return pending;
    },
  };
}
