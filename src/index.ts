import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';

import { MainAreaWidget, WidgetTracker } from '@jupyterlab/apputils';
import { FormWidget } from './components/formWidget';
import { Backend } from './core/backend';
import { DataVisualizerWidget } from './datavisualizer/datavisualizer';
import { inspectorIcon } from '@jupyterlab/ui-components';
import { searchIcon } from '@jupyterlab/ui-components';

import { INotebookTracker } from '@jupyterlab/notebook';

import { IMainMenu } from '@jupyterlab/mainmenu';

import { Menu } from '@lumino/widgets';

import { each } from '@lumino/algorithm';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

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
  id: '@molinsp/eigendata:plugin',
  autoStart: true,
  requires: [INotebookTracker, IMainMenu, ILayoutRestorer, ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    notebook_tracker: INotebookTracker,
    mainMenu: IMainMenu,
    restorer: ILayoutRestorer,
    settingRegistry: ISettingRegistry
  ) => {
    console.log('JupyterLab Eigendata is activated!');

    let formulawidget: MainAreaWidget<FormWidget>;
    let datavizwidget: MainAreaWidget<DataVisualizerWidget>;

    const { commands } = app;
    const command = CommandIDs.create;
    const datavizcommand = CommandIDs.dataviz;

    // Create class that manages the backend behavior
    const backend = new Backend(notebook_tracker, settingRegistry);

    commands.addCommand(command, {
      caption: 'Create a new React Widget',
      label: 'Magic Formula Bar',
      icon: args => (args['isPalette'] ? null : searchIcon),
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
      icon: args => (args['isPalette'] ? null : inspectorIcon),
      execute: () => {
        if (!datavizwidget || datavizwidget.isDisposed) {
          // Create form component and pass backend behavior
          const content = new DataVisualizerWidget(backend);
          // Create datavizwidget
          datavizwidget = new MainAreaWidget<DataVisualizerWidget>({ content });
          //datavizwidget.title.label = 'Data Visualizer';
          datavizwidget.title.iconClass = "jp-SpreadsheetIcon jp-SideBar-tabIcon";
          datavizwidget.title.closable = true;
          //app.shell.add(datavizwidget, 'main');
        }
        if (!tracker.has(datavizwidget)) {
          // Track the state of the datavizwidget for later restoration
          viztracker.add(datavizwidget);
        }
        if (!datavizwidget.isAttached) {
          // Attach the datavizwidget to the main work area if it's not there
          app.shell.add(datavizwidget, 'right');
        }
        datavizwidget.content.update();

        // Activate the datavizwidget
        app.shell.activateById(datavizwidget.id);
      }
    });

    // Track and restore the formulawidget state
    const tracker = new WidgetTracker<MainAreaWidget<FormWidget>>({
      namespace: 'ed'
    });
    restorer.restore(tracker, {
      command,
      name: () => 'ed'
    });

    // Track and restore the data visualizer state
    const viztracker = new WidgetTracker<MainAreaWidget<DataVisualizerWidget>>({
      namespace: 'dv'
    });
    restorer.restore(viztracker, {
      command: datavizcommand,
      name: () => 'dv'
    });


    // Kill kernel when closing notebooks
    settingRegistry.load('@jupyterlab/notebook-extension:tracker').then(
      (settings: ISettingRegistry.ISettings) => {
        settings.set('kernelShutdown', true);
      },
      (err: Error) => {
        console.error(
          `jupyterlab-execute-time: Could not load settings, so did not active the plugin: ${err}`
        );
      }
    );

    // Hide side-bar items
    // We hide the running sessions because now they are closed automatically
    each(app.shell.widgets('left'), widget => {
        //console.log('id', widget.id);
        if(widget.id == 'jp-property-inspector' || widget.id == 'tab-manager' || widget.id == 'jp-running-sessions'){
          widget.close();
        }
      });

     each(app.shell.widgets('bottom'), widget => {
        console.log('id', widget.id);
        if(widget.id == 'jp-main-statusbar'){
          widget.close();
        }
      });


    // Open by default
    app.restored.then(() => {
      app.shell.activateById(datavizwidget.id);
    });

    // Create a menu
    const tutorialMenu: Menu = new Menu({ commands });
    tutorialMenu.title.label = 'Eigendata';
    mainMenu.addMenu(tutorialMenu, { rank: 1 });

    // Get rid of menus
    mainMenu.editMenu.dispose();
    mainMenu.viewMenu.dispose();
    mainMenu.runMenu.dispose();
    mainMenu.fileMenu.dispose();
    mainMenu.kernelMenu.dispose();
    mainMenu.kernelMenu.dispose();
    mainMenu.tabsMenu.dispose();
    //mainMenu.settingsMenu.dispose();
    mainMenu.helpMenu.dispose();

    // Add the command to the menu
    tutorialMenu.addItem({ 
      command, 
      args: { origin: 'from the menu' } });
    tutorialMenu.addItem({
      command: datavizcommand,
      args: { origin: 'from the menu' }
    });
  }
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [extension];
export default plugins;
