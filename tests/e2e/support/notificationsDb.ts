import pg from 'pg';

// The notification inbox has no route until Review Insights (X8, slice 5):
// until then a journey reads a user's notifications straight from the test
// database, as the API's own role — a plain SELECT, nothing written (I6, OQ-237).

/** One stored notification, as the inbox will list it. */
export interface StoredNotification {
  readonly type: string;
  readonly params: Readonly<Record<string, unknown>>;
}

/**
 * Lists a user's notifications of one type, oldest first.
 *
 * @param userId - The recipient.
 * @param type - The notification type, e.g. `holding.matured`.
 * @returns Their notifications of that type.
 */
const notificationsOf = async (
  userId: string,
  type: string,
): Promise<readonly StoredNotification[]> => {
  const connectionString = process.env.DATABASE_TEST_URL;
  if (!connectionString) throw new Error('DATABASE_TEST_URL is not set (see .env.example)');
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<StoredNotification>(
      'SELECT type, params FROM notifications WHERE user_id = $1 AND type = $2 ORDER BY created_at',
      [userId, type],
    );
    return result.rows;
  } finally {
    await client.end();
  }
};

export default notificationsOf;
