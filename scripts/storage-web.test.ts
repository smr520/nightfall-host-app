import { openDatabaseAsync } from 'expo-sqlite';
import { webKeyValueStore } from '../src/storage.web';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

describe('web SQLite key-value adapter', () => {
  it('uses a normal Web-compatible transaction for atomic multiSet imports', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1 });
    const withTransactionAsync = jest.fn(async operation => operation());
    const db = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue({ value: 'stored' }),
      runAsync,
      withTransactionAsync,
    };
    jest.mocked(openDatabaseAsync).mockResolvedValue(db as never);

    await expect(webKeyValueStore.getItem('key')).resolves.toBe('stored');
    await webKeyValueStore.multiSet([
      ['first', 'one'],
      ['second', 'two'],
    ]);

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS storage'));
    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenCalledTimes(2);
  });
});
