"""Two-pass EBU R128 normalization of bundled music, leaving source masters intact."""
import concurrent.futures, json, pathlib, re, subprocess
root=pathlib.Path('public/audio'); out=root/'leveled';out.mkdir(exist_ok=True)
files=['dawn','clouds','night','quiet-piano','amber-room','silent-orbit','cedar-strings','first-snow','warm-keys']
def measure(file):
 p=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(file),'-af','loudnorm=I=-21:TP=-2:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
 return json.loads(re.findall(r'\{[^{}]+\}',p.stderr)[-1])
def process(name):
 source=root/(name+'.mp3'); dest=out/(name+'.mp3');before=measure(source)
 args=f"loudnorm=I=-21:TP=-2:LRA=11:measured_I={before['input_i']}:measured_TP={before['input_tp']}:measured_LRA={before['input_lra']}:measured_thresh={before['input_thresh']}:offset={before['target_offset']}:linear=true"
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-af',args,'-ar','44100','-c:a','libmp3lame','-b:a','192k',str(dest)],check=True)
 after=measure(dest)
 assert abs(float(after['input_i'])+21)<1, (name,after)
 assert float(after['input_tp'])<=-1.5,(name,after)
 print(name,before['input_i'],'->',after['input_i'],'LUFS, peak',after['input_tp'],flush=True)
 return {'file':name+'.mp3','beforeLUFS':float(before['input_i']),'afterLUFS':float(after['input_i']),'truePeakDBTP':float(after['input_tp'])}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: report=list(pool.map(process,files))
pathlib.Path('public/audio/loudness.json').write_text(json.dumps({'targetLUFS':-21,'tracks':report},indent=2)+'\n')
