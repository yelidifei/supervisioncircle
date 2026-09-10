import test from 'node:test';
import assert from 'node:assert/strict';
import {toUTC,checkSlot,cleanSetup,applyOperation,summary,ranked,pollTitle,type Circle,type Poll,type Choice} from '../lib/domain.ts';
const now=Date.parse('2026-09-06T10:00:00Z');
function fixture(){const c:Circle={title:'Monthly supervision meeting',timezone:'Europe/London',organiserId:'p0',members:['You','Minhao','Alex','Taylor','Jordan'].map((name,i)=>({id:'p'+i,name})),polls:[]};applyOperation(c,{type:'createPoll',month:'2026-10',deadline:'2026-09-25T17:00'},'admin',0,now);const p=c.polls[0];applyOperation(c,{type:'addSlots',pollId:p.id,slots:[{date:'2026-10-20',time:'16:00'},{date:'2026-10-21',time:'10:00'}]},'admin',0,now);applyOperation(c,{type:'publish',pollId:p.id},'admin',0,now);return {c,p};}
test('London daylight saving is interpreted by the meeting date',()=>{assert.equal(toUTC('2026-10-23','16:00','Europe/London'),'2026-10-23T15:00:00.000Z');assert.equal(toUTC('2026-10-27','16:00','Europe/London'),'2026-10-27T16:00:00.000Z');});
test('rejects impossible dates, weekends, wrong months and meetings ending after 17:00',()=>{for(const [date,time] of [['2026-10-32','10:00'],['2026-10-24','10:00'],['2026-11-02','10:00'],['2026-10-20','16:30'],['2026-10-20','09:10']])assert.throws(()=>checkSlot(date,time,'2026-10','Europe/London',now));assert.ok(checkSlot('2026-10-20','16:15','2026-10','Europe/London',now));});
test('requires five distinct nonempty member names',()=>{assert.throws(()=>cleanSetup({title:'Meeting',timezone:'Europe/London',names:['A','a','B','C','D']}));assert.throws(()=>cleanSetup({title:'Meeting',timezone:'Invalid/Zone',names:['A','B','C','D','E']}));});
test('no response and need to check never become confirmed',()=>{const {c,p}=fixture();p.slots[0].votes={p0:'available',p1:'check'};const s=summary(p.slots[0],c);assert.equal(s.confirmed,1);assert.equal(s.check.length,1);assert.equal(s.missing.length,3);assert.equal(s.allConfirmed,false);});
test('ranking puts five clear yeses first, then number of best votes, then time',()=>{const {c,p}=fixture();for(const s of p.slots)for(const m of c.members)s.votes[m.id]='available';p.slots[1].votes.p1='best';assert.equal(ranked(p,c)[0].id,p.slots[1].id);p.slots[1].votes.p1='available';assert.equal(ranked(p,c)[0].id,p.slots[0].id);p.slots[0].votes.p1='check';assert.equal(ranked(p,c)[0].id,p.slots[1].id);});
test('new candidates preserve all replies and duplicates are not added',()=>{const {c,p}=fixture();p.slots[0].votes.p0='best';applyOperation(c,{type:'addSlots',pollId:p.id,memberId:'p1',slots:[{date:'2026-10-20',time:'16:00'},{date:'2026-10-22',time:'11:00'}]},'participant',0,now);assert.equal(p.slots.length,3);assert.equal(p.slots[0].votes.p0,'best');assert.deepEqual(p.slots[2].votes,{});});
test('participant can vote but cannot create, remove, finalise or change settings',()=>{const {c,p}=fixture();for(const type of ['removeSlot','finalize','settings','createPoll'])assert.throws(()=>applyOperation(c,{type,pollId:p.id,slotId:p.slots[0].id},'participant',0,now),/management link/);});
test('one member update never overwrites another member',()=>{const {c,p}=fixture();const s=p.slots[0];applyOperation(c,{type:'votes',pollId:p.id,memberId:'p0',changes:[{slotId:s.id,value:'best',before:null}]},'participant',0,now);applyOperation(c,{type:'votes',pollId:p.id,memberId:'p1',changes:[{slotId:s.id,value:'check',before:null}]},'participant',0,now);assert.deepEqual(s.votes,{p0:'best',p1:'check'});});
test('conflicting edits of the same person are detected without partial updates',()=>{const {c,p}=fixture();p.slots[1].votes.p0='available';assert.throws(()=>applyOperation(c,{type:'votes',pollId:p.id,memberId:'p0',changes:[{slotId:p.slots[0].id,value:'best',before:null},{slotId:p.slots[1].id,value:'check',before:null}]},'participant',0,now),/another device/);assert.deepEqual(p.slots[0].votes,{});});
test('past deadline still accepts explicit replies',()=>{const {c,p}=fixture();assert.doesNotThrow(()=>applyOperation(c,{type:'votes',pollId:p.id,memberId:'p0',changes:[{slotId:p.slots[0].id,value:'available',before:null}]},'participant',0,Date.parse('2026-10-01T12:00:00Z')));});
test('finalisation requires organiser availability, current revision and explicit incomplete acceptance',()=>{const {c,p}=fixture(),op={type:'finalize',pollId:p.id,slotId:p.slots[0].id,expectedRevision:1};assert.throws(()=>applyOperation(c,op,'admin',1,now),/organiser/);p.slots[0].votes.p0='available';assert.throws(()=>applyOperation(c,op,'admin',2,now),/Replies changed/);assert.throws(()=>applyOperation(c,op,'admin',1,now),/Confirm/);applyOperation(c,{...op,acceptIncomplete:true},'admin',1,now);assert.equal(p.status,'selected');});
test('selected time, invitation sent and reopened remain distinct',()=>{const {c,p}=fixture();for(const m of c.members)p.slots[0].votes[m.id]='available';applyOperation(c,{type:'finalize',pollId:p.id,slotId:p.slots[0].id,expectedRevision:0},'admin',0,now);assert.equal(p.status,'selected');assert.throws(()=>applyOperation(c,{type:'votes',pollId:p.id,memberId:'p0',changes:[{slotId:p.slots[0].id,before:'available',value:'unavailable'}]},'participant',0,now),/locked/);applyOperation(c,{type:'sent',pollId:p.id},'admin',0,now);assert.equal(p.status,'sent');applyOperation(c,{type:'reopen',pollId:p.id},'admin',0,now);assert.equal(p.status,'open');assert.equal(p.calendarUpdateNeeded,true);assert.equal(p.slots[0].votes.p0,'available');});
test('new month has no old responses, and old month keeps its original time zone',()=>{const {c,p}=fixture();p.slots[0].votes.p0='best';applyOperation(c,{type:'settings',title:c.title,timezone:'Asia/Shanghai',names:c.members.map(m=>m.name)},'admin',0,now);applyOperation(c,{type:'createPoll',month:'2026-11',deadline:'2026-10-20T17:00'},'admin',0,now);assert.equal(c.polls[1].timezone,'Asia/Shanghai');assert.deepEqual(c.polls[1].slots,[]);assert.equal(p.timezone,'Europe/London');assert.equal(p.slots[0].votes.p0,'best');});

