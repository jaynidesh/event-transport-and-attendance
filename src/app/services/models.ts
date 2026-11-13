export type AttendanceStatus='pending'|'present'|'absent';
export interface TransportLeg {route?:string; point?:string; time?:string; region?:string; vehicle?:string; driverName?:string; driverPhone?:string; coordinator?:string;}
export interface Attendee {employeeId:string; ticketNumber?:string; registrationStatus:'attending'|'not_attending'; attendance:{status:AttendanceStatus;checkedInAt?:number|null;checkedInBy?:string|null};transport?:{pickup?:TransportLeg;dropoff?:TransportLeg};}
export interface LookupResult {employeeId:string;ticketNumber?:string;transport?:Attendee['transport'];eventName?:string;emergencyPhone?:string;departureNotice?:string;}
