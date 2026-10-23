import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('.',import.meta.url));
const files=new Set(['index.html','styles.css','app.js','model.js','renderer.js','process.js']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const port=Number(process.env.PORT||4173);
const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  let file;
  try {file=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';}
  catch {res.writeHead(400);res.end('Bad request');return;}
  if(!files.has(file)) {res.writeHead(404);res.end('Not found');return;}
  try {
    const data=await readFile(path.join(root,file));
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});
    res.end(req.method==='HEAD' ? undefined : data);
  } catch {res.writeHead(500);res.end('Could not read application file');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE' ? `Port ${port} is in use. Set PORT to a different port.` : error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`FAB LAB: http://127.0.0.1:${port}`));
