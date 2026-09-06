import {database} from '@/db';
import {Problem,insist,cleanSetup,applyOperation,type Circle,type Snapshot} from './domain';
type Row={id:string;admin_hash:string;share_hash:string;payload:string;revision:number};
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
export function json(data:unknown,status=200){return Response.json(data,{status,headers});}
export async function body(req:Request){insist(!req.headers.get('origin')||new URL(req.headers.get('origin')!).origin===new URL(req.url).origin,'Request origin does not match this site.',403);const text=await req.text();insist(text.length<=64000,'Request too large.',413);try{return JSON.parse(text);}catch{throw new Problem('Invalid request body.');}}
export async function digest(token:string){const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(data),n=>n.toString(16).padStart(2,'0')).join('');}
function secret(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');}
export async function createCircle(input:unknown){
 const x=cleanSetup(input),id=crypto.randomUUID(),admin=secret(),share=await digest('share:'+admin),members=x.names.map((name:string)=>({id:crypto.randomUUID(),name}));
 const circle:Circle={title:x.title,timezone:x.timezone,members,organiserId:members[0].id,polls:[]};
 await database().prepare('INSERT INTO circles (id,admin_hash,share_hash,payload,revision,created_at) VALUES (?,?,?,?,0,?)').bind(id,await digest(admin),await digest(share),JSON.stringify(circle),new Date().toISOString()).run();
 return {id,admin,share};
}
async function getRow(id:string,req:Request){
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'');insist(token&&/^[a-f0-9]{64}$/.test(token),'Open this page using your shared or management link.',401);
 const row=await database().prepare('SELECT * FROM circles WHERE id=?').bind(id).first<Row>();insist(row,'This circle was not found.',404);
 const hash=await digest(token);const role:'admin'|'participant'|null=hash===row.admin_hash?'admin':hash===row.share_hash?'participant':null;insist(role,'This link is not valid.',403);return {row,role};
}
function snapshot(row:Row,role:'admin'|'participant'):Snapshot{
 const circle:Circle=JSON.parse(row.payload);
 if(role==='participant')circle.polls=circle.polls.filter(p=>p.status!=='draft');
 return {id:row.id,revision:row.revision,role,circle};
}
export async function readCircle(id:string,req:Request){const {row,role}=await getRow(id,req);return snapshot(row,role);}
export async function mutateCircle(id:string,req:Request,input:unknown){
 for(let attempt=0;attempt<8;attempt++){
  const {row,role}=await getRow(id,req);const next=applyOperation(JSON.parse(row.payload),input,role,row.revision);
  const payload=JSON.stringify(next);insist(payload.length<4000000,'This circle has reached its storage limit.');
  const result=await database().prepare('UPDATE circles SET payload=?,revision=revision+1 WHERE id=? AND revision=?').bind(payload,id,row.revision).run();
  if(result.meta.changes===1)return snapshot({...row,payload,revision:row.revision+1},role);
 }
 throw new Problem('Several replies arrived together. Please try saving again.',409);
}
export function failure(e:unknown){if(e instanceof Problem)return json({error:e.message},e.status);console.error('Meeting request failed:',e instanceof Error?e.message:'Unknown failure');return json({error:'We could not save or load the meeting. Please try again.'},500);}

