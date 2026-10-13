'use strict';
// Optional distributed anonymous beta budget; no paid entitlement is asserted.
// Keys use HMAC of network address; never store raw addresses in Redis.
const crypto=require('node:crypto');
const LUA=`
local minute=tonumber(redis.call('GET', KEYS[1]) or '0')
local daily=tonumber(redis.call('GET', KEYS[2]) or '0')
if minute >= tonumber(ARGV[1]) then return {0,1,minute,daily} end
if daily >= tonumber(ARGV[2]) then return {0,2,minute,daily} end
minute=redis.call('INCR',KEYS[1])
if minute==1 then redis.call('EXPIRE',KEYS[1],120) end
daily=redis.call('INCR',KEYS[2])
if daily==1 then redis.call('EXPIRE',KEYS[2],172800) end
return {1,0,minute,daily}
`;
const RELEASE=`
local m=tonumber(redis.call('GET',KEYS[1]) or '0')
local d=tonumber(redis.call('GET',KEYS[2]) or '0')
if m>0 then redis.call('DECR',KEYS[1]) end
if d>0 then redis.call('DECR',KEYS[2]) end
return 1
`;
const positive=(v,otherwise,max)=>{const n=Number(v);return Number.isInteger(n)&&n>0&&n<=max?n:otherwise};
function configured(env=process.env){
 return Boolean(/^https:\/\/[^/]+\.upstash\.io\/?$/.test(String(env.UPSTASH_REDIS_REST_URL||''))&&
 String(env.UPSTASH_REDIS_REST_TOKEN||'').length>=12&&
 String(env.USAGE_METER_SECRET||'').length>=24);
}
function limitSettings(env=process.env){
 return {daily:positive(env.FREE_AI_DAILY_LIMIT,20,1000),perMinute:positive(env.FREE_AI_MINUTE_LIMIT,4,30)};
}
function anonymize(remote,secret){
 return crypto.createHmac('sha256',secret).update(String(remote||'unknown').slice(0,160)).digest('hex').slice(0,40);
}
function keysFor(remote,env,now=Date.now()){
 const prefix='rv:anon:ai:v1:'+anonymize(remote,env.USAGE_METER_SECRET);
 return [prefix+':m:'+Math.floor(now/60000),prefix+':d:'+Math.floor(now/86400000)];
}
async function command(array,env,fetcher){
 const response=await fetcher(String(env.UPSTASH_REDIS_REST_URL).replace(/\/$/,''),
 {method:'POST',headers:{Authorization:'Bearer '+env.UPSTASH_REDIS_REST_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(array)});
 if(!response.ok)throw Error('USAGE_STORAGE_UNAVAILABLE');
 const body=await response.json();
 if(body.error||!Array.isArray(body.result))throw Error('USAGE_STORAGE_INVALID');
 return body.result;
}
async function reserve({remote,env=process.env,fetcher=fetch,now=Date.now()}){
 if(!configured(env))return {active:false,allowed:true,reason:'NOT_CONFIGURED'};
 const limits=limitSettings(env),keys=keysFor(remote,env,now);
 const result=await command(['EVAL',LUA,2,...keys,limits.perMinute,limits.daily],env,fetcher);
 const allowed=Number(result[0])===1,scope=Number(result[1])===1?'minute':Number(result[1])===2?'day':null;
 return {active:true,allowed,scope,usedToday:Number(result[3]),limitToday:limits.daily,
  retryAfterSeconds:scope==='minute'?Math.max(1,60-Math.floor(now/1000)%60):scope==='day'?Math.max(1,86400-Math.floor(now/1000)%86400):null,keys};
}
async function release({reservation,env=process.env,fetcher=fetch}){
 if(!reservation?.active||!reservation.allowed||!Array.isArray(reservation.keys))return;
 try{await command(['EVAL',RELEASE,2,...reservation.keys],env,fetcher)}catch{}
}
module.exports={reserve,release,configured,limitSettings,keysFor,anonymize};
