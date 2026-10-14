import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {root} from './add-gallery-painting.mjs';
import {join} from 'node:path';

const worker=existsSync(join(root,'dist/server/index.js'));
const child=spawn(worker?'npm':process.execPath,worker?['start','--','--port','5174']:['server.mjs','dist'],{
  cwd:worker?join(root,'hosting'):root,stdio:'inherit',env:{...process.env,PORT:'5174'}
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??0));
