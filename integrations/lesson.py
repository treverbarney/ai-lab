import marimo
app = marimo.App(width="medium")
@app.cell
def _():
    import marimo as mo
    mo.md('# Dino Gradient Lab\nFit **y = 2x** with gradient descent. Change the learning rate and training steps to see the result.')
    return (mo,)
@app.cell
def _(mo):
    rate = mo.ui.slider(start=0.01, stop=0.5, step=0.01, value=0.1, label='Learning rate')
    steps = mo.ui.slider(start=10, stop=100, step=10, value=40, label='Training steps')
    mo.hstack([rate, steps])
    return rate, steps
@app.cell
def _(mo, rate, steps):
    weight = 0.0
    rows = []
    for step in range(steps.value):
        loss = sum((weight*x-2*x)**2 for x in (-1,-.5,0,.5,1))/5
        rows.append({'step':step, 'loss':round(loss,8), 'weight':round(weight,6)})
        weight -= rate.value * sum(2*x*(weight*x-2*x) for x in (-1,-.5,0,.5,1))/5
    mo.vstack([mo.md(f'## Learned weight: {weight:.5f}\nTarget: **2.0** · Final loss: **{loss:.8f}**'), mo.ui.table(rows, page_size=10)])
    return
if __name__ == '__main__':
    app.run()
