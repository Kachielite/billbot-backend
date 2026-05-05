/**
 * Quick push notification smoke test.
 * Sends a test notification to all OneSignal subscribers (or a specific player ID).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/test-push.ts
 *   npx ts-node -r tsconfig-paths/register scripts/test-push.ts <player_id>
 */
import 'dotenv/config';

const APP_ID = process.env.ONESIGNAL_APP_ID ?? '';
const REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY ?? '';
const playerId = process.argv[2] ?? null;

if (!APP_ID || !REST_API_KEY) {
  console.error('❌  ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY is missing from .env');
  process.exit(1);
}

const target = playerId ? { include_player_ids: [playerId] } : { included_segments: ['All'] };

const body = {
  app_id: APP_ID,
  ...target,
  headings: { en: '🔔 BillBot test push' },
  contents: { en: '✅ If you see this, push notifications are working!' },
  data: { type: 'general', action: 'test' },
};

async function run() {
  console.log('\n📤  Sending to:', playerId ? `player ${playerId}` : 'All subscribers');
  console.log('📦  Payload:', JSON.stringify(body, null, 2));

  // Try with "Key" auth (new os_v2_app_ format) first, then fall back to "Basic"
  for (const scheme of ['Key', 'Basic']) {
    console.log(`\n🔑  Trying Authorization: ${scheme} ...`);

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `${scheme} ${REST_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    console.log(`📬  Status: ${res.status}`);
    console.log('📋  Response:', JSON.stringify(json, null, 2));

    if (res.ok) {
      console.log(`\n✅  Success with "${scheme}" scheme — update push.ts if needed.`);
      process.exit(0);
    }
  }

  console.log('\n❌  Both auth schemes failed — check the response above for details.');
  process.exit(1);
}

run().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
