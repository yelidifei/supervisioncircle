export async function api<T>(path:string,method='GET',data?:unknown,token?:string):Promise<T>{
 const res=await fetch(path,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined,cache:'no-store'});
 const result=await res.json() as T & {error?:string};if(!res.ok)throw new Error(result.error??'Please try again.');return result;
}
export async function shareKey(admin:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('share:'+admin));return Array.from(new Uint8Array(h),x=>x.toString(16).padStart(2,'0')).join('');}

