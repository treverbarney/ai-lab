# 3D AI Learning
This application now presents learning only. CAD and physics are in the separate dino-cad project.
The original engineering source is preserved for compatibility; it is not shown in the learning navigation.
## What works immediately
LLM Visualization, Transformer Explainer, TensorSpace, TensorFlow Playground, CNN Explainer, Diffusion Explainer, GAN Lab, and Reward Learning open hosted sites. They need internet. Some sites may block embedded views; use Open in browser/tab.
MiniMind retains the optional tiny CPU diagnostic profile. It does not train a useful assistant by itself.
EvoGym opens the research site, tasks, examples, and documentation. Its source is available on demand; a compatible Python environment and a training run are separate setup steps.
## Speed
Only one remote lesson view stays active. Nothing downloads models or starts training on launch.
The app uses separate settings and port 4337 so it can coexist with Dino CAD and the previous Dino Lab.
## Download source code
Run python3 setup/download-learning-sources.py to retrieve shallow sparse source checkouts (root documentation; expand the sparse checkout to fetch implementation/assets) under .dino/learning-sources. This does not install dependencies or start training. The receipt records download status per project. Sources are independent upstream projects with their own licenses.
