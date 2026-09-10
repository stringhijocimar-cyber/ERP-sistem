import { walkForwardModel } from './ml.mjs';
import { backtest } from './backtest.mjs';
self.onmessage = ({ data }) => {
  try {
    const options = data.options;
    const bt = backtest(data.bars, options);
    const model = walkForwardModel(data.bars, { horizon: options.modelHorizon, costBps: 2 * (options.feeBps + options.slippageBps) });
    self.postMessage({ key: data.key, bt, model });
  } catch (e) { self.postMessage({ key: data.key, error: e.message }); }
};
