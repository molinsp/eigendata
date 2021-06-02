import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';

import { MainAreaWidget, WidgetTracker } from '@jupyterlab/apputils';

import { FormWidget } from './components/formWidget';

import { CellBarExtension } from './formulabar/noCodeCell';

import { Backend } from './core/backend';

import { DataVisualizerWidget } from './datavisualizer/datavisualizer';

import { searchIcon } from '@jupyterlab/ui-components';

import { tableIcon } from './labIcons';

import { INotebookTracker } from '@jupyterlab/notebook';

import { IMainMenu } from '@jupyterlab/mainmenu';

import { Menu } from '@lumino/widgets';

import { each } from '@lumino/algorithm';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { OutputPanel } from './datavisualizer/outputPanel';

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
  requires: [INotebookTracker, IMainMenu, ILayoutRestorer, ISettingRegistry,IRenderMimeRegistry],
  activate: (
    app: JupyterFrontEnd,
    notebook_tracker: INotebookTracker,
    mainMenu: IMainMenu,
    restorer: ILayoutRestorer,
    settingRegistry: ISettingRegistry,
    rendermime: IRenderMimeRegistry
  ) => {
    console.log('JupyterLab Eigendata is activated!');

    /*---------------------------------
      Read mode from the configuration
    ----------------------------------*/
    let eigendataMode = 'low-code';
    settingRegistry.load('@molinsp/eigendata:settings').then(     
      (settings: ISettingRegistry.ISettings) => {
        eigendataMode = settings.get('eigendataMode').composite as string;
        console.log('Eigendata mode', eigendataMode)
      }, (err: Error) => {
        console.error(
          `jupyterlab-execute-time: Could not load settings, so did not active the plugin: ${err}`
        );
      }
    ).then(
      () => {
        // -------------------------------------------------------------------------------------------------------------
        // LOW-CODE MODE
        // -------------------------------------------------------------------------------------------------------------
        let backend: Backend;
        const { commands } = app;

        // Create a menu
        const eigendataMenu: Menu = new Menu({ commands });
        eigendataMenu.title.label = 'Eigendata';
        mainMenu.addMenu(eigendataMenu, { rank: 1 });

        if(eigendataMode.localeCompare('low-code') == 0){
          backend = new Backend(notebook_tracker, settingRegistry, app.serviceManager, null);

          /*---------------------------------
            Add formula bar below cells
          ----------------------------------*/
          app.docRegistry.addWidgetExtension(
          'Notebook',
            new CellBarExtension(app.commands, null, backend)
          );

        }
        // -------------------------------------------------------------------------------------------------------------
        // NO-CODE MODE
        // -------------------------------------------------------------------------------------------------------------
        else{
          let formulawidget: MainAreaWidget<FormWidget>;
          const formulaBarCommand = CommandIDs.create;

          /*---------------------------------
            Create panel for viz output
          ----------------------------------*/
          let outputsPanel = new OutputPanel(app.serviceManager, rendermime);
          app.shell.add(outputsPanel, 'right');
          // Create class that manages the backend behavior
          backend = new Backend(notebook_tracker, settingRegistry, app.serviceManager, outputsPanel);

          /*---------------------------------
            Create formulabar as a widget
          ----------------------------------*/
          commands.addCommand(formulaBarCommand, {
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
            if (!formulaBarTracker.has(formulawidget)) {
              // Track the state of the formulawidget for later restoration
              formulaBarTracker.add(formulawidget);
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


          // Track and restore the formulawidget state
          const formulaBarTracker = new WidgetTracker<MainAreaWidget<FormWidget>>({
            namespace: 'ed'
          });
          restorer.restore(formulaBarTracker, {
            command: formulaBarCommand,
            name: () => 'ed'
          });

          // Add the command to the menu
          eigendataMenu.addItem({ 
            command: formulaBarCommand, 
            args: { origin: 'from the menu' } });
        }


        // -------------------------------------------------------------------------------------------------------------
        //Data visualizer
        // -------------------------------------------------------------------------------------------------------------
        let datavizwidget: MainAreaWidget<DataVisualizerWidget>;
        const dataVizCommand = CommandIDs.dataviz;

        commands.addCommand(dataVizCommand, {
          caption: 'Create a new Data Data Visualizer',
          label: 'Data Visualizer',
          icon: args => (args['isPalette'] ? null : tableIcon),
          execute: () => {
            if (!datavizwidget || datavizwidget.isDisposed) {
              // Create form component and pass backend behavior
              const content = new DataVisualizerWidget(backend);
              // Create datavizwidget
              datavizwidget = new MainAreaWidget<DataVisualizerWidget>({ content });
              //datavizwidget.title.label = 'Data Visualizer';
              datavizwidget.title.icon = tableIcon;
              //datavizwidget.title.iconClass = "jp-SpreadsheetIcon jp-SideBar-tabIcon";
              datavizwidget.title.closable = true;
              //app.shell.add(datavizwidget, 'main');
            }
            if (!viztracker.has(datavizwidget)) {
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

        // Track and restore the data visualizer state
        const viztracker = new WidgetTracker<MainAreaWidget<DataVisualizerWidget>>({
          namespace: 'dv'
        });
        restorer.restore(viztracker, {
          command: dataVizCommand,
          name: () => 'dv'
        });

        eigendataMenu.addItem({
          command: dataVizCommand,
          args: { origin: 'from the menu' }
        });

        // -------------------------------------------------------------------------------------------------------------
        // Simplify jupyterlab
        // -------------------------------------------------------------------------------------------------------------
        /*---------------------------------
           Kill on notebook close
        ----------------------------------*/
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

        /*---------------------------------
           Set notion-like shortcuts
        ----------------------------------*/
        settingRegistry.load('@jupyterlab/shortcuts-extension:shortcuts').then(
          (settings: ISettingRegistry.ISettings) => {      
            let userShortcutsCount = (settings.get('shortcuts').user as Array<any>).length;
            // console.log('User shortcuts count', userShortcutsCount);
            if (userShortcutsCount == 0){
              settings.set('shortcuts', [{"command":"application:toggle-right-area","keys":["Accel /"], "selector":"body"}, {"command":"application:toggle-left-area","keys":["Accel \\"], "selector":"body"}]);
            } 
          },
          (err: Error) => {
            console.error(
              `jupyterlab-execute-time: Could not load settings, so did not active the plugin: ${err}`
            );
          }
        );

        /*---------------------------------
           Hide sidebar items
        ----------------------------------*/
        each(app.shell.widgets('left'), widget => {
            //console.log('id', widget.id);
            if(widget.id == 'jp-property-inspector' || widget.id == 'tab-manager'){
              widget.close();
            }

            // For debugging purposes we will show the running sessions
            if(widget.id == 'jp-running-sessions' && backend.production == true){
              widget.close();
            }
          });

         each(app.shell.widgets('bottom'), widget => {
            //console.log('id', widget.id);
            if(widget.id == 'jp-main-statusbar'){
              widget.close();
            }
          });

        /*---------------------------------
           Remove superfluous menus
        ----------------------------------*/
        // mainMenu.editMenu.dispose();
        mainMenu.viewMenu.dispose();
        mainMenu.runMenu.dispose();
        mainMenu.fileMenu.dispose();
        mainMenu.kernelMenu.dispose();
        mainMenu.tabsMenu.dispose();
        mainMenu.settingsMenu.dispose();
        mainMenu.helpMenu.dispose();
      }
    );

  }
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [extension];
export default plugins;
