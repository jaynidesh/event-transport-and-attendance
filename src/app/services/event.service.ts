import { Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { onValue, ref, runTransaction, serverTimestamp } from 'firebase/database';
import { auth,database,functions } from './firebase';
import { environment } from '../../environments/environment';
import { Attendee,AttendanceStatus,LookupResult } from './models';
@Injectable({providedIn:'root'})
export class EventService {
 private root=`events/${environment.eventId}`;
 async lookup(id:string):Promise<LookupResult> {const call=httpsCallable<{employeeId:string;eventId:string},LookupResult>(functions,'lookupTransport'); const result=await call({employeeId:id.trim().toUpperCase(),eventId:environment.eventId});return result.data;}
 subscribeAttendees(callback:(attendees:Attendee[])=>void,error:(message:string)=>void):()=>void {return onValue(ref(database,`${this.root}/attendees`),snapshot=>{const raw=snapshot.val()||{};callback(Object.values(raw) as Attendee[]);},err=>error(err.message));}
 async changeAttendance(employeeId:string,status:AttendanceStatus):Promise<'updated'|'unchanged'> {
  const uid=auth.currentUser?.uid;if(!uid)throw new Error('Sign in required');
  const target=ref(database,`${this.root}/attendees/${employeeId}/attendance`);
  const result=await runTransaction(target,current=>{if(!current||current.status===status)return;return {status,checkedInAt:serverTimestamp(),checkedInBy:uid};},{applyLocally:false});
  return result.committed?'updated':'unchanged';
 }
}
