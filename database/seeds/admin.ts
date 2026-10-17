import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {db,client} from '../../apps/backend/src/db.js';
import {user,account} from '../schema/index.js';
import {hash} from '../../apps/backend/src/password.js';
for(const role of ['admin','general'] as const){
 const username=role==='general'?'executive.portal':process.env.BOOTSTRAP_ADMIN_USERNAME;
 const password=role==='general'?process.env.BOOTSTRAP_EXECUTIVE_PASSWORD:process.env.BOOTSTRAP_ADMIN_PASSWORD;
 const email=role==='general'?'executive.portal@legacy.invalid':process.env.BOOTSTRAP_ADMIN_EMAIL;
 if(!username||!password||!email){console.log(`Skipped ${role}: bootstrap inputs not supplied`);continue}
 if(password.length<12)throw new Error('Bootstrap password must be at least 12 characters');
 if((await db.select().from(user).where(eq(user.username,username))).length)continue;
 const id=randomUUID(),now=new Date();await db.transaction(async tx=>{await tx.insert(user).values({id,name:role==='admin'?'Administrator':'Executive access',username,displayUsername:username,email,role,active:true,canExport:role==='admin',createdAt:now,updatedAt:now});await tx.insert(account).values({id:randomUUID(),accountId:id,providerId:'credential',userId:id,password:await hash(password),createdAt:now,updatedAt:now})});
}
console.log('Bootstrap completed; existing accounts untouched');client.close();
