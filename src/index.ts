import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';

import { MainAreaWidget, WidgetTracker } from '@jupyterlab/apputils';
import { FormWidget, Backend } from './widget';
import { reactIcon } from '@jupyterlab/ui-components';

import {
    INotebookTracker
} from '@jupyterlab/notebook';

import { IMainMenu } from '@jupyterlab/mainmenu';

import { Menu } from '@lumino/widgets';

/**
 * The command IDs used by the react-widget plugin.
 */
namespace CommandIDs {
  export const create = 'ed:open';
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
    
    let widget : MainAreaWidget<FormWidget>;
    console.log('Main Area Widget created: ', widget);

    const { commands } = app;
    const command = CommandIDs.create;

    commands.addCommand(command, {
      caption: 'Create a new React Widget',
      label: 'Magic Formula Bar',
      icon: args => (args['isPalette'] ? null : reactIcon),
      execute: () => {
        if (!widget || widget.isDisposed) {
          // Create class that manages the backend behavior
          const backend = new Backend(notebook_tracker);
          // Create form component and pass backend behavior
          const content = new FormWidget(backend);
          // Create widget
          widget = new MainAreaWidget<FormWidget>({ content });
          widget.title.label = 'Magic Formula Bar';
          widget.title.closable = true;
          //app.shell.add(widget, 'main');
        }
        if (!tracker.has(widget)) {
        // Track the state of the widget for later restoration
        tracker.add(widget);
        }
        if (!widget.isAttached) {
          // Attach the widget to the main work area if it's not there
          app.shell.add(widget, 'main');
        }
        widget.content.update();

        // Activate the widget
        app.shell.activateById(widget.id);
        }
    });

      // Track and restore the widget state
      let tracker = new WidgetTracker<MainAreaWidget<FormWidget>>({
        namespace: 'ed'
      });
      restorer.restore(tracker, {
        command,
        name: () => 'ed'
      });

    // Create a menu
    const tutorialMenu: Menu = new Menu({ commands });
    tutorialMenu.title.label = 'Eigendata';
    mainMenu.addMenu(tutorialMenu, { rank: 80 });

    // Add the command to the menu
    tutorialMenu.addItem({ command, args: { origin: 'from the menu' } });

  }
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [extension];
export default plugins;
