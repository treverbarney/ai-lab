"""Small real experiments for Dino's optional upstream tools; no model downloads."""
import json, math, pathlib, struct, sys
key, action, root, raw = sys.argv[1:]
root = pathlib.Path(root); out = root / '.dino' / 'artifacts'; settings = json.loads(raw)
def save(name, value):
    (out/name).write_text(json.dumps(value, indent=2)); print('Saved', name)
def train(rate, steps, callback=lambda *_: None):
    weight=0.0; losses=[]
    for step in range(steps):
        loss=sum((weight*x-2*x)**2 for x in (-1,-.5,0,.5,1))/5
        callback(step,loss); losses.append(loss)
        gradient=sum(2*x*(weight*x-2*x) for x in (-1,-.5,0,.5,1))/5
        weight-=rate*gradient
    return {'rate':rate,'weight':weight,'loss':losses[-1],'losses':losses}
if key=='netron':
    model=out/(settings.get('file') or 'dino-tiny.onnx')
    if action=='sample':
        model=out/'dino-tiny.onnx'
        # Minimal valid ONNX Mul graph: y = x * 2, built with protobuf wire encoding.
        def var(n):
            b=bytearray()
            while n>127: b.append((n&127)|128); n>>=7
            return bytes(b)+bytes([n])
        def num(k,v): return var(k*8)+var(v)
        def field(k,v):
            if isinstance(v,str): v=v.encode()
            return var(k*8+2)+var(len(v))+v
        def value(name): return field(1,name)+field(2,field(1,num(1,1)+field(2,field(1,num(1,1)))))
        tensor=num(1,1)+num(2,1)+field(4,struct.pack('<f',2.0))+field(8,'scale')
        node=field(1,'input')+field(1,'scale')+field(2,'output')+field(3,'Dino multiply')+field(4,'Mul')
        graph=field(1,node)+field(2,'Dino tiny graph')+field(5,tensor)+field(11,value('input'))+field(12,value('output'))
        model.write_bytes(num(1,8)+field(2,'Dino Lab')+field(7,graph)+field(8,num(2,13))); print('Saved',model.name)
    else:
        import netron, threading
        if not model.is_file(): raise ValueError('Select a model or run the starter experiment first.')
        netron.start(str(model),address=('127.0.0.1',4321),browse=False);threading.Event().wait()
elif key=='aim':
    from aim import Run
    repo=root/'.dino'/'experiments'; repo.mkdir(parents=True,exist_ok=True)
    results=[]
    for rate in (.05,.2):
        run=Run(repo=str(repo),experiment='Dino CPU regression',system_tracking_interval=None,log_system_params=False);run['hparams']={'rate':rate,'steps':int(settings['steps']),'target_weight':2.0}
        result=train(rate,int(settings['steps']),lambda step,loss:run.track(loss,name='loss',step=step));result['run']=run.hash;run.close();results.append(result)
    save('dino-training-comparison.json',{'task':'fit y=2x','runs':results})
elif key=='optuna':
    import optuna
    study=optuna.create_study(direction='minimize',sampler=optuna.samplers.TPESampler(seed=7))
    study.optimize(lambda trial:train(trial.suggest_float('rate',.01,.5,log=True),40)['loss'],n_trials=int(settings['trials']))
    save('dino-search.json',{'best':study.best_params,'loss':study.best_value,'trials':[{'number':t.number,'value':t.value,'params':t.params} for t in study.trials]})
elif key=='rl':
    import gymnasium as gym
    from stable_baselines3 import PPO
    from stable_baselines3.common.evaluation import evaluate_policy
    env=gym.make('CartPole-v1'); model=PPO('MlpPolicy',env,verbose=0,n_steps=64,batch_size=32,n_epochs=2,seed=7,device='cpu',policy_kwargs={'net_arch':[32,32]})
    model.learn(total_timesteps=int(settings['steps'])); model.save(str(out/'dino-cartpole'))
    score,std=evaluate_policy(model,env,n_eval_episodes=3);env.close();save('dino-rl-evaluation.json',{'mean_reward':float(score),'std':float(std),'timesteps':int(settings['steps']),'task':'CartPole-v1','note':'Short demonstration; not a trained robotics controller.'})
elif key=='rerun':
    import rerun as rr
    rr.init('Dino motion replay',spawn=False);rr.save(str(out/'dino-motion.rrd'))
    for step in range(60):
        rr.set_time('frame',sequence=step);rr.log('trajectory',rr.Points3D([[math.cos(step/10),math.sin(step/10),step/60]],radii=.05))
    rr.disconnect(); print('Saved dino-motion.rrd. Open it in the Rerun viewer.')
