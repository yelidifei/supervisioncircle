'use client';
import {ArrowUpRight,Trash2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {localParts,monthLabel,pollTitle,type Circle,type Poll,type PollDetailsPatch} from '@/lib/domain';

export const POLL_STATUS = {draft:'Draft',open:'Collecting replies',selected:'Invitation pending',sent:'Invitation sent'};
function deadlineLabel(poll:Poll){return new Intl.DateTimeFormat('en-GB',{timeZone:poll.timezone,day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(poll.deadline));}

export function MeetingList({polls,busy,onOpen,onDelete}:{polls:Poll[];busy:boolean;onOpen:(id:string)=>void;onDelete:(poll:Poll)=>void}){
 return <section className="panel meetings-panel" aria-label="Meeting months">
  <div className="section-heading"><h2>Meetings</h2><span className="count-badge">{polls.length} {polls.length===1?'month':'months'}</span></div>
  {polls.length===0?<p className="muted">No months yet. Use New month to create a draft.</p>:<ul className="month-list">{polls.map(poll=><li key={poll.id}>
   <div className="month-summary"><strong>{monthLabel(poll.month)}</strong><span className={'phase '+poll.status}>{POLL_STATUS[poll.status]}</span></div>
   <div className="month-deadline"><span>Reply by</span><strong>{deadlineLabel(poll)}</strong><small>{poll.timezone}</small></div>
   <div className="month-actions"><Button variant="outline" disabled={busy} onClick={()=>onOpen(poll.id)} aria-label={'View '+monthLabel(poll.month)}>View details <ArrowUpRight size={16}/></Button>{poll.status==='draft'&&<Button variant="ghost" disabled={busy} onClick={()=>onDelete(poll)} aria-label={'Delete '+monthLabel(poll.month)+' draft'}><Trash2 size={16}/>Delete draft</Button>}</div>
  </li>)}</ul>}
 </section>;
}

export function PollDetailsForm({poll,circle,busy,changes,onChange,onSave}:{poll:Poll;circle:Circle;busy:boolean;changes:PollDetailsPatch;onChange:(changes:PollDetailsPatch)=>void;onSave:()=>Promise<void>}){
 const local=localParts(poll.deadline,poll.timezone);
 const saved={title:pollTitle(poll,circle),deadline:local.date+'T'+local.time,notes:poll.notes??''};
 const values={...saved,...changes};
 function edit(field:keyof PollDetailsPatch,value:string){const next={...changes};if(value===saved[field])delete next[field];else next[field]=value;onChange(next);}
 return <section className="panel details-panel"><h2>Meeting details</h2><form className="stack-form" onSubmit={event=>{event.preventDefault();void onSave().catch(()=>{});}}>
  <label>Meeting title<Input required maxLength={100} value={values.title} disabled={busy} onChange={event=>edit('title',event.target.value)}/></label>
  <label>Reply by · {poll.timezone}<Input required type="datetime-local" value={values.deadline} disabled={busy} onInput={event=>edit('deadline',event.currentTarget.value)} onChange={event=>edit('deadline',event.target.value)}/></label>
  <label>Notes (optional)<textarea rows={3} maxLength={2000} value={values.notes} disabled={busy} onChange={event=>edit('notes',event.target.value)}/></label>
  <Button type="submit" className="primary-button" disabled={busy||!Object.keys(changes).length}>{busy?'Saving…':'Save details'}</Button>
 </form></section>;
}
