export const RESPONSES = ['best','available','check','unavailable'] as const;
export type Choice = typeof RESPONSES[number];
export const LABELS: Record<Choice,string> = {best:'Best',available:'Available',check:'Need to check',unavailable:'Unavailable'};
export type Member = {id:string;name:string};
export type Slot = {id:string;start:string;date:string;time:string;createdBy:string;votes:Record<string,Choice>};
export type Poll = {id:string;month:string;timezone:string;deadline:string;title?:string;notes?:string;status:'draft'|'open'|'selected'|'sent';slots:Slot[];selectedId:string|null;createdAt:string;calendarUpdateNeeded:boolean};
export type PollDetailsPatch = {title?:string;deadline?:string;notes?:string};
export type Circle = {title:string;timezone:string;members:Member[];organiserId:string;polls:Poll[]};
export type Snapshot = {id:string;revision:number;role:'admin'|'participant';circle:Circle};
export function pollTitle(p:Poll,c:Circle){return p.title??c.title;}
export class Problem extends Error { status:number; constructor(message:string,status=400){super(message);this.status=status;} }
export function insist(value:unknown,message:string,status=400):asserts value {if(!value)throw new Problem(message,status);}
export function validZone(value:unknown):string {
 insist(typeof value==='string'&&value.length<80,'Enter a valid time zone, for example Europe/London.');
 try{new Intl.DateTimeFormat('en',{timeZone:value}).format();}catch{throw new Problem('Enter a valid IANA time zone, for example Europe/London.');}return value;
}
export function localParts(iso:string,zone:string) {
 const parts = new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso));
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return {date:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute};
}
export function toUTC(date:string,time:string,zone:string) {
 insist(/^\d{4}-\d{2}-\d{2}$/.test(date)&&/^\d{2}:\d{2}$/.test(time),'Choose a valid date and time.');
 const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number);
 const nominal=Date.UTC(y,m-1,d,h,min);insist(new Date(nominal).toISOString().slice(0,16)===date+'T'+time,'Choose a valid date and time.');
 let instant=nominal;
 for(let i=0;i<4;i++){const p=localParts(new Date(instant).toISOString(),zone);const represented=Date.parse(p.date+'T'+p.time+':00Z');instant+=nominal-represented;}
 const iso=new Date(instant).toISOString(),p=localParts(iso,zone);insist(p.date===date&&p.time===time,'This local time does not exist in this time zone.');return iso;
}
export function checkSlot(date:unknown,time:unknown,month:string,zone:string,now=Date.now()) {
 insist(typeof date==='string'&&typeof time==='string','Choose a date and start time.');
 const start=toUTC(date,time,zone);insist(date.slice(0,7)===month,'The time must be in the selected month.');
 const day=new Date(date+'T12:00:00Z').getUTCDay();insist(day>=1&&day<=5,'Choose a weekday, Monday to Friday.');
 const [h,m]=time.split(':').map(Number);insist(m%15===0&&h*60+m>=540&&h*60+m<=975,'Choose a 15-minute start between 09:00 and 16:15.');
 insist(Date.parse(start)>now,'Choose a time in the future.');return {date,time,start};
}
export function cleanSetup(input:any) {
 insist(input&&typeof input==='object','Enter your group details.');
 const title=String(input.title??'').trim();insist(title.length>0&&title.length<=100,'Meeting name must be 1–100 characters.');
 insist(Array.isArray(input.names)&&input.names.length===5,'Enter exactly five names.');
 const names=input.names.map((x:unknown)=>typeof x==='string'?x.trim():'');
 insist(names.every((x:string)=>x.length>0&&x.length<=60),'Each name must be 1–60 characters.');
 insist(new Set(names.map((x:string)=>x.toLowerCase())).size===5,'Use five different names so everyone can find their own row.');
 return {title,names,timezone:validZone(input.timezone)};
}
export function summary(slot:Slot,c:Circle) {
 const best:Member[]=[],available:Member[]=[],check:Member[]=[],unavailable:Member[]=[],missing:Member[]=[];
 for(const m of c.members){const v=slot.votes[m.id];if(v==='best')best.push(m);else if(v==='available')available.push(m);else if(v==='check')check.push(m);else if(v==='unavailable')unavailable.push(m);else missing.push(m);}
 const confirmed=best.length+available.length;
 return {best,available,check,unavailable,missing,confirmed,allConfirmed:confirmed===5,organiserReady:['best','available'].includes(slot.votes[c.organiserId])};
}
export function ranked(p:Poll,c:Circle) {
 const rank=(s:Slot)=>{const a=summary(s,c);return a.allConfirmed?0:a.unavailable.length?2:1;};
 return [...p.slots].sort((a,b)=>{const x=summary(a,c),y=summary(b,c);return rank(a)-rank(b)||y.confirmed-x.confirmed||y.best.length-x.best.length||x.unavailable.length-y.unavailable.length||a.start.localeCompare(b.start);});
}
export function applyOperation(c:Circle,op:any,role:'admin'|'participant',revision:number,now=Date.now()):Circle {
 insist(op&&typeof op==='object'&&typeof op.type==='string','Invalid action.');
 const admin=()=>insist(role==='admin','This action needs the management link.',403);
 if(op.type==='settings'){admin();const x=cleanSetup(op);c.title=x.title;c.timezone=x.timezone;c.members=c.members.map((m,i)=>({...m,name:x.names[i]}));return c;}
 if(op.type==='createPoll'){
  admin();insist(typeof op.month==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(op.month),'Choose a meeting month.');
  insist(!c.polls.some(p=>p.month===op.month),'There is already a poll for this month.',409);
  insist(typeof op.deadline==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(op.deadline),'Set a reply deadline.');
  const [date,time]=op.deadline.split('T'),deadline=toUTC(date,time,c.timezone);insist(Date.parse(deadline)>now,'Set a future reply deadline.');
  c.polls.push({id:crypto.randomUUID(),month:op.month,timezone:c.timezone,deadline,title:c.title,notes:'',status:'draft',slots:[],selectedId:null,createdAt:new Date(now).toISOString(),calendarUpdateNeeded:false});return c;
 }
 const p=c.polls.find(p=>p.id===op.pollId);insist(p,'This poll no longer exists.',404);
 if(op.type==='deleteDraft'){
  admin();insist(p.status==='draft','Only an unpublished draft can be deleted.',409);
  c.polls=c.polls.filter(item=>item.id!==p.id);return c;
 }
 if(op.type==='updatePollDetails'){
  admin();insist(p.status==='open'||p.status==='draft','Reopen the poll before editing its details.',409);
  const changes=op.changes;insist(changes&&typeof changes==='object'&&!Array.isArray(changes),'Enter the meeting details.');
  const keys=Object.keys(changes);insist(keys.length>0&&keys.every(key=>['title','deadline','notes'].includes(key)),'Only the title, reply deadline and notes can be edited here.');
  const patch:PollDetailsPatch={};
  if('title' in changes){insist(typeof changes.title==='string'&&changes.title.trim().length>0&&changes.title.trim().length<=100,'Meeting name must be 1–100 characters.');patch.title=changes.title.trim();}
  if('notes' in changes){insist(typeof changes.notes==='string'&&changes.notes.length<=2000,'Notes must be at most 2,000 characters.');patch.notes=changes.notes.trim();}
  if('deadline' in changes){insist(typeof changes.deadline==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(changes.deadline),'Set a reply deadline.');const [date,time]=changes.deadline.split('T');patch.deadline=toUTC(date,time,p.timezone);insist(Date.parse(patch.deadline)>now,'Set a future reply deadline.');}
  Object.assign(p,patch);return c;
 }
 if(op.type==='publish'){admin();insist(p.status==='draft','Only a draft can be opened.');insist(p.slots.length>0,'Add at least one candidate time.');insist(p.slots.every(s=>Date.parse(s.start)>now),'Remove past times before opening the poll.');p.status='open';return c;}
 if(op.type==='deadline'){admin();insist(p.status==='open'||p.status==='draft','Reopen the poll before changing its deadline.');insist(typeof op.deadline==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(op.deadline),'Set a reply deadline.');const [d,t]=op.deadline.split('T');p.deadline=toUTC(d,t,p.timezone);insist(Date.parse(p.deadline)>now,'Set a future reply deadline.');return c;}
 if(op.type==='reopen'){admin();insist(p.status==='selected'||p.status==='sent','This poll is already editable.');p.calendarUpdateNeeded=p.calendarUpdateNeeded||p.status==='sent';p.selectedId=null;p.status='open';return c;}
 if(op.type==='sent'){admin();insist(p.status==='selected','Select a meeting time first.');p.status='sent';p.calendarUpdateNeeded=false;return c;}
 if(op.type==='finalize'){
  admin();insist(p.status==='open','Reopen the poll to select a time.');
  insist(op.expectedRevision===revision,'Replies changed. Review the latest results before choosing again.',409);
  const s=p.slots.find(s=>s.id===op.slotId);insist(s,'This candidate no longer exists.',404);insist(Date.parse(s.start)>now,'This candidate is in the past.');
  const a=summary(s,c);insist(a.organiserReady,'The organiser must mark this time Best or Available before choosing it.');
  insist(a.allConfirmed||op.acceptIncomplete===true,'Confirm that you accept the listed absences and unconfirmed replies.');
  p.selectedId=s.id;p.status='selected';return c;
 }
 insist(p.status==='open'||(p.status==='draft'&&role==='admin'),'This poll is locked. Ask the organiser to reopen it.',409);
 if(op.type==='removeSlot'){admin();const s=p.slots.find(s=>s.id===op.slotId);insist(s,'This candidate no longer exists.',404);p.slots=p.slots.filter(s=>s.id!==op.slotId);return c;}
 if(op.type==='addSlots'){
  insist(Array.isArray(op.slots)&&op.slots.length>0&&op.slots.length<=40,'Add between 1 and 40 times at once.');
  insist(p.slots.length+op.slots.length<=120,'This poll has too many candidate times. Remove unused ones first.');
  const member=c.members.find(m=>m.id===op.memberId);insist(role==='admin'||member,'Choose your name before suggesting a time.');
  for(const x of op.slots){
   const s=checkSlot(x.date,x.time,p.month,p.timezone,now);
   if(p.slots.some(slot=>slot.start===s.start))continue;
   p.slots.push({...s,id:crypto.randomUUID(),createdBy:member?.id??c.organiserId,votes:{}});
  }p.slots.sort((a,b)=>a.start.localeCompare(b.start));return c;
 }
 if(op.type==='votes'){
  insist(c.members.some(m=>m.id===op.memberId),'Choose a member of this circle.');
  insist(Array.isArray(op.changes)&&op.changes.length>0&&op.changes.length<=120,'Choose at least one response to save.');
  for(const change of op.changes){
   const s=p.slots.find(s=>s.id===change.slotId);insist(s,'A candidate was removed. Refresh the page; your other input is preserved.',409);
   const current=s.votes[op.memberId]??null;
   insist(current===(change.before??null)||current===change.value,'This person’s reply changed on another device. Refresh before replacing it.',409);
   insist(change.value===null||RESPONSES.includes(change.value),'Choose one of the four response options.');
  }
  for(const change of op.changes){const s=p.slots.find(s=>s.id===change.slotId)!;if(change.value===null)delete s.votes[op.memberId];else s.votes[op.memberId]=change.value;}
  return c;
 }
 throw new Problem('Unknown action.');
}
export function formatSlot(s:Slot,zone:string) {const date=new Intl.DateTimeFormat('en-GB',{timeZone:zone,weekday:'short',day:'numeric',month:'short'}).format(new Date(s.start));const time=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});return date+' · '+time.format(new Date(s.start))+'–'+time.format(new Date(Date.parse(s.start)+45*60000));}
export function monthLabel(month:string){return new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));}

