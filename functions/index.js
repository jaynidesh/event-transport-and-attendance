const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getDatabase}=require('firebase-admin/database');
const {initializeApp}=require('firebase-admin/app');
initializeApp();
const allowedEvents=new Set(['eoy2026']);
const normalize=(id)=>typeof id==='string'?id.trim().toUpperCase():'';
exports.lookupTransport=onCall({region:'us-central1',maxInstances:10,concurrency:20,invoker:'public'},async request=>{
 const id=normalize(request.data?.employeeId),eventId=request.data?.eventId;
 if(!allowedEvents.has(eventId)||! /^[A-Z0-9_-]{2,40}$/.test(id))throw new HttpsError('invalid-argument','Invalid event or Employee ID.');
 // IP-based shared quota, not an identity guarantee; combine with App Check and edge controls for production.
 const ip=(request.rawRequest.headers['x-forwarded-for']||request.rawRequest.ip||'unknown').toString().split(',')[0].trim().replace(/[^a-zA-Z0-9.:_-]/g,'_').slice(0,100);
 const crypto=require('node:crypto');const key=crypto.createHash('sha256').update(ip).digest('hex');
 const db=getDatabase();const bucket=Math.floor(Date.now()/60000);const quotaRef=db.ref(`lookupRateLimits/${key}/${bucket}`);
 const tx=await quotaRef.transaction(v=>v===null?1:(v>=15?undefined:v+1),undefined,false);
 if(!tx.committed)throw new HttpsError('resource-exhausted','Too many lookups. Try again later.');
 // These quota nodes must be periodically removed using a scheduled cleanup job or TTL process.
 const [attendeeSnap,settingsSnap]=await Promise.all([db.ref(`events/${eventId}/attendees/${id}`).get(),db.ref(`events/${eventId}/settings`).get()]);
 if(!attendeeSnap.exists())throw new HttpsError('not-found','No transport assignment found for this ID.');
 const attendee=attendeeSnap.val();const settings=settingsSnap.val()||{};
 if(!attendee.transport?.pickup&&!attendee.transport?.dropoff)throw new HttpsError('not-found','No transport assignment found for this ID.');
 return {employeeId:id,ticketNumber:attendee.ticketNumber||'',transport:attendee.transport,eventName:settings.eventName||'',emergencyPhone:settings.emergencyPhone||'',departureNotice:settings.departureNotice||''};
});
