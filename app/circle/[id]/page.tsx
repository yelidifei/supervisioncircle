import MeetingApp from '@/components/meeting-app';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <MeetingApp id={id}/>;}
