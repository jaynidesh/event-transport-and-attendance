import { PullRefresh } from './dashboard/pull-refresh';
import { attendeeCsv } from '../services/attendee-csv';
import { get,ref } from 'firebase/database';import { database } from '../services/firebase';import { environment } from '../../environments/environment';
import { Component,ElementRef,OnDestroy,OnInit } from '@angular/core';import { CommonModule } from '@angular/common';import { FormsModule } from '@angular/forms';import { Router,RouterLink } from '@angular/router';import { signOut } from 'firebase/auth';import { auth } from '../services/firebase';import { EventService } from '../services/event.service';import { Attendee,AttendanceStatus } from '../services/models';
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink],styleUrl:'./dashboard.page.css',templateUrl:'./dashboard.page.html'})
export class DashboardPage implements OnInit,OnDestroy {settingsOpen=false;refreshing=false;refreshMessage='';readonly pull=new PullRefresh();private destroyed=false;private revision=0;private previousOverscroll='';isAdmin=false;attendees:Attendee[]=[];query='';error='';message='';loading=true;busyId='';private unsubscribe?:()=>void;constructor(private events:EventService,private router:Router,private host:ElementRef<HTMLElement>){}ngOnInit(){this.setupPullRefresh();const uid=auth.currentUser?.uid;if(uid){void get(ref(database,`events/${environment.eventId}/staff/${uid}`)).then(snapshot=>{this.isAdmin=snapshot.val()?.active===true&&snapshot.val()?.role==='admin';}).catch(()=>{this.isAdmin=false;});}this.unsubscribe=this.events.subscribeAttendees(rows=>{this.revision++;this.attendees=rows;this.loading=false;},error=>{this.error=error;this.loading=false;});}ngOnDestroy(){this.destroyed=true;this.unsubscribe?.();
 const el=this.host.nativeElement;
 el.removeEventListener('touchstart',this.touchStart);el.removeEventListener('touchmove',this.touchMove);
 el.removeEventListener('touchend',this.touchEnd);el.removeEventListener('touchcancel',this.touchCancel);
 document.documentElement.style.overscrollBehaviorY=this.previousOverscroll;
}private setupPullRefresh(){
 const el=this.host.nativeElement;
 this.previousOverscroll=document.documentElement.style.overscrollBehaviorY;
 document.documentElement.style.overscrollBehaviorY='none';
 el.addEventListener('touchstart',this.touchStart,{passive:true});
 el.addEventListener('touchmove',this.touchMove,{passive:false});
 el.addEventListener('touchend',this.touchEnd,{passive:true});
 el.addEventListener('touchcancel',this.touchCancel,{passive:true});
}
private touchStart=(event:TouchEvent)=>{
 const touch=event.touches[0];
 const interactive=event.target instanceof Element && !!event.target.closest('button,a,input,select,textarea,summary,.table-scroll');
 if(!touch)return;
 this.pull.start(touch.clientX,touch.clientY,event.touches.length===1 && window.scrollY<=0 && !interactive && !this.loading && !this.refreshing && !this.busyId);
};
private touchMove=(event:TouchEvent)=>{
 if(event.touches.length!==1 || window.scrollY>0){this.pull.cancel();return;}
 const touch=event.touches[0];
 if(this.pull.move(touch.clientX,touch.clientY) && event.cancelable)event.preventDefault();
};
private touchEnd=()=>{if(this.pull.release())void this.refresh();};
private touchCancel=()=>{this.pull.cancel();};
async refresh(){
 if(this.loading || this.refreshing)return;
 this.refreshing=true;this.refreshMessage='';this.error='';
 const revision=this.revision;
 let timer:ReturnType<typeof setTimeout>|undefined;
 try {
  const rows=await Promise.race([
   this.events.refreshAttendees(),
   new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Refresh timed out. Check your connection and try again.')),15000);})
  ]);
  if(this.destroyed)return;
  if(this.revision===revision)this.attendees=rows;
  this.refreshMessage='Attendance list refreshed.';
 }catch(error){if(!this.destroyed)this.error=error instanceof Error?error.message:'Unable to refresh attendees.';}
 finally{if(timer)clearTimeout(timer);if(!this.destroyed)this.refreshing=false;}
}
get eligible(){return this.attendees.filter(a=>a.registrationStatus==='attending');}count(status:AttendanceStatus){return this.eligible.filter(a=>(a.attendance?.status||'pending')===status).length;}get filtered(){const q=this.query.trim().toLowerCase();return this.eligible.filter(a=>!q||a.employeeId.toLowerCase().includes(q)||(a.ticketNumber||'').toLowerCase().includes(q)).slice(0,150);}async update(a:Attendee,status:AttendanceStatus){if(a.attendance?.status===status)return;if(a.attendance?.status==='present'&&status!=='present'&&!confirm(`Change ${a.employeeId} from present to ${status}?`))return;this.busyId=a.employeeId;this.error='';this.message='';try{const result=await this.events.changeAttendance(a.employeeId,status);this.message=result==='updated'?`${a.employeeId} marked ${status}.`:`${a.employeeId} already has that status.`;}catch(e:any){this.error=e?.message||'Update failed';}finally{this.busyId='';}}exportCsv(){
 if(this.loading || !this.eligible.length)return;
 this.error='';
 try {
  const blob=new Blob([attendeeCsv(this.attendees)],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download=`${environment.eventId}-attendees-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link);
  try {link.click();} finally {link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 }catch {this.error='Unable to export attendees. Please try again.';}
}async logout(){await signOut(auth);await this.router.navigateByUrl('/staff/login');}}
