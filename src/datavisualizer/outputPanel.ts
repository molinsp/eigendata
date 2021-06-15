// Modified from https://github.com/jupyterlab/extension-examples/blob/master/kernel-output/src/panel.ts

import {
  ISessionContext,
} from '@jupyterlab/apputils';

import { OutputAreaModel, SimplifiedOutputArea } from '@jupyterlab/outputarea';

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { KernelMessage, ServiceManager } from '@jupyterlab/services';

import { Message } from '@lumino/messaging';

import { StackedPanel } from '@lumino/widgets';

import { CodeCell } from '@jupyterlab/cells';

import { chartIcon } from '../labIcons';

/**
 * The class name added to the example panel.
 */
const PANEL_CLASS = 'jp-RovaPanel';

/**
 * A panel with the ability to add other children.
 */
export class OutputPanel extends StackedPanel {
  constructor(
    manager: ServiceManager.IManager,
    rendermime: IRenderMimeRegistry
  ) {
    super();
    this.addClass(PANEL_CLASS);
    this.id = 'kernel-output-panel';
    this.title.icon = chartIcon;
    //this.title.label = ' Charts';
    this.title.closable = true;

    this._outputareamodel = new OutputAreaModel();
    this._outputarea = new SimplifiedOutputArea({
      model: this._outputareamodel,
      rendermime: rendermime
    });

    this.addWidget(this._outputarea);
  }

  dispose(): void {
    super.dispose();
  }

  public execute(code: string, session: ISessionContext): void {
    SimplifiedOutputArea.execute(code, this._outputarea, session)
      .then((msg: KernelMessage.IExecuteReplyMsg) => {
        console.log('OP: Kernel message', msg);
      })
      .catch(reason => console.log('ERROR:',reason));
  }

  public addOutput(code: string, session: ISessionContext, cell: CodeCell): void {
    const clone = cell.cloneOutputArea();
    if(this.widgets.length != 0){
      this.widgets[0].dispose();
    }
    this.addWidget(clone);
  }


  protected onCloseRequest(msg: Message): void {
    super.onCloseRequest(msg);
    this.dispose();
  }

  private _outputarea: SimplifiedOutputArea;
  private _outputareamodel: OutputAreaModel;

}