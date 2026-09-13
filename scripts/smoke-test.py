"""Integration checks against loopback dev storage; creates an isolated QA track."""
import urllib.request,urllib.error,http.cookiejar,json, pathlib
base='http://localhost:5173'
jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def call(path,data=None,method=None,headers=None,opener=client):
    try:
        r=opener.open(urllib.request.Request(base+path,data=data,method=method,headers=headers or {}));return r.status,r.read(),r.headers
    except urllib.error.HTTPError as e:return e.code,e.read(),e.headers
assert call('/api/state',opener=urllib.request.build_opener())[0]==401
call('/signin-with-chatgpt?return_to=/')
status,data,_=call('/api/state');assert status==200,(status,data)
snapshot=json.loads(data);state=snapshot['state'];original=json.loads(json.dumps(state));rev=snapshot['revision'];assert len(state['playlists'])>=1
state['playlists'].append({'id':'qa-test','name':'QA persistence check','tracks':['ambient-dawn']})
body=json.dumps({'state':state,'revision':rev}).encode()
assert call('/api/state',body,'PUT',{'Content-Type':'application/json','Origin':'https://untrusted.test'})[0]==403
assert call('/api/state',body,'PUT',{'Content-Type':'application/json'})[0]==200
assert call('/api/state',body,'PUT',{'Content-Type':'application/json'})[0]==409
updated=json.loads(call('/api/state')[1]);assert updated['state']['playlists'][-1]['name']=='QA persistence check'
assert call('/api/state',b'{','PUT',{'Content-Type':'application/json'})[0]==400
assert call('/api/state',json.dumps({'state':original,'revision':updated['revision']}).encode(),'PUT',{'Content-Type':'application/json'})[0]==200
payload=pathlib.Path('public/audio/dawn.mp3').read_bytes()
status,data,_=call('/api/tracks',payload,'POST',{'Content-Type':'application/octet-stream','X-File-Name':'QA%20ambient.mp3'});assert status==201,(status,data)
track=json.loads(data);status,chunk,headers=call('/api/tracks/'+track['id'],headers={'Range':'bytes=0-999'});assert status==206 and len(chunk)==1000,(status,len(chunk),headers)
assert call('/api/tracks/'+track['id'],opener=urllib.request.build_opener())[0]==401
assert any(t['id']==track['id'] for t in json.loads(call('/api/tracks')[1]))
print('PASS: authentication, origin check, playlist persistence, conflict protection, malformed input, upload, audio byte range, private audio access, library persistence')
