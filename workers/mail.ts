// HTTPS transport for Workers, where SMTP ports may be restricted.
export default {createTransport(){return {async sendMail(message:{from:string;to:string;subject:string;text:string}){
 const key=process.env.RESEND_API_KEY;if(!key)throw new Error('RESEND_API_KEY is required for password recovery on Workers');
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(message)});
 if(!response.ok)throw new Error(`Recovery email failed (${response.status})`);
}}}};
