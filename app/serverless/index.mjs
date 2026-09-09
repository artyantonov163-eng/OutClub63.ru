import {readFileSync} from 'node:fs';
import {createHandler} from './app.mjs';
import {objectStore} from './storage.mjs';
const files=JSON.parse(readFileSync(new URL('./files.json',import.meta.url)));
export async function handler(event,context){
 if(!context.token?.access_token)return {statusCode:503,body:'Service unavailable'};
 return createHandler({store:objectStore(process.env.BUCKET,context.token.access_token),files,origin:process.env.PUBLIC_ORIGIN})(event);
}
