const {parseImport,prepareImport,isAdmin}=require('./import-data');

function createImportHandler(db,HttpsError,allowedEvents) {
 return async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Sign in as an event administrator.');
  const {eventId,csv,preview,overwriteExisting=true}=request.data||{};
  if(!allowedEvents.has(eventId)||typeof preview!=='boolean'||typeof overwriteExisting!=='boolean')throw new HttpsError('invalid-argument','Invalid event or import mode.');
  const eventRef=db.ref(`events/${eventId}`);
  const staff=await eventRef.child(`staff/${request.auth.uid}`).get();
  if(!isAdmin(staff.val()))throw new HttpsError('permission-denied','Active event administrator access is required.');
  const parsed=parseImport(csv);
  if(parsed.errors.length)return {errors:parsed.errors,rows:[],created:0,updated:0,skipped:0,imported:false};
  if(preview){
   const snapshot=await eventRef.child('attendees').get();
   const result=prepareImport(snapshot.val(),parsed.rows,overwriteExisting);
   return {errors:result.errors,rows:result.preview,created:result.created,updated:result.updated,skipped:result.skipped,imported:false};
  }
  let result, denied=false;
  // Recheck authorization and merge with live attendance in the same transaction.
  const transaction=await eventRef.transaction(event=>{
   result=undefined;denied=false;
   if(!event)return event; // Allow a retry when the SDK initially has no cached value.
   if(!isAdmin(event.staff?.[request.auth.uid])){denied=true;return;}
   result=prepareImport(event.attendees,parsed.rows,overwriteExisting);
   if(result.errors.length)return;
   return {...event,attendees:result.attendees};
  },undefined,false);
  if(denied)throw new HttpsError('permission-denied','Administrator access has been revoked.');
  if(result?.errors.length)return {errors:result.errors,rows:[],created:0,updated:0,skipped:0,imported:false};
  if(!transaction.committed||!result)throw new HttpsError('aborted','Import was not committed. Validate the file again and retry.');
  return {errors:[],rows:[],created:result.created,updated:result.updated,skipped:result.skipped,imported:true};
 };
}
module.exports={createImportHandler};
