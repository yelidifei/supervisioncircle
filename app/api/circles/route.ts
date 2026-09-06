import {body,createCircle,json,failure} from '@/lib/server';
export async function POST(request:Request){try{return json(await createCircle(await body(request)),201);}catch(e){return failure(e);}}
