import {betterAuth} from 'better-auth';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {username} from 'better-auth/plugins';
import {eq} from 'drizzle-orm';
import {db} from './db.js';
import * as schema from '../../../database/schema/index.js';
import {config} from './config.js';
import {hash,verify} from './password.js';
export const auth=betterAuth({
 baseURL:config.PUBLIC_ORIGIN,secret:config.BETTER_AUTH_SECRET,trustedOrigins:[config.PUBLIC_ORIGIN],database:drizzleAdapter(db,{provider:'sqlite',schema}),
 emailAndPassword:{enabled:true,minPasswordLength:8,maxPasswordLength:128,revokeSessionsOnPasswordReset:true,password:{hash,verify}},

 user:{additionalFields:{role:{type:'string',defaultValue:'employee',input:false},active:{type:'boolean',defaultValue:true,input:false},canExport:{type:'boolean',defaultValue:false,input:false},legacyId:{type:'number',required:false,input:false}}},
 session:{expiresIn:8*60*60,updateAge:60*60,cookieCache:{enabled:false}},
 advanced:{useSecureCookies:false,defaultCookieAttributes:{httpOnly:true,sameSite:'lax',secure:false}},
 rateLimit:{enabled:true,window:60,max:30},
 databaseHooks:{session:{create:{before:async data=>{const u=await db.select().from(schema.user).where(eq(schema.user.id,data.userId));return u[0]?.active?{data}:false}}}},
 plugins:[username({minUsernameLength:3,maxUsernameLength:40,usernameValidator:value=>/^[a-z0-9._-]{3,40}$/i.test(value)})]
});
