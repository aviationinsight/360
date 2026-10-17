type D1Database=typeof import('./db').legacyDB;
type R2Bucket={get(key:string):Promise<null|{body:ArrayBuffer;arrayBuffer():Promise<ArrayBuffer>;json<T>():Promise<T>;text():Promise<string>}>;head(key:string):Promise<unknown>;put(key:string,value:ArrayBuffer|Uint8Array|string,options?:unknown):Promise<void>};
