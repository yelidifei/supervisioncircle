import { env } from 'cloudflare:workers';
export function database():D1Database {if(!env.DB)throw new Error('The shared database is unavailable.');return env.DB;}
