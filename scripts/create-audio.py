"""Original, deterministic ambient compositions; no external samples."""
import subprocess, pathlib, math
pathlib.Path('public/audio').mkdir(exist_ok=True)
for name,base,tempo in [('dawn',130.8128,8),('clouds',146.8324,6),('night',110,10)]:
    notes=[0,7,12,16,19,16,12,7]
    freq='+'.join(f'{base*2**(n/12):.5f}*eq(mod(floor(t/{tempo}),8),{i})' for i,n in enumerate(notes))
    env=f'exp(-mod(t,{tempo})/2.8)*(1-exp(-mod(t,{tempo})*12))'
    melody=f'0.085*({env})*(sin(2*PI*({freq})*t)+0.2*sin(4*PI*({freq})*t))'
    pad='+'.join(f'0.022*sin(2*PI*{base*2**(n/12):.6f}*t+0.2*sin(0.08*t))' for n in [0,7,12,16])
    expression=f'({melody}+{pad})*(0.8+0.2*sin(0.09*t))'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i',f"aevalsrc='{expression}':s=32000:d=240",'-af','lowpass=f=2200,aecho=0.8:0.7:700|1300:0.25|0.15,afade=t=in:d=5,afade=t=out:st=233:d=7','-t','240','-ac','2','-b:a','96k',f'public/audio/{name}.mp3'],check=True)
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i','anoisesrc=color=pink:amplitude=0.2:duration=60:sample_rate=32000','-af','highpass=f=300,lowpass=f=5000','-ac','2','-b:a','64k','public/audio/rain.mp3'],check=True)
