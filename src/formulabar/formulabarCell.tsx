import { Cell, ICellModel } from '@jupyterlab/cells';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { NotebookPanel } from '@jupyterlab/notebook';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { CommandRegistry } from '@lumino/commands';
import { IDisposable } from '@lumino/disposable';
import { PanelLayout } from '@lumino/widgets';

import { Backend } from '../core/backend';
import { FormWidget } from '../components/formWidget';


// Renders the form Widget under a cell

export class CellToolbarTracker implements IDisposable {
  constructor(
    panel: NotebookPanel,
    commands: CommandRegistry,
    settings: ISettingRegistry.ISettings | null,
    backend: Backend
  ) {
    //this._commands = commands;
    this._panel = panel;
    this._backend = backend;

    // Create widget
    this.toolbarWidget = new FormWidget(this._backend);
    this.toolbarWidget.addClass('marginsNotebook');

    // On change of active cell move the toolbar
    this._panel.content.activeCellChanged.connect(this.updateActiveCells, this);
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;

    const cells = this._panel?.context.model.cells;
    if (cells) {
      this._panel.content.activeCellChanged.disconnect(this.updateActiveCells, this);
    }
    this._panel = null;
  }

  updateActiveCells(
  	sender: any ,
    activeCell: Cell | undefined,
	): void {

	  this._addToolbar(activeCell?.model);
  }

  private _addToolbar(model: ICellModel): void {
    const cell = this._getCell(model);
    //console.log('Cell value', cell.model.value.text.length);
    //console.log('Cell type', cell.model.type);
    
    // !!!!!! cell.model.value.text.length allows us to keep showing errors to users
    if (cell && cell.model.type === 'code' && cell.model.value.text.length == 0) {
      // 0 is above the cell
    	(cell.layout as PanelLayout).insertWidget(3, this.toolbarWidget);
   	}
  }

  private _getCell(model: ICellModel): Cell | undefined {
    return this._panel?.content.widgets.find(widget => widget.model === model);
  }
  
  
  private toolbarWidget: any;
  private _backend: Backend;
  //private _commands: CommandRegistry;
  private _isDisposed = false;
  private _panel: NotebookPanel | null;
  
}

/**
 * Widget extension that creates a CellToolbarTracker each time a notebook is
 * created.
 */
export class CellBarExtension implements DocumentRegistry.WidgetExtension {
  constructor(
    commands: CommandRegistry,
    settings: ISettingRegistry.ISettings | null,
    backend: Backend
  ) {
    this._commands = commands;
    this._settings = settings;
    this._backend = backend;
  }

  createNew(panel: NotebookPanel): IDisposable {
    return new CellToolbarTracker(panel, this._commands, this._settings, this._backend);
  }

  private _backend: Backend;
  private _commands: CommandRegistry;
  private _settings: ISettingRegistry.ISettings | null;
}