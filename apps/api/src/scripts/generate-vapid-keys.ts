import webpush from 'web-push';

/**
 * One-off VAPID key generator - the pair identifies this server to browser
 * push services (Chrome/Firefox), independent of any user account.
 *
 * Run with: npm run push:generate-keys --workspace @cars-fetcher/api
 * Paste the output into .env, then restart the API.
 */
const keys = webpush.generateVAPIDKeys();

console.log('\nDodaj do .env:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:twoj-adres@example.com\n`);
