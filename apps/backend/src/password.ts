import {pbkdf2, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {hashPassword,verifyPassword} from 'better-auth/crypto';
const derive=promisify(pbkdf2);
export const hash=hashPassword;
export async function verify({password,hash:stored}:{password:string;hash:string}){
 if(!stored.startsWith('pbkdf2$'))return verifyPassword({password,hash:stored});
 const [kind,iterations,salt,value]=stored.split('$');
 if(kind!=='pbkdf2'||iterations!=='100000'||!salt||!/^([a-f0-9]{64})$/i.test(value||''))return false;
 const actual=await derive(password,salt,100000,32,'sha256');
 return timingSafeEqual(actual,Buffer.from(value,'hex'));
}
