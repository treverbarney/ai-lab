from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess,json,shutil
root=Path(__file__).resolve().parents[1]
repos={'playground':'https://github.com/tensorflow/playground','cnn':'https://github.com/poloclub/cnn-explainer','diffusion':'https://github.com/poloclub/diffusion-explainer','gan':'https://github.com/poloclub/ganlab','rewards':'https://github.com/karpathy/convnetjs','evolution':'https://github.com/EvolutionGym/evogym'}
out=root/'.dino'/'learning-sources';out.mkdir(parents=True,exist_ok=True)
def download(item):
 name,url=item;target=out/name
 result={'id':name,'source':url}
 try:
  if target.exists():
   valid=subprocess.run(['git','-C',str(target),'rev-parse','HEAD'],capture_output=True,text=True)
   if valid.returncode: shutil.rmtree(target)
  if not target.exists():
   subprocess.run(['git','clone','--depth','1','--filter=blob:none','--sparse',url,str(target)],capture_output=True,text=True,timeout=90,check=True)
  commit=subprocess.check_output(['git','-C',str(target),'rev-parse','HEAD'],text=True).strip()
  result.update(status='source checkout downloaded; sparse root files; dependencies not installed',commit=commit)
 except Exception as e: result.update(status='download incomplete',error=str(e)[-400:])
 print(name,result['status'],flush=True);return result
with ThreadPoolExecutor(max_workers=3) as pool: receipt=list(pool.map(download,repos.items()))
(out/'receipt.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps(receipt,indent=2))
