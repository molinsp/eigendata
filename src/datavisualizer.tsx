import { ReactWidget, UseSignal} from '@jupyterlab/apputils';

import React, { useState } from 'react';

import {Backend} from './formulabar';

import { ISignal } from '@lumino/signaling';

/**
 * React component for a counter.
 *
 * @returns The React component
 */
const DataVisualizerComponent = (props: {logic: Backend}): JSX.Element => {
  let logic = props.logic;
  const [counter, setCounter] = useState(0);
  console.log('------> Rendering Data Visualizer UI');
  return (
    <div>
      <p>You clicked {counter} times!</p>
      <button
        onClick={(): void => {
          setCounter(counter + 1);
          const dfs = logic.dataframesLoaded;
          logic.pythonGetDataForVisualization(dfs[dfs.length-1].value);
        }}
      >
        Increment
      </button>
    </div>
  );
};

// This allows to re-render the component whene there is a signal emitted (Read about signals here https://jupyterlab.readthedocs.io/en/stable/developer/patterns.html)
// This is the recommended approach from the Jupyter team: https://jupyterlab.readthedocs.io/en/stable/developer/virtualdom.html
// Inspired by this example: https://github.com/jupyterlab/jupyterlab/blob/master/docs/source/developer/virtualdom.usesignal.tsx
// ...and this example: https://github.com/jupyterlab/jupyterlab/blob/f2e0cde0e7c960dc82fd9b010fcd3dbd9e9b43d0/packages/running/src/index.tsx#L157-L159
function UseSignalComponent(props: { signal: ISignal<Backend, void>, logic: Backend}) {
  return <UseSignal signal={props.signal}>{() => <DataVisualizerComponent logic={props.logic} />}</UseSignal>;
}

/**
 * A Counter Lumino Widget that wraps a CounterComponent.
 */
export class DataVisualizerWidget extends ReactWidget {
  /**
   * Constructs a new CounterWidget.
   */

  private _backend = null; 

  constructor(backend: Backend) {
    super();
    this.addClass('jp-ReactWidget');
    this._backend = backend;
  }

  render(): JSX.Element {
    return <UseSignalComponent signal={this._backend.signal} logic={this._backend} />;
  }
}
