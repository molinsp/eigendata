import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';

import { MainAreaWidget, WidgetTracker } from '@jupyterlab/apputils';
import { FormWidget, Backend } from './formulabar';
import { DataVisualizerWidget } from './datavisualizer';
import { reactIcon } from '@jupyterlab/ui-components';

import {
    INotebookTracker
} from '@jupyterlab/notebook';

import { IMainMenu } from '@jupyterlab/mainmenu';

import { Menu } from '@lumino/widgets';

/**
 * The command IDs used by the react-formulawidget plugin.
 */
namespace CommandIDs {
  export const create = 'ed:open';
  export const dataviz = 'ed:opendataviz';
}

/**
 * Initialization data for the hello-world extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'Magic Formulas',
  autoStart: true,
  requires: [INotebookTracker, IMainMenu, ILayoutRestorer],
  activate: (app: JupyterFrontEnd, notebook_tracker: INotebookTracker, mainMenu: IMainMenu, restorer: ILayoutRestorer) => {
    console.log('JupyterLab Eigendata is activated!');
    
    let formulawidget : MainAreaWidget<FormWidget>;
    let datavizwidget : MainAreaWidget<DataVisualizerWidget>;

    const { commands } = app;
    const command = CommandIDs.create;
    const datavizcommand = CommandIDs.dataviz;

    // Create class that manages the backend behavior
    const backend = new Backend(notebook_tracker);

    commands.addCommand(command, {
      caption: 'Create a new React Widget',
      label: 'Magic Formula Bar',
      icon: args => (args['isPalette'] ? null : reactIcon),
      execute: () => {
        if (!formulawidget || formulawidget.isDisposed) {
          // Create form component and pass backend behavior
          const content = new FormWidget(backend);
          // Create formulawidget
          formulawidget = new MainAreaWidget<FormWidget>({ content });
          formulawidget.title.label = 'Magic Formula Bar';
          formulawidget.title.closable = true;
          //app.shell.add(formulawidget, 'main');
        }
        if (!tracker.has(formulawidget)) {
        // Track the state of the formulawidget for later restoration
        tracker.add(formulawidget);
        }
        if (!formulawidget.isAttached) {
          // Attach the formulawidget to the main work area if it's not there
          app.shell.add(formulawidget, 'main');
        }
        formulawidget.content.update();

        // Activate the formulawidget
        app.shell.activateById(formulawidget.id);
        }
    });

    commands.addCommand(datavizcommand, {
      caption: 'Create a new Data Data Visualizer',
      label: 'Data Visualizer',
      icon: args => (args['isPalette'] ? null : reactIcon),
      execute: () => {
        if (!datavizwidget || datavizwidget.isDisposed) {
          // Create form component and pass backend behavior
          const content = new DataVisualizerWidget(backend);
          // Create datavizwidget
          datavizwidget = new MainAreaWidget<DataVisualizerWidget>({ content });
          datavizwidget.title.label = 'Data Visualizer';
          datavizwidget.title.closable = true;
          //app.shell.add(datavizwidget, 'main');
        }
        if (!tracker.has(datavizwidget)) {
        // Track the state of the datavizwidget for later restoration
          viztracker.add(datavizwidget);
        }
        if (!datavizwidget.isAttached) {
          // Attach the datavizwidget to the main work area if it's not there
          app.shell.add(datavizwidget, 'main');
        }
        datavizwidget.content.update();

        // Activate the datavizwidget
        app.shell.activateById(datavizwidget.id);
        }
    });

    // Track and restore the formulawidget state
    let tracker = new WidgetTracker<MainAreaWidget<FormWidget>>({
      namespace: 'ed'
    });
    restorer.restore(tracker, {
      command,
      name: () => 'ed'
    });

    // Track and restore the formulawidget state
    let viztracker = new WidgetTracker<MainAreaWidget<DataVisualizerWidget>>({
      namespace: 'ed'
    });
    restorer.restore(viztracker, {
      command: datavizcommand,
      name: () => 'ed'
    });


    // Create a menu
    const tutorialMenu: Menu = new Menu({ commands });
    tutorialMenu.title.label = 'Eigendata';
    mainMenu.addMenu(tutorialMenu, { rank: 80 });

    // Add the command to the menu
    tutorialMenu.addItem({ command, args: { origin: 'from the menu' } });
    tutorialMenu.addItem({ command: datavizcommand, args: { origin: 'from the menu' } });

  }
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [extension];
export default plugins;
