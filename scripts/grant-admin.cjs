const admin = require('firebase-admin');
const [uid, eventId = 'eoy2026'] = process.argv.slice(2);
if (!uid || !process.env.FIREBASE_DATABASE_URL || /[.#$\[\]/]/.test(uid) || !/^[A-Za-z0-9_-]+$/.test(eventId)) {
  console.error('Usage: FIREBASE_DATABASE_URL=... node scripts/grant-admin.cjs <firebase-auth-uid> [eventId]');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.applicationDefault(), databaseURL: process.env.FIREBASE_DATABASE_URL });
admin.database().ref(`events/${eventId}/staff/${uid}`).update({ role: 'admin', active: true })
  .then(() => { console.log('Granted event administrator access to', uid); process.exit(0); })
  .catch(error => { console.error(error); process.exit(1); });