test('published details preserve members, slots, votes, state and other months',()=>{
 const {c,p}=fixture();p.slots[0].votes={p0:'best',p1:'check'};
 applyOperation(c,{type:'createPoll',month:'2026-11',deadline:'2026-10-20T17:00'},'admin',0,now);
 const members=structuredClone(c.members),slots=structuredClone(p.slots),other=structuredClone(c.polls[1]);
 applyOperation(c,{type:'updatePollDetails',pollId:p.id,changes:{title:'October discussion',notes:'Bring the draft.\nReview methods.',deadline:'2026-10-27T16:00'}},'admin',0,now);
 assert.equal(p.title,'October discussion');assert.equal(p.deadline,'2026-10-27T16:00:00.000Z');assert.equal(p.status,'open');
 assert.deepEqual(p.slots,slots);assert.deepEqual(c.members,members);assert.deepEqual(c.polls[1],other);
 applyOperation(c,{type:'updatePollDetails',pollId:p.id,changes:{notes:''}},'admin',0,now);assert.equal(p.notes,'');
});
test('unchanged expired deadline does not block title or note changes',()=>{
 const {c,p}=fixture(),deadline=p.deadline;
 applyOperation(c,{type:'updatePollDetails',pollId:p.id,changes:{title:'Updated name'}},'admin',0,Date.parse('2026-10-01T12:00:00Z'));
 assert.equal(p.deadline,deadline);assert.equal(p.title,'Updated name');
 assert.throws(()=>applyOperation(c,{type:'updatePollDetails',pollId:p.id,changes:{deadline:'2026-09-25T17:00'}},'admin',0,Date.parse('2026-10-01T12:00:00Z')),/future/);
});
test('invalid details are rejected atomically without changing votes or valid fields',()=>{
 const {c,p}=fixture(),before=structuredClone(c);
 for(const changes of [{title:'Valid title',notes:'x'.repeat(2001)},{title:' '},{notes:'Valid notes',deadline:'2026-10-25T25:00'},{status:'draft'},{slots:[]}]){
  assert.throws(()=>applyOperation(c,{type:'updatePollDetails',pollId:p.id,changes},'admin',0,now));assert.deepEqual(c,before);
 }
});
test('legacy months use the group title until given their own title',()=>{
 const {c,p}=fixture();delete p.title;delete p.notes;assert.equal(pollTitle(p,c),c.title);
 applyOperation(c,{type:'updatePollDetails',pollId:p.id,changes:{title:'This month only'}},'admin',0,now);assert.equal(pollTitle(p,c),'This month only');assert.equal(c.title,'Monthly supervision meeting');
});
test('only an administrator can edit details or delete a draft',()=>{
 const {c,p}=fixture();p.status='draft';
 for(const type of ['updatePollDetails','deleteDraft'])assert.throws(()=>applyOperation(c,{type,pollId:p.id,changes:{title:'Changed'}},'participant',0,now),/management link/);
 applyOperation(c,{type:'deleteDraft',pollId:p.id},'admin',0,now);assert.equal(c.polls.length,0);
});
test('published, selected and sent months cannot be deleted; selected and sent details stay locked',()=>{
 for(const status of ['open','selected','sent'] as const){const {c,p}=fixture();p.status=status;const before=structuredClone(c);
  assert.throws(()=>applyOperation(c,{type:'deleteDraft',pollId:p.id},'admin',0,now),/unpublished draft/);assert.deepEqual(c,before);
  if(status!=='open')assert.throws(()=>applyOperation(c,{type:'updatePollDetails',pollId:p.id,changes:{title:'Changed'}},'admin',0,now),/Reopen/);
 }
});
