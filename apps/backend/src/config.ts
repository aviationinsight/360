import 'dotenv/config';
import {z} from 'zod';
const schema=z.object({NODE_ENV:z.enum(['development','test','production']).default('development'),PORT:z.coerce.number().default(3000),DATABASE_URL:z.string().startsWith('file:').default('file:.data/dev.db'),BETTER_AUTH_SECRET:z.string().min(32),PUBLIC_ORIGIN:z.string().url().refine(value=>{const url=new URL(value);return url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)},'Only a local HTTP origin is supported'),DATA_DIR:z.string().default('.data/objects')});
export const config=schema.parse(Object.fromEntries(Object.entries(process.env).filter(([,value])=>value!=='')));
