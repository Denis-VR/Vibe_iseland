"""Six original instrumental focus compositions, with no third-party music samples.
Requires numpy and ffmpeg; generates only the six additional tracks.
"""
import pathlib,subprocess
import numpy as np
sr=32000;duration=240
specs=[
 ('quiet-piano',58,[[50,57,61,66],[47,54,57,62],[43,50,54,59],[45,52,57,59]],'piano'),
 ('amber-room',64,[[41,48,52,57],[38,45,48,53],[46,53,57,60],[48,55,60,62]],'lofi'),
 ('silent-orbit',40,[[45,52,55,59],[41,48,52,57],[48,55,59,62],[43,50,57,62]],'pad'),
 ('cedar-strings',62,[[40,47,50,55],[48,55,59,64],[43,50,54,59],[50,57,62,64]],'pluck'),
 ('first-snow',48,[[47,54,57,62],[43,50,54,59],[50,57,61,66],[45,52,57,59]],'bell'),
 ('warm-keys',56,[[48,55,59,64],[45,52,55,60],[41,48,52,57],[43,50,55,57]],'keys'),
]
root=pathlib.Path('public/audio');root.mkdir(exist_ok=True)
for track,bpm,chords,voice in specs:
 rng=np.random.default_rng(sum(map(ord,track)));mix=np.zeros((sr*duration,2),dtype=np.float32);beat=60/bpm
 def add_note(start,midi,length,amp,pan=0,kind=voice):
  offset=int(start*sr);count=min(int(length*sr),len(mix)-offset)
  if count<=0:return
  t=np.arange(count,dtype=np.float32)/sr;f=440*2**((midi-69)/12)
  if kind=='pad':
   env=np.sin(np.pi*np.minimum(t/length,1))**1.4
   wave=(np.sin(2*np.pi*f*t+.12*np.sin(t*.7))+.28*np.sin(2*np.pi*f*2.001*t)+.12*np.sin(2*np.pi*f*3*t))*.7
  elif kind=='bell':
   env=(1-np.exp(-t*22))*np.exp(-t/3.4)
   wave=np.sin(2*np.pi*f*t)+.18*np.sin(2*np.pi*f*2.76*t)*np.exp(-t/1.2)+.07*np.sin(2*np.pi*f*5.4*t)*np.exp(-t*.9)
  elif kind=='pluck':
   env=(1-np.exp(-t*160))*np.exp(-t/1.5)
   wave=sum(np.sin(2*np.pi*f*(h+.00012*h*h)*t)*np.exp(-t*h*.3)/h**1.7 for h in range(1,8))
  else:
   env=(1-np.exp(-t*70))*np.exp(-t/(2.1 if kind=='piano' else 3.2))
   wave=np.sin(2*np.pi*f*t)+.28*np.sin(2*np.pi*f*2.001*t)*np.exp(-t*.6)+.1*np.sin(2*np.pi*f*3.003*t)*np.exp(-t)
  signal=amp*env*wave;tail=min(count,int(sr*.18));signal[-tail:]*=np.linspace(1,0,tail)
  mix[offset:offset+count,0]+=signal*np.sqrt((1-pan)/2);mix[offset:offset+count,1]+=signal*np.sqrt((1+pan)/2)
 bar=beat*8
 for baridx,start in enumerate(np.arange(0,duration,bar)):
  chord=chords[baridx%4]
  # Warm sustained harmony, gently overlapping through the changes.
  for j,n in enumerate(chord):add_note(start,n,bar*1.35,.029 if voice!='pad' else .064,(j-1.5)*.2,'pad')
  if voice=='pad':
   if baridx%2==0:add_note(start+beat*2,chord[2]+12,beat*6,.025,.3,'bell')
   continue
  steps=[0,2,4,6] if voice in ['piano','bell'] else [0,1.5,3,4,5.5,7]
  for k,step in enumerate(steps):
   note=chord[[0,2,1,3,2,1][k%6]]+12
   if voice=='bell' and k%2:continue
   add_note(start+step*beat+float(rng.uniform(.005,.035)),note,5 if voice!='pluck' else 3,.078 if voice=='piano' else .06,float(rng.uniform(-.4,.4)))
  if voice=='lofi':
   for b in range(8):
    offset=int((start+b*beat)*sr);n=min(int(sr*.2),len(mix)-offset)
    if n<=0:continue
    t=np.arange(n)/sr
    if b%2==0: sound=.035*np.sin(2*np.pi*(55*t+2*(1-np.exp(-t*20))))*np.exp(-t*22)
    else:
     noise=rng.normal(0,1,n);sound=.009*np.convolve(noise,np.ones(8)/8,mode='same')*np.exp(-t*30)*(1-np.exp(-t*500))
    mix[offset:offset+n]+=sound[:,None]
 # Quiet room reflections and a wide, soft stereo tail.
 dry=mix.copy()
 for delay,gain in [(.27,.18),(.53,.13),(.83,.09),(1.27,.05)]:
  n=int(delay*sr);mix[n:]+=dry[:-n,::-1]*gain
 rms=np.sqrt(np.mean(mix*mix));mix*=.072/(rms+1e-9);mix=np.tanh(mix*.9)
 fade=sr*7;mix[:fade]*=np.linspace(0,1,fade)[:,None];mix[-fade:]*=np.linspace(1,0,fade)[:,None]
 subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(sr),'-ac','2','-i','-','-af','lowpass=f=6500','-c:a','libmp3lame','-b:a','192k',str(root/(track+'.mp3'))],input=mix.astype('<f4').tobytes(),check=True)
 print(track,'4:00',flush=True)
