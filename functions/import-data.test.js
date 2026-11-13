const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {parseImport,prepareImport,isAdmin}=require('./import-data');
const headers='employeeId,ticketNumber,registrationStatus,pickupPoint';
test('parses Excel BOM, CRLF, quoted commas, escaped quotes and multiline values',()=>{
 const result=parseImport('\uFEFF'+headers+'\r\n001,123,attending,"Point, ""A""\nGate"\r\n');
 assert.deepEqual(result.errors,[]);assert.equal(result.rows[0].employeeId,'001');
 assert.equal(result.rows[0].transport.pickup.point,'Point, "A"\nGate');
});
test('provided CSV files parse into the event attendee schema',()=>{
 for(const file of ['event-attendees-template.csv','event-attendees-existing.csv']) {
  const result=parseImport(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'));
  assert.deepEqual(result.errors,[]);assert.ok(result.rows.length>0);
 }
});
test('rejects missing IDs, invalid statuses, duplicate normalized IDs and ticket numbers',()=>{
 const result=parseImport(headers+'\n,1,attending,\nemp1,2,wrong,\nEMP1,3,attending,\nEMP2,3,attending,');
 assert.ok(result.errors.some(e=>e.includes('Employee ID')));
 assert.ok(result.errors.some(e=>e.includes('registrationStatus')));
 assert.ok(result.errors.some(e=>e.includes('Duplicate Employee ID')));
 assert.ok(result.errors.some(e=>e.includes('Duplicate ticket')));
});
test('rejects malformed quoting, unexpected columns, row widths and empty data',()=>{
 for(const csv of [headers+'\n001,1,attending,"open',headers+',oops\n001,1,attending,a,b',headers+'\n001,1',headers]) {
  assert.ok(parseImport(csv).errors.length>0,csv);
 }
});
test('rejects Firebase path characters and formula-like IDs',()=>{
 for(const id of ['a/b','a.b','a#b','=SUM(1)','@foo']) assert.ok(parseImport(headers+`\n${id},1,attending,`).errors.length);
});
test('updates keep attendance, blank optional fields, unknown fields and other employees',()=>{
 const attendance={status:'present',checkedInAt:123,checkedInBy:'staff'};
 const current={EMP1:{employeeId:'EMP1',registrationStatus:'attending',ticketNumber:'7',attendance,transport:{pickup:{point:'Old',time:'15:00'}}},OTHER:{employeeId:'OTHER'}};
 const rows=parseImport(headers+'\nEMP1,,not_attending,New\nEMP2,8,attending,').rows;
 const result=prepareImport(current,rows);
 assert.deepEqual(result.errors,[]);assert.equal(result.created,1);assert.equal(result.updated,1);
 assert.deepEqual(result.attendees.EMP1.attendance,attendance);
 assert.equal(result.attendees.EMP1.ticketNumber,'7');assert.equal(result.attendees.EMP1.transport.pickup.time,'15:00');
 assert.equal(result.attendees.EMP1.transport.pickup.point,'New');assert.deepEqual(result.attendees.OTHER,current.OTHER);
 assert.deepEqual(result.attendees.EMP2.attendance,{status:'pending'});assert.equal(current.EMP1.transport.pickup.point,'Old');
});
test('rejects ticket collisions with existing employees, permits ticket swaps',()=>{
 const current={EMP1:{employeeId:'EMP1',ticketNumber:'1'},EMP2:{employeeId:'EMP2',ticketNumber:'2'}};
 assert.ok(prepareImport(current,parseImport(headers+'\nEMP3,1,attending,').rows).errors.length);
 assert.deepEqual(prepareImport(current,parseImport(headers+'\nEMP1,2,attending,\nEMP2,1,attending,').rows).errors,[]);
});
test('only active event admins may import',()=>{
 assert.equal(isAdmin({active:true,role:'admin'}),true);
 for(const staff of [null,{}, {active:true,role:'staff'},{active:false,role:'admin'}])assert.equal(isAdmin(staff),false);
});
test('skip mode leaves existing employees untouched and creates new employees',()=>{
 const existing={employeeId:'EMP1',ticketNumber:'1',registrationStatus:'attending',attendance:{status:'present'}};
 const rows=parseImport(headers+'\nEMP1,3,not_attending,Changed\nEMP2,2,attending,').rows;
 const result=prepareImport({EMP1:existing},rows,false);
 assert.deepEqual(result.attendees.EMP1,existing);assert.equal(result.created,1);assert.equal(result.updated,0);assert.equal(result.skipped,1);
 assert.equal(result.preview[0].action,'skip');
});
test('skipped rows do not free their current tickets for new employees',()=>{
 const result=prepareImport({EMP1:{employeeId:'EMP1',ticketNumber:'1'}},parseImport(headers+'\nEMP1,3,attending,\nEMP2,1,attending,').rows,false);
 assert.ok(result.errors.length);
});
