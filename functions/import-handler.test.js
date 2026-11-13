const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createImportHandler}=require('./import-handler');
class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
const csv='employeeId,ticketNumber,registrationStatus\nEMP1,1,attending\nEMP2,2,attending';
function fixture(role='admin') {
 let event={staff:{user:{active:true,role}},attendees:{EMP1:{employeeId:'EMP1',registrationStatus:'attending',attendance:{status:'pending'}}},settings:{eventName:'Event'}};
 let beforeCommit=()=>{};
 const db={ref:()=>({
  child:path=>({get:async()=>({val:()=>structuredClone(path==='attendees'?event.attendees:event.staff.user)})}),
  transaction:async update=>{
   beforeCommit(event);
   const result=update(structuredClone(event));
   if(result===undefined)return {committed:false};
   event=result;return {committed:true};
  }
 })};
 return {handler:createImportHandler(db,HttpsError,new Set(['eoy2026'])),get event(){return event;},before(fn){beforeCommit=fn;}};
}
const request=(preview=true)=>({auth:{uid:'user'},data:{eventId:'eoy2026',csv,preview}});
test('anonymous and non-admin requests are rejected before writes',async()=>{
 await assert.rejects(fixture().handler({...request(),auth:null}),{code:'unauthenticated'});
 await assert.rejects(fixture('staff').handler(request(false)),{code:'permission-denied'});
});
test('preview reports creates and updates without writing',async()=>{
 const f=fixture(), before=structuredClone(f.event);
 const result=await f.handler(request());
 assert.equal(result.created,1);assert.equal(result.updated,1);assert.equal(result.imported,false);assert.deepEqual(f.event,before);
});
test('commit preserves attendance changed after preview and all event settings',async()=>{
 const f=fixture();await f.handler(request());
 f.before(event=>{event.attendees.EMP1.attendance={status:'present',checkedInAt:100,checkedInBy:'staff'};});
 const result=await f.handler(request(false));
 assert.equal(result.imported,true);assert.equal(f.event.attendees.EMP1.attendance.status,'present');
 assert.deepEqual(f.event.attendees.EMP2.attendance,{status:'pending'});assert.equal(f.event.settings.eventName,'Event');
});
test('revoked admin permission blocks commit',async()=>{
 const f=fixture();f.before(event=>{event.staff.user.active=false;});
 await assert.rejects(f.handler(request(false)),{code:'permission-denied'});
 assert.equal(f.event.attendees.EMP2,undefined);
});
test('new ticket collisions at commit block the whole file',async()=>{
 const f=fixture();await f.handler(request());
 f.before(event=>{event.attendees.OTHER={employeeId:'OTHER',ticketNumber:'2'};});
 const result=await f.handler(request(false));
 assert.equal(result.imported,false);assert.ok(result.errors.length);assert.equal(f.event.attendees.EMP2,undefined);
 assert.equal(f.event.attendees.EMP1.ticketNumber,undefined);
});
test('invalid CSV cannot bypass preview by calling commit directly',async()=>{
 const f=fixture(),before=structuredClone(f.event),req=request(false);req.data.csv+='\nEMP1,3,attending';
 const result=await f.handler(req);assert.ok(result.errors.length);assert.deepEqual(f.event,before);
});
test('skip mode is applied to preview and commit, including employees added after preview',async()=>{
 const f=fixture(),req=request();req.data.overwriteExisting=false;
 const preview=await f.handler(req);assert.equal(preview.skipped,1);assert.equal(preview.updated,0);assert.equal(preview.created,1);
 f.before(event=>{event.attendees.EMP2={employeeId:'EMP2',ticketNumber:'9',attendance:{status:'present'}};});
 req.data.preview=false;const result=await f.handler(req);
 assert.equal(result.skipped,2);assert.equal(result.created,0);assert.equal(f.event.attendees.EMP2.ticketNumber,'9');
 assert.equal(f.event.attendees.EMP1.ticketNumber,undefined);
});
test('nonboolean overwrite option is rejected',async()=>{
 const req=request(false);req.data.overwriteExisting='false';
 await assert.rejects(fixture().handler(req),{code:'invalid-argument'});
});
