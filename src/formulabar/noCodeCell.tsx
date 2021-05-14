
import { ReactWidget } from '@jupyterlab/apputils';
import React from 'react';

import { Cell, ICellModel } from '@jupyterlab/cells';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { NotebookPanel } from '@jupyterlab/notebook';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { CommandRegistry } from '@lumino/commands';
import { IDisposable } from '@lumino/disposable';
import { PanelLayout, Widget } from '@lumino/widgets';

import { Backend } from '../core/backend';
import { FormWidget } from '../components/formWidget';

/**
 * Widget cell toolbar class
 */
const CELL_BAR_CLASS = 'jp-enh-cell-bar';

const CELL_FOOTER_CLASS = 'jp-CellFooter';
const CELL_FOOTER_DIV_CLASS = 'ccb-cellFooterContainer';
const CELL_FOOTER_BUTTON_CLASS = 'ccb-cellFooterBtn';

/**
 * Extend default implementation of a cell footer.
 */
export class CellFooterWithButton extends ReactWidget{
  /**
   * Construct a new cell footer.
   */
  constructor() {
    super();
    this.addClass(CELL_FOOTER_CLASS);
  }

  render() {
    return (
      <div className={CELL_FOOTER_DIV_CLASS}>
        <button
          className={CELL_FOOTER_BUTTON_CLASS}
          onClick={event => {
            console.log('click');
          }}
        >
          run
        </button>
      </div>
    );
  }
}


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
    const cells = this._panel.context.model.cells;
	this._addToolbar(cells.get(0));
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
    activeCell: Cell,
	): void {
		console.log('DEBUG: Active changed');

		const cells = this._panel.context.model.cells;
		for(let i = 0; i < cells.length; i++){
			let cell = cells.get(i);
			this._removeToolbar(cell);
		}

		if(typeof(activeCell.model) != 'undefined'){
			this._addToolbar(activeCell.model);
		}
		
    }

  private _addToolbar(model: ICellModel): void {
    const cell = this._getCell(model);
    if (cell) {
    	const toolbar = new FormWidget(this._backend);
    	toolbar.addClass(CELL_BAR_CLASS);
    	toolbar.addClass('marginsNotebook');
      // 0 is above the cell
    	(cell.layout as PanelLayout).insertWidget(3, toolbar);
   	}
  }

  private _getCell(model: ICellModel): Cell | undefined {
    return this._panel?.content.widgets.find(widget => widget.model === model);
  }
  
  
  private _findToolbarWidgets(cell: Cell): Widget[] {
    const widgets = (cell.layout as PanelLayout).widgets;

    // Search for header using the CSS class or use the first one if not found.
    return widgets.filter(widget => widget.hasClass(CELL_BAR_CLASS)) || [];
  }


  private _removeToolbar(model: ICellModel): void {
    const cell = this._getCell(model);
    if (cell) {
      this._findToolbarWidgets(cell).forEach(widget => widget.dispose());
    }
  }
  

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