// [COMPONENT] Wrapper for rendering React in jupyter
//   -> Class that acts as a wrapper for rendering React in jupyter (based on the react jupyterlab extension example)
//   -> Used in: Formulabar

import { ReactWidget, UseSignal } from '@jupyterlab/apputils';
import { Backend } from '../core/backend';
import React from 'react';
import { ISignal } from '@lumino/signaling';
import { FormComponent } from '../formulabar/formulabar';

const UseSignalComponent = (props: {
  signal: ISignal<Backend, void>;
  logic: Backend;
}): JSX.Element => {
  return (
    <UseSignal signal={props.signal}>
      {(): JSX.Element => <FormComponent logic={props.logic} />}
    </UseSignal>
  );
};

export class FormWidget extends ReactWidget {
  private readonly _backend = null;

  // -------------------------------------------------------------------------------------------------------------
  // CONSTRUCTOR
  // -------------------------------------------------------------------------------------------------------------
  constructor(backend: Backend) {
    super();
    console.log('------> Constructor');
    this.addClass('jp-ReactWidget');

    this._backend = backend;
  }
  // -------------------------------------------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------------------------------------------
  render(): JSX.Element {
    return (
      <UseSignalComponent signal={this._backend.signal} logic={this._backend} />
    );
  }
}
