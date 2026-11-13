const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const Module=require('node:module');
const path=require('node:path');
const filename=path.resolve('src/app/services/attendee-csv.ts');
const loaded=new Module(filename,module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
const {attendeeCsv}=loaded.exports;
test('exports all eligible attendees beyond dashboard limit, with UTC timestamps',()=>{
 const rows=Array.from({length:151},(_,i)=>({employeeId:String(i),registrationStatus:'attending',attendance:{status:'present',checkedInAt:1700000000000}}));
 rows.push({employeeId:'EXCLUDED',registrationStatus:'not_attending'});
 const csv=attendeeCsv(rows);
 assert.ok(csv.startsWith('\uFEFF'));assert.equal(csv.split('\r\n').length,153);
 assert.ok(csv.includes('2023-11-14T22:13:20.000Z'));assert.ok(!csv.includes('EXCLUDED'));
});
test('escapes CSV fields, neutralizes formulas and defaults missing attendance',()=>{
 const csv=attendeeCsv([{employeeId:'=1+1',ticketNumber:'a,"b"\nc',registrationStatus:'attending'}]);
 assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"a,""b""\nc"'));assert.ok(csv.includes('"pending"'));
});
