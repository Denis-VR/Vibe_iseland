import titles from './expedition-titles.json' with { type: 'json' };
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { join } from 'node:path';
export function clientIp(req) {
  let ip = req.socket.remoteAddress || '';
  if (process.env.TRUST_PROXY === '1' && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip) && isIP(req.headers['x-real-ip'] || '')) ip = req.headers['x-real-ip'];
  return ip.replace(/^::ffff:/, '');
}
export async function musicAccess(root, data) {
  const keyPath = join(data, 'music-key');
  let key;
  try { key = await readFile(keyPath); } catch (e) { if(e.code !== 'ENOENT') throw e; key = randomBytes(32); await writeFile(keyPath,key,{mode:0o600,flag:'wx'}); }
  const owner = req => 'ip:' + createHmac('sha256',key).update(clientIp(req)).digest('hex');
  const scan = async (folder, prefix, secret) => {
    const files = await readdir(folder).catch(e => { if(e.code === 'ENOENT') return []; throw e; });
    return files.filter(f=>/\.mp3$/i.test(f)).sort().map(f=>({id:prefix+createHash('sha256').update(f).digest('hex').slice(0,24),name:secret && titles[f] ? titles[f] : f.replace(/\.mp3$/i,'').replaceAll('_',' '),file:join(folder,f),secret}));
  };
  const publicTracks = await scan(join(root, 'public/audio/mymusic'),'music-',false);
  if(!publicTracks.length) publicTracks.push(...await scan(join(root,'dist-local/audio/mymusic'),'music-',false));
  const secretTracks = await scan(join(root,'private/audio/secret'),'secret-',true);
  // Keep stable track IDs so existing personal playlists continue to work.
  const catalog = () => [...publicTracks,...secretTracks].map(({id,name,secret})=>({id,name,group:secret?'secret':'mymusic',url:'/api/music/'+id,subtitle:secret?'Expedition 33':'Коллекция для фокуса'}));
  return {owner,catalog,find:id=>[...publicTracks,...secretTracks].find(t=>t.id===id)};
}
