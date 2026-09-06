import { env } from 'cloudflare:workers';
export function database():D1Database {if(!env.DB)throw new Error('The shared database is unavailable.');return env.DB;}
export function isReadOnly():boolean {return env.CIRCLE_READ_ONLY==='true';}
