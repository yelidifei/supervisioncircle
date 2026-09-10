export async function api<T>(path:string,method='GET',data?:unknown,token?:string):Promise<T>{
 const res=await fetch(path,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined,cache:'no-store'});
 const result=await res.json() as T & {error?:string};if(!res.ok)throw new Error(result.error??'Please try again.');return result;
}
export async function shareKey(admin:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('share:'+admin));return Array.from(new Uint8Array(h),x=>x.toString(16).padStart(2,'0')).join('');}

export async function managementLinks(origin:string,id:string,admin:string,explicitShare?:string){
 const share=explicitShare||await shareKey(admin);
 const snapshot=await api<{id:string;role:string}>('/api/circles/'+id,'GET',undefined,share);
 if(snapshot.id!==id||snapshot.role!=='participant')throw new Error('Open your complete management link to copy the shared link.');
 const path=origin+'/circle/'+id;
 return {shared:path+'#key='+share,management:path+'#admin='+admin+(explicitShare?'&key='+share:'')};
}

