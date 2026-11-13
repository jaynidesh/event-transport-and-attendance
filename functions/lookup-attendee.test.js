const {test}=require('node:test');
const assert=require('node:assert/strict');
const {findAttendee}=require('./lookup-attendee');
function source(records){const reads=[];return {reads,read:async id=>{reads.push(id);return records[id]||null;}};}
test('numeric shorthand resolves EMP ID and preserves leading zeros',async()=>{
 const s=source({EMP001:{employeeId:'EMP001'}});
 assert.deepEqual(await findAttendee('001',s.read),{id:'EMP001',attendee:{employeeId:'EMP001'}});
 assert.deepEqual(s.reads,['001','EMP001']);
});
test('exact numeric IDs take priority over prefixed IDs',async()=>{
 const s=source({'001':{employeeId:'001'},EMP001:{employeeId:'EMP001'}});
 assert.equal((await findAttendee('001',s.read)).id,'001');assert.deepEqual(s.reads,['001']);
});
test('full IDs remain exact and nonexistent shorthand returns null',async()=>{
 const s=source({EMP001:{employeeId:'EMP001'}});
 assert.equal((await findAttendee('EMP001',s.read)).id,'EMP001');
 assert.equal(await findAttendee('002',s.read),null);
 assert.equal(await findAttendee('ABC001',s.read),null);
 assert.ok(!s.reads.includes('EMPABC001'));
});
