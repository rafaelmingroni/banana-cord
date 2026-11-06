// Read-only diagnosis. Credentials stay in the Firebase CLI and no production
// names, user IDs, document IDs, message content or tokens are logged.
const path=require('node:path');
const crypto=require('node:crypto');
const base=path.resolve(__dirname,'../desktop');
const {requireAuth}=require(path.join(base,'node_modules/firebase-tools/lib/requireAuth'));
const {Client}=require(path.join(base,'node_modules/firebase-tools/lib/apiv2'));
const project=require(path.join(base,'cloud/firebase-config.js')).projectId;
const client=new Client({urlPrefix:'https://firestore.googleapis.com',apiVersion:'v1',auth:true});
const rules=new Client({urlPrefix:'https://firebaserules.googleapis.com',apiVersion:'v1',auth:true});
const skipLog={body:true,resBody:true,queryParams:true};
const knownRoles=new Set(['owner','admin','moderator','member']);
function value(v){
  if(!v)return undefined;
  if('nullValue'in v)return null;
  if('stringValue'in v)return v.stringValue;
  if('booleanValue'in v)return v.booleanValue;
  if('integerValue'in v)return Number(v.integerValue);
  if('doubleValue'in v)return v.doubleValue;
  if('arrayValue'in v)return(v.arrayValue.values||[]).map(value);
  if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,value(x)]));
  return 'other';
}
const kind=v=>v===undefined?'absent':v===null?'null':Array.isArray(v)?'array':typeof v;
const role=v=>knownRoles.has(v)?v:`other-${kind(v)}`;
async function query(parent,collection,fields,limit){
  const response=await client.post(`${parent}:runQuery`,{structuredQuery:{from:[{collectionId:collection}],select:{fields:fields.map(fieldPath=>({fieldPath}))},limit}}, {skipLog});
  return(response.body||[]).filter(row=>row.document).map(row=>row.document);
}
async function main(){
  if(!process.env.FIREBASE_TOKEN)throw new Error('Firebase credential is missing');
  await requireAuth({project,token:process.env.FIREBASE_TOKEN});
  const release=await rules.get(`projects/${project}/releases/cloud.firestore`,{skipLog});
  const deployed=await rules.get(release.body.rulesetName,{skipLog});
  const source=(deployed.body.source?.files||[]).map(f=>f.content||'').join('\n');
  console.log(JSON.stringify({deployedRules:{sha256:crypto.createHash('sha256').update(source).digest('hex'),candidateFix:source.includes('data.data.candidate.candidate.size()'),legacyCandidateBug:source.includes('candidate.candidate.candidate.size()')}}));
  const parent=`projects/${project}/databases/(default)/documents`;
  const servers=await query(parent,'servers',['ownerId','memberRoles','deleting'],10);
  console.log(JSON.stringify({communitiesRead:servers.length,bounded:servers.length===10}));
  for(let index=0;index<servers.length;index++){
    const server=servers[index],owner=value(server.fields?.ownerId);
    const channels=await query(server.name,'channels',['type','allowedRoles'],50);
    const members=await query(server.name,'members',['role'],50);
    const own=members.find(member=>member.name.split('/').at(-1)===owner);
    const counts={};for(const member of members){const key=role(value(member.fields?.role));counts[key]=(counts[key]||0)+1;}
    console.log(JSON.stringify({community:index+1,ownerDocumentExists:!!own,ownerRole:role(value(own?.fields?.role)),parentOwnerRole:role(value(server.fields?.memberRoles)?.[owner]),memberRoles:counts,channels:channels.map(channel=>{const type=value(channel.fields?.type),allowed=value(channel.fields?.allowedRoles);return {type:['voice','text'].includes(type)?type:`other-${kind(type)}`,allowedRolesType:kind(allowed),allowedRoles:Array.isArray(allowed)?allowed.map(role):undefined};})}));
  }
}
main().catch(error=>{console.error(`Read-only voice diagnosis failed: ${error.status||error.context?.response?.status||error.message?.slice(0,150)||'unknown'}`);process.exitCode=1;});
