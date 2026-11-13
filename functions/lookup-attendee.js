// The caller normalizes and validates IDs before issuing bounded key lookups.
async function findAttendee(id,read) {
 const exact=await read(id);
 if(exact!==null)return {id,attendee:exact};
 if(/^\d+$/.test(id)&&id.length<=37){
  const prefixedId=`EMP${id}`;
  const attendee=await read(prefixedId);
  if(attendee!==null)return {id:prefixedId,attendee};
 }
 return null;
}
module.exports={findAttendee};
