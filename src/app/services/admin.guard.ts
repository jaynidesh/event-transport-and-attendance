import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { get, ref } from 'firebase/database';
import { auth, database } from './firebase';
import { environment } from '../../environments/environment';

export const adminGuard: CanActivateFn = async () => {
  const router = inject(Router);
  await auth.authStateReady();
  if (!auth.currentUser) return router.parseUrl('/staff/login?returnUrl=import');
  try {
    const snapshot = await get(ref(database, `events/${environment.eventId}/staff/${auth.currentUser.uid}`));
    const staff = snapshot.val();
    return staff?.active === true && staff?.role === 'admin'
      ? true : router.parseUrl('/staff/dashboard');
  } catch {
    return router.parseUrl('/staff/login?returnUrl=import');
  }
};
