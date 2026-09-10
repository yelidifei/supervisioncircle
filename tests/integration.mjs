import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base='http://localhost:3000';
async function request(path,method='GET',input,token,expected=200){const response=await fetch(base+path,{method,headers:{...(input?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{})},body:input?JSON.stringify(input):undefined});const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));return data;}
const credentials=await request('/api/circles','POST',{title:'Test supervision meeting',names:['Rui','Minhao','Alex','Taylor','Jordan'],timezone:'Europe/London'},undefined,201);
const path='/api/circles/'+credentials.id;
await request(path,'GET',undefined,undefined,401);
await request(path,'GET',undefined,'a'.repeat(64),403);
let s=await request(path,'GET',undefined,credentials.admin);
const d=new Date();d.setUTCMonth(d.getUTCMonth()+1,1);const month=d.toISOString().slice(0,7);
const deadlineDate=new Date(Date.now()+3*86400000).toISOString().slice(0,10)+'T17:00';
s=await request(path,'PATCH',{type:'createPoll',month,deadline:deadlineDate},credentials.admin);
let p=s.circle.polls[0];
assert.equal((await request(path,'GET',undefined,credentials.share)).circle.polls.length,0,'Draft leaked to participants');
const slots=[];while(slots.length<6){if(d.getUTCDay()>0&&d.getUTCDay()<6)slots.push({date:d.toISOString().slice(0,10),time:slots.length%2?'14:00':'10:00'});d.setUTCDate(d.getUTCDate()+1);}
s=await request(path,'PATCH',{type:'addSlots',pollId:p.id,slots},credentials.admin);
p=s.circle.polls[0];
s=await request(path,'PATCH',{type:'publish',pollId:p.id},credentials.admin);
await request(path,'PATCH',{type:'removeSlot',pollId:p.id,slotId:p.slots[0].id},credentials.share,403);
const members=s.circle.members;
await Promise.all(members.map((m,i)=>request(path,'PATCH',{type:'votes',pollId:p.id,memberId:m.id,changes:p.slots.map((slot,j)=>({slotId:slot.id,before:null,value:j===0?'available':j===1?(i===0?'available':i===1?'check':i===2?'unavailable':'best'):j===2?'best':i===4?'check':'available'}))},credentials.share)));
s=await request(path,'GET',undefined,credentials.admin);p=s.circle.polls[0];
assert.equal(Object.keys(p.slots[0].votes).length,5,'Lost a concurrent reply');
const before=s.revision;
s=await request(path,'PATCH',{type:'votes',pollId:p.id,memberId:members[1].id,changes:[{slotId:p.slots[0].id,before:'available',value:'best'}]},credentials.share);
assert.equal(s.circle.polls[0].slots[0].votes[members[0].id],'available');
await request(path,'PATCH',{type:'votes',pollId:p.id,memberId:members[1].id,changes:[{slotId:p.slots[0].id,before:'available',value:'unavailable'}]},credentials.share,409);
await request(path,'PATCH',{type:'finalize',pollId:p.id,slotId:p.slots[0].id,expectedRevision:before},credentials.admin,409);
s=await request(path,'PATCH',{type:'addSlots',pollId:p.id,memberId:members[1].id,slots:[slots[0],{...slots[0],time:'11:00'}]},credentials.share);
assert.equal(s.circle.polls[0].slots.length,7);
assert.equal(s.circle.polls[0].slots.find(x=>x.start===p.slots[0].start).votes[members[1].id],'best');
const empty=s.circle.polls[0].slots.find(x=>x.time==='11:00');assert.deepEqual(empty.votes,{});
// A details save and a participant reply must both survive a D1 revision race.
const baseline=structuredClone(s.circle.polls[0]);
await Promise.all([
 request(path,'PATCH',{type:'updatePollDetails',pollId:p.id,changes:{title:'Updated monthly title',notes:'Discuss the draft.\nBring questions.'}},credentials.admin),
 request(path,'PATCH',{type:'votes',pollId:p.id,memberId:members[2].id,changes:[{slotId:empty.id,before:null,value:'check'}]},credentials.share)
]);
s=await request(path,'GET',undefined,credentials.share);
assert.equal(s.circle.polls[0].title,'Updated monthly title');
assert.equal(s.circle.polls[0].slots.find(x=>x.id===empty.id).votes[members[2].id],'check');
assert.equal(s.circle.polls[0].deadline,baseline.deadline);
for(const slot of baseline.slots)for(const [member,value] of Object.entries(slot.votes))assert.equal(s.circle.polls[0].slots.find(x=>x.id===slot.id).votes[member],value);
const unchanged=structuredClone(s.circle);
await request(path,'PATCH',{type:'updatePollDetails',pollId:p.id,changes:{title:'Forbidden'}},credentials.share,403);
await request(path,'PATCH',{type:'updatePollDetails',pollId:p.id,changes:{title:'Do not partially save',notes:'x'.repeat(2001)}},credentials.admin,400);
await request(path,'PATCH',{type:'deleteDraft',pollId:p.id},credentials.admin,409);
assert.deepEqual((await request(path,'GET',undefined,credentials.admin)).circle,unchanged);
s=await request(path,'PATCH',{type:'finalize',pollId:p.id,slotId:p.slots[0].id,expectedRevision:s.revision},credentials.admin);
assert.equal(s.circle.polls[0].status,'selected');
await request(path,'PATCH',{type:'votes',pollId:p.id,memberId:members[1].id,changes:[{slotId:empty.id,before:null,value:'available'}]},credentials.share,409);
s=await request(path,'PATCH',{type:'sent',pollId:p.id},credentials.admin);assert.equal(s.circle.polls[0].status,'sent');
await request(path,'PATCH',{type:'updatePollDetails',pollId:p.id,changes:{notes:'Locked'}},credentials.admin,409);
await request(path,'PATCH',{type:'deleteDraft',pollId:p.id},credentials.admin,409);
s=await request(path,'PATCH',{type:'reopen',pollId:p.id},credentials.admin);assert.equal(s.circle.polls[0].status,'open');assert.equal(s.circle.polls[0].calendarUpdateNeeded,true);
const duplicate=await request(path,'PATCH',{type:'addSlots',pollId:p.id,memberId:members[1].id,slots:[slots[0]]},credentials.share);assert.equal(duplicate.circle.polls[0].slots.length,7);
const next=new Date(month+'-01T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);const futureMonth=next.toISOString().slice(0,7);
s=await request(path,'PATCH',{type:'createPoll',month:futureMonth,deadline:deadlineDate},credentials.admin);
const draft=s.circle.polls.find(x=>x.month===futureMonth);
await request(path,'PATCH',{type:'deleteDraft',pollId:draft.id},credentials.share,403);
// Publishing after a delete dialog was opened must make that stale delete fail.
while([0,6].includes(next.getUTCDay()))next.setUTCDate(next.getUTCDate()+1);
await request(path,'PATCH',{type:'addSlots',pollId:draft.id,slots:[{date:next.toISOString().slice(0,10),time:'10:00'}]},credentials.admin);
await request(path,'PATCH',{type:'publish',pollId:draft.id},credentials.admin);
await request(path,'PATCH',{type:'deleteDraft',pollId:draft.id},credentials.admin,409);
next.setUTCMonth(next.getUTCMonth()+1,1);
s=await request(path,'PATCH',{type:'createPoll',month:next.toISOString().slice(0,7),deadline:deadlineDate},credentials.admin);
const disposable=s.circle.polls.find(x=>x.month===next.toISOString().slice(0,7));
s=await request(path,'PATCH',{type:'deleteDraft',pollId:disposable.id},credentials.admin);
assert.ok(!s.circle.polls.some(x=>x.id===disposable.id));
assert.deepEqual(s.circle.polls.find(x=>x.id===p.id),duplicate.circle.polls[0]);
next.setUTCMonth(next.getUTCMonth()+1,1);
s=await request(path,'PATCH',{type:'createPoll',month:next.toISOString().slice(0,7),deadline:deadlineDate},credentials.admin);
assert.equal((await request(path,'GET',undefined,credentials.share)).circle.polls.length,2);
writeFileSync('../test-state.json',JSON.stringify({base,credentials,snapshot:s,month,slots}));
console.log('PASS: shared D1 persistence; five concurrent replies; details/reply race; atomic validation; draft-only deletion and publication race; month isolation; permissions; candidate deduplication; Outlook states.');
