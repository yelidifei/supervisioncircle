import {body,readCircle,mutateCircle,json,failure} from '@/lib/server';
type Context={params:Promise<{id:string}>};
export async function GET(req:Request,context:Context){try{return json(await readCircle((await context.params).id,req));}catch(e){return failure(e);}}
export async function PATCH(req:Request,context:Context){try{return json(await mutateCircle((await context.params).id,req,await body(req)));}catch(e){return failure(e);}}
