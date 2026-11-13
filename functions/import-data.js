const columns = {
  employeeId: null, ticketNumber: null, registrationStatus: null,
  pickupRoute: ['pickup','route'], pickupPoint: ['pickup','point'], pickupTime: ['pickup','time'],
  pickupVehicle: ['pickup','vehicle'], pickupDriverName: ['pickup','driverName'],
  pickupDriverPhone: ['pickup','driverPhone'], pickupCoordinator: ['pickup','coordinator'],
  dropoffRoute: ['dropoff','route'], dropoffRegion: ['dropoff','region'],
  dropoffVehicle: ['dropoff','vehicle'], dropoffDriverName: ['dropoff','driverName'],
  dropoffDriverPhone: ['dropoff','driverPhone'], dropoffCoordinator: ['dropoff','coordinator']
};
const MAX_ROWS = 500;
const MAX_BYTES = 1024 * 1024;
const isAdmin = staff => staff?.active === true && staff?.role === 'admin';

// RFC 4180 quoting, including embedded newlines and escaped double quotes.
function readCsv(text) {
  const records=[]; let row=[], field='', quoted=false, closed=false;
  const endField=()=>{row.push(field);field='';closed=false;};
  const endRow=()=>{endField();if(row.some(value=>value.trim()))records.push(row);row=[];};
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(quoted) {
      if(ch==='"') {if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}
      else field+=ch;
    } else if(ch===',') endField();
    else if(ch==='\r'||ch==='\n') {endRow();if(ch==='\r'&&text[i+1]==='\n')i++;}
    else if(ch==='"'&&!field&&!closed) quoted=true;
    else {if(closed||ch==='"')throw new Error('Invalid CSV quoting. Save as CSV UTF-8 (comma delimited).');field+=ch;}
  }
  if(quoted)throw new Error('Unclosed quoted CSV field.');
  if(field||closed||row.length)endRow();
  return records;
}
function parseImport(csv) {
  const errors=[], rows=[];
  if(typeof csv!=='string'||Buffer.byteLength(csv,'utf8')>MAX_BYTES)return {rows,errors:['CSV must be UTF-8 text no larger than 1 MB.']};
  if(csv.includes('\u0000')||csv.includes('\uFFFD'))return {rows,errors:['Invalid text encoding. Save as CSV UTF-8 (comma delimited).']};
  let records;
  try {records=readCsv(csv.replace(/^\uFEFF/,''));}catch(error){return {rows,errors:[error.message]};}
  const headers=(records.shift()||[]).map(h=>h.trim());
  for(const required of ['employeeId','registrationStatus'])if(!headers.includes(required))errors.push(`Missing required column: ${required}.`);
  if(new Set(headers).size!==headers.length)errors.push('Duplicate column headers.');
  for(const header of headers)if(!Object.hasOwn(columns,header))errors.push(`Unknown column: ${header || '(blank)'}. Use the CSV template.`);
  if(!records.length)errors.push('CSV contains no employee rows.');
  if(records.length>MAX_ROWS)errors.push(`Import at most ${MAX_ROWS} employees per file.`);
  if(errors.length)return {rows,errors};
  const ids=new Set(), tickets=new Set();
  records.forEach((cells,index)=>{
    const prefix=`Row ${index+2}: `;
    if(cells.length!==headers.length){errors.push(prefix+'Column count does not match the header.');return;}
    const values=Object.fromEntries(headers.map((h,i)=>[h,cells[i].trim()]));
    const employeeId=values.employeeId.toUpperCase();
    if(!/^[A-Z0-9_-]{2,40}$/.test(employeeId))errors.push(prefix+'Employee ID must be 2–40 letters, digits, underscores or hyphens.');
    if(ids.has(employeeId))errors.push(prefix+`Duplicate Employee ID: ${employeeId}.`);ids.add(employeeId);
    if(!['attending','not_attending'].includes(values.registrationStatus))errors.push(prefix+'registrationStatus must be attending or not_attending.');
    if(values.ticketNumber){
      if(!/^[A-Za-z0-9_-]{1,40}$/.test(values.ticketNumber))errors.push(prefix+'Ticket must be 1–40 letters, digits, underscores or hyphens.');
      const ticket=values.ticketNumber.toUpperCase();
      if(tickets.has(ticket))errors.push(prefix+`Duplicate ticket: ${values.ticketNumber}.`);tickets.add(ticket);
    }
    for(const [key,value] of Object.entries(values))if(value.length>500)errors.push(prefix+`${key} exceeds 500 characters.`);
    if(values.pickupTime&&!/^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(values.pickupTime))errors.push(prefix+'pickupTime must use HH:mm or HH:mm:ss (24-hour time).');
    const attendee={employeeId,registrationStatus:values.registrationStatus};
    if(values.ticketNumber)attendee.ticketNumber=values.ticketNumber;
    for(const [header,path] of Object.entries(columns))if(path&&values[header]){
      attendee.transport??={};attendee.transport[path[0]]??={};attendee.transport[path[0]][path[1]]=values[header];
    }
    rows.push(attendee);
  });
  return {rows,errors};
}
function prepareImport(current,rows,overwriteExisting=true) {
  const attendees={...(current||{})}, errors=[], preview=[];
  let created=0,updated=0,skipped=0;
  for(const row of rows){
    const existing=attendees[row.employeeId];
    if(existing&&!overwriteExisting){skipped++;preview.push({...existing,action:'skip'});continue;}
    const next={...existing,...row,attendance:existing?.attendance||{status:'pending'}};
    if(existing?.transport||row.transport){
      next.transport={...existing?.transport};
      for(const leg of ['pickup','dropoff'])if(row.transport?.[leg])next.transport[leg]={...existing?.transport?.[leg],...row.transport[leg]};
    }
    attendees[row.employeeId]=next;
    if(existing)updated++;else created++;
    preview.push({...next,action:existing?'update':'create'});
  }
  // Check the final state so legitimate ticket swaps in one import are allowed.
  const imported=new Set(preview.filter(row=>row.action!=='skip').map(row=>row.employeeId)),tickets=new Map();
  for(const [id,attendee] of Object.entries(attendees)) {
    const ticket=attendee.ticketNumber?.trim().toUpperCase();if(!ticket)continue;
    const owner=tickets.get(ticket);
    if(owner&&(imported.has(id)||imported.has(owner)))errors.push(`Ticket ${ticket} is assigned to both ${owner} and ${id}.`);
    tickets.set(ticket,id);
  }
  return {attendees,preview,errors,created,updated,skipped};
}
module.exports={parseImport,prepareImport,isAdmin,MAX_BYTES,MAX_ROWS};
