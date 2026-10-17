import {writeFile} from 'node:fs/promises';
const value=process.env.RAILWAY_API_ORIGIN;
if(!value)throw new Error('Set RAILWAY_API_ORIGIN to your Railway HTTPS origin in Netlify build environment');
const origin=new URL(value);
if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)throw new Error('RAILWAY_API_ORIGIN must be an HTTPS origin');
await writeFile('apps/frontend/public/_redirects',`/api/* ${origin.origin}/api/:splat 200!\n/secure-dashboard ${origin.origin}/secure-dashboard 200!\n/* /index.html 200\n`);
console.log('Configured same-origin API proxy');
