"""Prepare CC0 field recordings; sources and edits: public/audio/SOURCES.md.
Requires numpy and ffmpeg. Input files are in the directory passed as argv[1].
"""
import pathlib, subprocess, sys
import numpy as np
root=pathlib.Path(sys.argv[1]); dest=pathlib.Path('public/audio/nature');dest.mkdir(exist_ok=True)
sr=44100

def read(name,filters):
    data=subprocess.check_output(['ffmpeg','-v','error','-i',str(root/(name+'.mp3')),'-af',filters,'-f','f32le','-ac','2','-ar',str(sr),'-'])
    return np.frombuffer(data,dtype='<f4').reshape(-1,2).copy()
def save(name,a):
    assert np.isfinite(a).all() and np.max(np.abs(a))<.95
    p=subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(sr),'-ac','2','-i','-','-c:a','libmp3lame','-b:a','192k',str(dest/(name+'.mp3'))],input=a.astype('<f4').tobytes(),check=True)
    print(name,'seconds',round(len(a)/sr,2),'rms dB',round(20*np.log10(np.sqrt(np.mean(a*a))+1e-12),1),'peak',round(float(np.max(np.abs(a))),3),flush=True)
def level(a,rms,peak):
    a*=rms/(np.sqrt(np.mean(a*a))+1e-9)
    # Soft-limit only loud transient peaks, preserving the natural waveform below the knee.
    a=peak*np.tanh(a/peak)
    return a
fire=read('fire','highpass=f=180,lowpass=f=7500')
save('campfire',level(fire,.05,.35))
stream=read('stream','highpass=f=100,lowpass=f=5500')
save('forest-stream',level(stream,.011,.09))
village=read('village','atrim=start=0:end=16,highpass=f=160,lowpass=f=6000')
village=level(village,.026,.13)
fade=int(sr*.7);ramp=np.linspace(0,1,fade)[:,None];village[:fade]*=ramp;village[-fade:]*=ramp[::-1]
# Only the opening hens; discard the later rooster calls completely.
save('chickens',village)
# Preserve continuous natural rain and full drop tails instead of cutting transients.
rain=read('rain','atrim=start=10:end=85,highpass=f=140,lowpass=f=6000')
save('gentle-rain',level(rain,.028,.14))
