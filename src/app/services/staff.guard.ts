import { inject } from '@angular/core';
import { CanActivateFn,Router } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';
import { get,ref } from 'firebase/database';
import { auth,database } from './firebase';
import { environment } from '../../environments/environment';
export const staffGuard:CanActivateFn=async()=>{
 const router=inject(Router);
 const user=await new Promise<typeof auth.currentUser>(resolve=>{const unsubscribe=onAuthStateChanged(auth,u=>{unsubscribe();resolve(u);},()=>resolve(null));});
 if(!user)return router.parseUrl('/staff/login');
 try {const snap=await get(ref(database,`events/${environment.eventId}/staff/${user.uid}`));return snap.val()?.active===true?true:router.parseUrl('/staff/login');}catch{return router.parseUrl('/staff/login');}
};
