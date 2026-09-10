import test from 'node:test';
import assert from 'node:assert/strict';
import {managementLinks,shareKey} from '../lib/client.ts';

test('legacy and recovered management links retain the right participant key',async()=>{
 const originalAdmin='1'.repeat(64),recoveredAdmin='2'.repeat(64),shared=await shareKey(originalAdmin);
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(_input,init)=>{
  const valid=new Headers(init?.headers).get('authorization')==='Bearer '+shared;
  return Response.json(valid?{id:'test-circle',role:'participant'}:{error:'Invalid key'},{status:valid?200:403});
 };
 try{
  const legacy=await managementLinks('https://example.com','test-circle',originalAdmin);
  const recovered=await managementLinks('https://example.com','test-circle',recoveredAdmin,shared);
  assert.equal(recovered.shared,legacy.shared);
  assert.equal(new URL(recovered.shared).hash,'#key='+shared);
  assert.equal(new URLSearchParams(new URL(recovered.management).hash.slice(1)).get('admin'),recoveredAdmin);
  assert.equal(new URLSearchParams(new URL(recovered.management).hash.slice(1)).get('key'),shared);
  await assert.rejects(managementLinks('https://example.com','test-circle',recoveredAdmin));
  await assert.rejects(managementLinks('https://example.com','test-circle',recoveredAdmin,'3'.repeat(64)));
 }finally{globalThis.fetch=originalFetch;}
});
