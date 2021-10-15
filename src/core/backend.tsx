// -------------------------------------------------------------------------------------------------------------
// BACKEND LOGIC
// -------------------------------------------------------------------------------------------------------------
/*
  The Eigendata backend communicates between the Magic Formula Bar and the Jupyter Kernel
  Major functionality include:
  - (A) HANDLE CHANGE OF NOTEBOOK: Keeping track of notebooks in the Jupyter applicaiton
  - (B) HANDLE CODE RUNNING IN NOTEBOOK: Keeping track of the state in each Jupyter notebook, and update it every time code runs
    - This includes thigns like dataframes loaded, other variables, imported packages, imported functions, etc.
    - Most of the code for this is in initscript.ts
  - (C) API FOR REACT GUI: Handle execution of GUI tasks in the backend
    - Examples include completing the transformations form with kernel data
  - (D) UTILITIES: Utilities to communicate with the kernel   
*/

import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
// KernelConnector class. See file for more details.
import { KernelConnector } from './kernelconnector';

import { Signal } from '@lumino/signaling';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
// Initialization scripts. See file for more details.
import { pythonInitializationScript } from './initscript';

import { Dialog, ISessionContext, SessionContext, showDialog } from '@jupyterlab/apputils';

import { Kernel, KernelMessage, ServiceManager } from '@jupyterlab/services';

import _ from 'lodash';

import { JSONSchema7 } from 'json-schema';
// Utilities from another project. See file for more details.
import CellUtilities from './CellUtilities';
// JSON configuration holding all information for the UI transformationsList
import localTransformationsConfig from '../formulabar/transformations.json';

import amplitude from 'amplitude-js';

import { Column } from 'react-table';

import { Config } from 'react-awesome-query-builder';

import { OutputPanel } from '../datavisualizer/outputPanel';

//import { CodeCell } from '@jupyterlab/cells';
// Before deploying to production, we change this flag
const packageVersion = '0.3.3';
let transformationsConfig = localTransformationsConfig;

export class Backend {
  /*---------------------------------
    Properties to keep track of notebooks
  ----------------------------------*/
  // Tracker that enables us to listen to notebook change events
  private notebookTracker: INotebookTracker;

  // Object that holds the currently selected notebook
  private currentNotebook: NotebookPanel;

  // Notebook mode
  private notebookMode: string;
  public adHocSessionContext: ISessionContext;

  // Enables to connect to the kernel
  private connector: KernelConnector;

  // Output panel for charts
  private outputPanel: OutputPanel;

  /*---------------------------------
    Transformation server
  ----------------------------------*/
  private transformationServer: string;
  private transformationAuth: string;


  /*---------------------------------
    Communicate with UI
  ----------------------------------*/
  // Signal that triggers the update of the react component
  public signal = new Signal<this, void>(this);

  // Keeps track of dataframes that can be transformed through the UI
  // Used to display forms
  public dataframesLoaded = [];
  public packagesImported = [];
  public packageNamespaces = [];
  public importedFunctions = [];

  // Data transformation functions
  public transformationsList = [];

  // Flag to decide if we are going to share product data
  public shareProductData;

  public variablesLoaded = [];

  public completedProductTour: boolean;

  public kernelStatus: string;

  public eigendataMode: string;
  /*---------------------------------
    Communicate with Python Kernel
  ----------------------------------*/

  // This variable is created so that we can avoid running the code to get the available dataframes when it is not
  // needed, i.e. when we are executing code to get the form
  private codeToIgnore: string;

  /*---------------------------------
    Configurations
  ----------------------------------*/
  // Custom data transformationsList defined in JSON file
  public transformationsConfig;

  // Flag to reset the state of the frontend
  public resetStateFormulabarFlag = false;
  public resetStateDatavisualizerFlag = false;

  // Production flag that determines if usage analytics are captured
  public production = true;

  public eigendataSettings: ISettingRegistry.ISettings;

  public openFormulabarCellByDefault: boolean;

  private _dataframeSelection: any;

  get dataframeSelection() {
    return this._dataframeSelection;
  }

  set dataframeSelection(value: any) {
    this._dataframeSelection = value;
  }

  // -------------------------------------------------------------------------------------------------------------
  // CONSTRUCTOR
  // -------------------------------------------------------------------------------------------------------------
  constructor(notebooks: INotebookTracker, settingRegistry: ISettingRegistry, manager: ServiceManager, outputPanel: OutputPanel) {
    console.log('Eigendata version:', packageVersion);

    // Add a notebook tracker
    this.notebookTracker = notebooks;

    this.notebookMode = 'notebook';

    // Read transformations config
    const readTransformationConfig = (): void => {
      this.transformationsConfig = transformationsConfig['transformations'];
      const transformationList = [
        { value: 'query', label: 'Filter dataframe' }
      ];
      console.log('Read transformations into list', transformationsConfig['transformations']);
      for (const transformation in transformationsConfig['transformations']) {
        if (transformation) {
          transformationList.push({
            value: transformation,
            label:
              transformationsConfig['transformations'][transformation]['form'][
                'title'
              ]
          });
        }
      }
      this.transformationsList = transformationList;
    };

    // Read default transformation config (replaced later)
    readTransformationConfig();

    // Load python initialization script
    this.initScripts = pythonInitializationScript;

    /*------------------------------------
      LOAD SETTINGS
    ------------------------------------*/
    settingRegistry.load('@molinsp/eigendata:settings').then(
      (settings: ISettingRegistry.ISettings) => {
        if (settings.get('answeredProductDataDialog').composite === false) {
          showDialog({
            title: 'Welcome to Eigendata',
            body:
              'Eigendata captures anonymous product data using cookies. If you wish, you can opt-out by selecting reject.',
            buttons: [
              Dialog.cancelButton({ label: 'Reject' }),
              Dialog.okButton({ label: 'Accept' })
            ]
          })
            .catch(e => console.log(e))
            .then(async (result: any) => {
              await settings.set('answeredProductDataDialog', true);
              const clickedButtonLabel = result.button.label;
              console.log('Analytics: Clicked', clickedButtonLabel);
              if (clickedButtonLabel === 'Accept') {
                console.log('Analytics: Accepted permission');
                await settings.set('shareProductData', true);
                this.shareProductData = true;
                amplitude.getInstance().init('c461bfacd2f2ac406483d90c01a708a7');
                amplitude.getInstance().setVersionName(packageVersion);
              } else {
                await settings.set('shareProductData', false);
                this.shareProductData = false;
              }
            });
        } else {
          this.shareProductData = settings.get('shareProductData').composite as boolean;
        }


        this.completedProductTour = settings.get('completedProductTour').composite as boolean;
        this.eigendataMode = settings.get('eigendataMode').composite as string;
        this.transformationServer = settings.get('transformationServer').composite as string;
        this.transformationAuth = settings.get('transformationAuth').composite as string;
        this.openFormulabarCellByDefault = settings.get('openFormulabarCellByDefault').composite as boolean;
        console.log('Open formulabar cell by default', this.openFormulabarCellByDefault);

        // Save the settings object to be used. Use case is to change settings after product tour
        this.eigendataSettings = settings;

        console.log('Analytics: Product tracking data', this.shareProductData);
        // Tracking setup
        if (this.production && this.shareProductData) {
          amplitude.getInstance().init('c461bfacd2f2ac406483d90c01a708a7');
          amplitude.getInstance().setVersionName(packageVersion);
        }
      },
      (err: Error) => {
        console.error(
          `jupyterlab-execute-time: Could not load settings, so did not active the plugin: ${err}`
        );
      }
    ).then(() => {
    /*------------------------------------
      LOAD USER TRANSFORMATIONS
    ------------------------------------*/
        settingRegistry.load('@molinsp/eigendata:usertransformations').then(
          (settings: ISettingRegistry.ISettings) => {
            const userTransformations = settings.get('userTransformations').composite as JSONSchema7;

            if(!_.isEmpty(userTransformations)){
              transformationsConfig['transformations'] = Object.assign({}, transformationsConfig['transformations'], userTransformations);
              console.log('User added configs', transformationsConfig);
            }else{
              console.log('No user transformations found');
            }
          }
        );
      })
    .then(() => {
    /*------------------------------------
          LOAD REMOTE TRANSFORMATIONS
    ------------------------------------*/
        if(this.transformationAuth.length != 0 && this.transformationServer.length != 0){
          const myHeaders = new Headers();
          myHeaders.append(
            'Authorization',
            'Bearer '.concat(this.transformationAuth)
          );
          const requestOptions: RequestInit = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
          };
          fetch(
            this.transformationServer,
            requestOptions
          )
          .then(response => {
            return response.json();
          })
          .then(parsedConfig => {
            console.log('REMOTE TRANSFORMATIONS VERSION:', parsedConfig['version']);
            //transformationsConfig = parsedConfig;
            transformationsConfig['transformations'] = Object.assign({}, transformationsConfig['transformations'], parsedConfig['transformations']);
          })
          .then(() => {
              readTransformationConfig();
              this.signal.emit();
            }
          )
        }
      }
    ).then(()=>{
    /*------------------------------------
      START KERNEL IF IN NO-CODE MODE
    ------------------------------------*/
      if ( this.eigendataMode === 'no-code'){
          //Ad-hoc mode not working well yet 
          this.notebookMode = 'ad-hoc';
          this.outputPanel = outputPanel;
          this.startAdHocKernel(manager);
      }
    });

    // Subscribe to signal when notebooks change
    this.notebookTracker.currentChanged.connect(
      this.updateCurrentNotebook,
      this
    );
  }

  // -------------------------------------------------------------------------------------------------------------
  // DATA/VARIABLE INSPECTOR
  // -------------------------------------------------------------------------------------------------------------

  // This script will run in the kernel every time code runs
  // It returns an object so that it can be expanded with more info in the future, for example number of rows

  private readonly initScripts: string;

  // Returns a json object with all the dataframes & imported modules
  // Use multi import call strategy
  private kernelInspectorRequest = `
  call_backend_functions([
   {'name': 'ed_get_dfs', 'parameters': {}},
   {'name': 'ed_get_imported_modules', 'parameters': {}},  
   {'name': 'ed_get_nondf_variables', 'parameters': {}},
   {'name': 'ed_get_module_namespaces', 'parameters': {}},
   {'name': 'ed_get_functions', 'parameters': {}}
  ])
  `;

  // -------------------------------------------------------------------------------------------------------------
  //
  // (D) INTERNAL UTILITIES
  //
  // -------------------------------------------------------------------------------------------------------------

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Sends request to Kernel
  -> Returns: User expressions
  Todo: Unique way of creating Kernel requests. Probably move to the kernel connector class
  SOURCE: https://github.com/kubeflow-kale/kale/blob/167aa8859b58918622bb9b742a08cf5807dee4d8/labextension/src/utils/NotebookUtils.tsx#L326
  -----------------------------------------------------------------------------------------------------*/
  public static async sendKernelRequest(
    kernel: Kernel.IKernelConnection,
    runCode: string,
    userExpressions: any,
    runSilent = false,
    storeHistory = false,
    allowStdIn = false,
    stopOnError = false
  ): Promise<any> {
    if (!kernel) {
      throw new Error('Kernel is null or undefined.');
    }

    // Wait for kernel to be ready before sending request
    // Kernel.ready is deprecated from 2.0: https://jupyterlab.readthedocs.io/en/stable/developer/extension_migration.html
    //await kernel.ready;

    const message: KernelMessage.IShellMessage = await kernel.requestExecute({
      allow_stdin: allowStdIn,
      code: runCode,
      silent: runSilent,
      stop_on_error: stopOnError,
      store_history: storeHistory,
      user_expressions: userExpressions
    }).done;

    const content: any = message.content;

    if (content.status !== 'ok') {
      // If response is not 'ok', throw contents as error, log code
      const msg = `Code caused an error:\n${runCode}`;
      console.error(msg);
      if (content.traceback) {
        content.traceback.forEach((line: string) =>
          console.log(
            line.replace(
              /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
              ''
            )
          )
        );
      }
      throw content;
    }
    // Return user_expressions of the content
    return content.user_expressions;
  }

  // -------------------------------------------------------------------------------------------------------------
  //
  // (C) API FOR REACT GUI
  //
  // -------------------------------------------------------------------------------------------------------------

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Based on the user selection of dataframe and transformation returns form to render UI
  -> Returns: customTransformation as JSONSchema7
  -> Writes: codeToIgnore

    Depends on:
    - sendKernelRequest
  -----------------------------------------------------------------------------------------------------*/
  public async getTransformationFormSchema(
    dataFrameSelection: string,
    transformationSelection: string
  ): Promise<JSONSchema7> {
    // Check that there is a transformation selection and a dataframe selection
    console.log('------> Get transformation UI form');
    console.log('Transformation Selection', transformationSelection);

    if (
      typeof this.transformationsConfig[transformationSelection] === 'undefined'
    ) {
      console.log('TG: No transformation found');
    } else {
      /*-------------------------------------------
        Read form from custom configuration
      -------------------------------------------*/
      const customTransformation = _.cloneDeep(
        this.transformationsConfig[transformationSelection].form
      );

      // Check if there is a definitions object
      if (typeof customTransformation['definitions'] !== 'undefined') {
        const definitions = customTransformation['definitions'];

        // Check if column or columns defined
        if (
          typeof definitions['columns'] !== 'undefined' ||
          typeof definitions['column'] !== 'undefined'
        ) {
          console.log('TG: Transformation needs columns');
          const columns = await this.pythonGetDataframeColumns(
            dataFrameSelection
          );
          console.log('TG: fetched columns', columns);

          // Check if multi-select columns defined
          if (
            typeof customTransformation['definitions']['columns'] !==
            'undefined'
          ) {
            customTransformation['definitions']['columns']['items'][
              'enum'
            ] = columns;
          }

          // Check if single select column defined
          if (
            typeof customTransformation['definitions']['column'] !== 'undefined'
          ) {
            customTransformation['definitions']['column']['enum'] = columns;
          }
        }

        // Check if there is a dataframes select
        if (
          typeof customTransformation['definitions']['dataframes'] !==
          'undefined'
        ) {
          customTransformation['definitions']['dataframes'][
            'enum'
          ] = this.dataframesLoaded.map(item => item.value);
        }
      }

      return customTransformation as JSONSchema7;
    }
  }

  public getTransformationUISchema(
    transformationSelection: string
  ): JSONSchema7 {
    if (
      typeof this.transformationsConfig[transformationSelection] === 'undefined'
    ) {
      console.log('TG: No transformation form defined');
      return;
    } else {
      if (
        typeof this.transformationsConfig[transformationSelection][
          'uischema'
        ] !== 'undefined'
      ) {
        return this.transformationsConfig[transformationSelection]['uischema'];
      } else {
        console.log('TG: No transformation uiSchema defined');
      }
    }
  }

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Write to the last cell of the notebook and execute
  -> Returns: None
  -----------------------------------------------------------------------------------------------------*/
  public async writeToNotebookAndExecute(code: string, returnType: string): Promise<string> {
    if(this.notebookMode === 'notebook'){
      // Run and insert using cell utilities      
      await CellUtilities.insertRunShow(
        this.currentNotebook,
        this.currentNotebook.content.activeCellIndex,
        code,
        true
      );       
    }else if (this.notebookMode === 'ad-hoc'){
      // If no output type and ad-hoc mode, show in outputPanel
      if(returnType === 'none'){
        console.log('Execute in output panel');
        this.outputPanel.execute(code, this.adHocSessionContext);
        //this.outputPanel.addOutput(code, this.currentNotebook.sessionContext, this.currentNotebook.content.widgets[lastCellIndex] as CodeCell);
      }else{
        // Execute agains adhoc kernel
        await Backend.sendKernelRequest(
          this.adHocSessionContext.session.kernel,
          code,
          {}
        );
      }
    }

    return 'success';
  }

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Get list of columns from Kernel for selected dataframe
  -> Returns: Array of columns
  -> Writes: codeToIgnore
  -----------------------------------------------------------------------------------------------------*/
  public async pythonGetDataframeColumns(
    rightParameter: string
  ): Promise<Array<Column>> {
    const codeToRun =
      'ed_form = ed_get_json_column_values(' + rightParameter + ')';
    // Flag as code to ignore avoid triggering the pythonRequestDataframes function
    this.codeToIgnore = codeToRun;
    //console.log('Request expression', codeToRun);

    let sessionContext: ISessionContext;
    if(this.notebookMode === 'notebook'){
      sessionContext = this.currentNotebook.sessionContext;
    }else if (this.notebookMode === 'ad-hoc'){
      sessionContext = this.adHocSessionContext;
    }

    // Execute code and save the result. The last parameter is a mapping from the python variable to the javascript object
    const result = await Backend.sendKernelRequest(
      sessionContext.session.kernel,
      codeToRun,
      { form: 'ed_form' }
    );
    // Retriev the data behind the javascript object where the result is saved
    let content = result.form.data['text/plain'];

    // Clean the JSON result that python returns
    if (content.slice(0, 1) === "'" || content.slice(0, 1) === '"') {
      content = content.slice(1, -1);
      // Replace \' with ', \" with " and \xa0 with \\xa0
      content = content
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\xa0/g, '\\\\xa0');
    }

    return JSON.parse(content);
  }

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Get the querybuilder configuration
  -> Returns: JSON object to pass to querybuiler
  -> Writes: codeToIgnore
  -----------------------------------------------------------------------------------------------------*/
  public async pythonGenerateQuerybuilderConfig(
    dataframe: string
  ): Promise<Config> {
    const codeToRun =
      'ed_queryconfig = ed_generate_querybuilder_config(' + dataframe + ')';
    // Flag as code to ignore avoid triggering the pythonRequestDataframes function
    this.codeToIgnore = codeToRun;
    console.log('Request expression', codeToRun);

    let sessionContext: ISessionContext;
    if(this.notebookMode === 'notebook'){
      sessionContext = this.currentNotebook.sessionContext;
    }else if (this.notebookMode === 'ad-hoc'){
      sessionContext = this.adHocSessionContext;
    }

    // Execute code and save the result. The last parameter is a mapping from the python variable to the javascript object
    const result = await Backend.sendKernelRequest(
      sessionContext.session.kernel,
      codeToRun,
      { queryconfig: 'ed_queryconfig' }
    );
    // Retrieve the data behind the javascript object where the result is saved
    let content = result.queryconfig.data['text/plain'];

    // Clean the JSON result that python returns
    if (content.slice(0, 1) === "'" || content.slice(0, 1) === '"') {
      content = content.slice(1, -1);
      // Replace \' with ', \" with "
      content = content
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\xa0/g, '\\\\xa0');
    }

    console.log('Content', content);

    const queryConfig = JSON.parse(content);
    console.log('Query config', queryConfig);
    return queryConfig;
  }

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Get the backend data in the visualizer
  -> Returns: JSON object to pass to querybuiler
  -> Writes: codeToIgnore
  ----------------------------------------------------------------------------------------------------*/
  public async pythonGetDataForVisualization(
    dataframe: string,
    sortBy?: string,
    ascending?: boolean,
    page?: number,
    pageSize?: number
  ) {
    const isAscending = (): string => (ascending ? 'True' : 'False');
    let codeToRun = `ed_visualizer_data = ed_prep_data_for_visualization(${dataframe}`;
    if (sortBy) {
      codeToRun += `, sortby="${sortBy}" ${
        ascending !== undefined ? ', ascending=' + isAscending() : ''
      }`;
    }
    if (page) {
      codeToRun += `, page=${page}`;
    }
    if (pageSize) {
      codeToRun += `, page_size=${pageSize}`;
    }
    codeToRun += ')';
    // Flag as code to ignore avoid triggering the pythonRequestDataframes function
    this.codeToIgnore = codeToRun;
    console.log('DataViz: Request expression', codeToRun);
    let resultObject = {};

    let sessionContext: ISessionContext;
    if(this.notebookMode === 'notebook'){
      sessionContext = this.currentNotebook.sessionContext;
    }else if (this.notebookMode === 'ad-hoc'){
      sessionContext = this.adHocSessionContext;
    }

    // Execute code and save the result. The last parameter is a mapping from the python variable to the javascript object
    const result = await Backend.sendKernelRequest(
        sessionContext.session.kernel,
        codeToRun,
        { data: 'ed_visualizer_data' }
      );

    let content = result.data.data['text/plain'];
    //console.log('DataViz content', content.slice(0,100));

    if (content.slice(0, 1) === "'" || content.slice(0, 1) === '"') {
      content = content.slice(1, -1);
      // Replace \' with ', \" with " and \xa0 with \\xa0
      content = content
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\xa0/g, '\\\\xa0');
    }

    let parsedData = {};
    try {
      parsedData = JSON.parse(content);
    } catch (e) {
      console.error('DataViz: (!) Cannot parse data', e);
    }

    resultObject = parsedData;
    console.log('DataViz: Backend visualizer object', resultObject);

    return resultObject;
  }

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Remove table or variable from python kernel
  -> Returns: na
  -> Writes: na
  -----------------------------------------------------------------------------------------------------*/
  public async pythonRemoveData(data: string): Promise<void> {
    const codeToRun = 'del ' + data;
    console.log('Request expression', codeToRun);

    let sessionContext: ISessionContext;
    if(this.notebookMode === 'notebook'){
      sessionContext = this.currentNotebook.sessionContext;
    }else if (this.notebookMode === 'ad-hoc'){
      sessionContext = this.adHocSessionContext;
    }

    // Execute code and save the result. The last parameter is a mapping from the python variable to the javascript object
    const result = await Backend.sendKernelRequest(
      sessionContext.session.kernel,
      codeToRun,
      {}
    );

    console.log('Result', result);
  }

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Import library/ snippet with given statement
  -> Returns: na
  -> Writes: na
  -----------------------------------------------------------------------------------------------------*/
  public async pythonImportLibraries(importStatement: string): Promise<void> {
    if(this.notebookMode === 'notebook'){
      this.codeToIgnore = importStatement;
      // Execute the import in the kernel
      await Backend.sendKernelRequest(
        this.currentNotebook.sessionContext.session.kernel,
        importStatement,
        {}
      );

      // Get content of first cell, which by convention is for the imports
      const importsCell = CellUtilities.getCell(this.currentNotebook.content, 0);
      const importsCellContent = importsCell.value.text;
      let importsCellNewContent = '';
      console.log('imports cell', importsCellContent);

      // If the cell is empty, write the imports
      if (importsCellContent === '') {
        importsCellNewContent = importStatement;
        await CellUtilities.insertRunShow(
          this.currentNotebook,
          0,
          importsCellNewContent,
          true
        );
      }
      // If it has text, add the import in a new line
      else {
        importsCellNewContent = importsCellContent + '\n' + importStatement;
        importsCell.value.text = importsCellNewContent;
      }

      // Write in the first cell
      //this.currentNotebook.content.model.cells.get(0).value.text = importsCellNewContent;
      //await CellUtilities.injectCodeAtIndex(this.currentNotebook.content, 0, importsCellNewContent);
    }else if (this.notebookMode === 'ad-hoc'){
      await Backend.sendKernelRequest(
      this.adHocSessionContext.session.kernel,
      importStatement,
      {}
      );

    }
  }

  // -------------------------------------------------------------------------------------------------------------
  //
  // (A) HANDLE CHANGE OF NOTEBOOK
  //
  // -------------------------------------------------------------------------------------------------------------

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Initialize ad-hoc kernel
  -----------------------------------------------------------------------------------------------------*/
  private startAdHocKernel(manager: ServiceManager){
    console.log('Start ad-hoc kernel for no-code mode');
    manager.sessions.shutdownAll();
    
    this.adHocSessionContext = new SessionContext({
      sessionManager: manager.sessions,
      specsManager: manager.kernelspecs,
      kernelPreference: {name: 'python3'},
      name: 'Ad-hoc Kernel'
    });

    this.adHocSessionContext.initialize();

    const session = this.adHocSessionContext;
    // Note: When an IOptions object is passed, need to look at the sourc code to see which variables this option has. If ther eis one, we can pass it with brackets and the same name
    // To-do: Not sure if at some point I need to drop all these connections
    this.connector = new KernelConnector({ session });

    // INIT SCRIPTS
    // Basically if the connector is ready, should not have to worry about this
    this.connector.ready.then(() => {
      console.log('Connector ready');
      const content: KernelMessage.IExecuteRequestMsg['content'] = {
        code: this.initScripts,
        stop_on_error: false,
        store_history: false
      };

      this.connector
        .fetch(content, () => {})
        .then(() => {
          console.log('Fetched content');
          this.pythonRequestDataframes();
        });
    });

    // Connect to changes running in the code
    this.connector.iopubMessage.connect(this.codeRunningOnNotebook);
    
  }

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Update current notebook and create kernel connector
  -> Writes: currentNotebook, connector
  -----------------------------------------------------------------------------------------------------*/
  private async updateCurrentNotebook(
    sender: any,
    nbPanel: NotebookPanel
  ): Promise<void> {
    if(nbPanel && this.notebookMode === 'notebook'){
      console.log('------> Notebook changed', nbPanel.content.title.label);
      // Update the current notebook
      this.currentNotebook = nbPanel;

      // Creates a new way to connect to the Kernel in this notebook
      const session = this.currentNotebook.sessionContext;
      // Note: When an IOptions object is passed, need to look at the sourc code to see which variables this option has. If ther eis one, we can pass it with brackets and the same name
      // To-do: Not sure if at some point I need to drop all these connections
      this.connector = new KernelConnector({ session });

      // Basically if the connector is ready, should not have to worry about this
      this.connector.ready.then(() => {
        const content: KernelMessage.IExecuteRequestMsg['content'] = {
          code: this.initScripts,
          stop_on_error: false,
          store_history: false
        };
        this.connector
          .fetch(content, () => {})
          .then(() => {
            this.pythonRequestDataframes();
          });
      });

      // Connect to changes running in the code
      this.connector.iopubMessage.connect(this.codeRunningOnNotebook);

      /*----------------------------------------------
      Handle the case where the Kernel is restarted
      -----------------------------------------------*/
      this.connector.kernelRestarted.connect(
        (sender, kernelReady: Promise<void>) => {
          this.connector.ready.then(() => {
            // Flag to reset the frontend
            this.resetStateFormulabarFlag = true;
            this.resetStateDatavisualizerFlag = true;
            // Reset dataframes
            this.packagesImported = [];
            this.variablesLoaded = [];

            // Restart init scripts
            const content: KernelMessage.IExecuteRequestMsg['content'] = {
              code: this.initScripts,
              stop_on_error: false,
              store_history: false
            };
            this.connector
              .fetch(content, () => {})
              .then(() => {
                // Emit signal to re-render the component
                this.signal.emit();
              });
          });
        }
      );

      /*----------------------------------------------
      Handle the case where the Kernel is shut down (e.g. closing notebook)
      -----------------------------------------------*/
      this.connector.kernelShutDown.connect(
        (sender, kernelReady: Promise<void>) => {
          this.connector.ready.then(() => {
            // Flag to reset the frontend
            //this.resetStateFormulabarFlag = true;
            this.resetStateDatavisualizerFlag = true;
            // Reset dataframes
            this.packagesImported = [];
            this.variablesLoaded = [];

            this.signal.emit();
          });
        }
      );

      // Need to re-render so that the output function in the button has the latest version of
      // the current notebook. Probably there is a better way of doing this.
      this.signal.emit();

    }
  }

  // -------------------------------------------------------------------------------------------------------------
  //
  // (B) HANDLE CODE RUNNING IN NOTEBOOK
  //
  // -------------------------------------------------------------------------------------------------------------

  // Overview: codeRunningOnNotebook ->  pythonRequestDataframes -> handleGetDataframesResponse

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Get list of dataframes through reqeuestDataframes when new code runs
  -> Returns: None
  -----------------------------------------------------------------------------------------------------*/
  private codeRunningOnNotebook = (
    sess: ISessionContext,
    msg: KernelMessage.IExecuteInputMsg
  ): void => {
    const msgType: string = msg.header.msg_type;
    const code = msg.content.code;
    switch (msgType) {
      case 'error':
        console.warn('Kernel error', msg.content);
      case 'execute_input':
        // Check this is not my code running
        if (
          !(code === this.kernelInspectorRequest) &&
          !(code === this.initScripts) &&
          !(code === this.codeToIgnore) &&
          // This avoids an infinite loop of errors caused by the data visualizer
          // refreshing after an error, and encountering another error
          !(code === undefined)
        ) {
          console.log('Non-internal code running:', code);
          this.pythonRequestDataframes();
        }
        break;
      case 'status':
        this.kernelStatus = msg.content['execution_state'];
        this.signal.emit();
        // console.log('[' + this.kernelStatus + ']');
        break;
      default:
        break;
    }
  };

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Send request to the Kernel to get dataframes, processed with handleGetDataframesResponse
  -> Returns: None
  -----------------------------------------------------------------------------------------------------*/
  private pythonRequestDataframes(): void {
    const content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: this.kernelInspectorRequest,
      stop_on_error: false,
      store_history: false
    };
    this.connector.fetch(content, this.handleGetDataframesResponse);
  }

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Send request to the Kernel to get dataframes, processed with handleGetDataframesResponse
  -> Writes: dataframesLoaded
  -----------------------------------------------------------------------------------------------------*/
  private handleGetDataframesResponse = (
    response: KernelMessage.IIOPubMessage
  ): void => {
    //console.log('------> Handle inspector request');
    const messageType = response.header.msg_type;
    // console.log('Message type from the backend', messageType);
    if (messageType === 'execute_result') {
      console.log('------> Get dataframe list');
      const payload: any = response.content;
      let content: string = payload.data['text/plain'] as string;

      // The resulting python JSON neets to be cleaned
      if (content.slice(0, 1) === "'" || content.slice(0, 1) === '"') {
        content = content.slice(1, -1);
        content = content.replace(/\\"/g, '"').replace(/\\'/g, "'");
      }

      const kernelData = JSON.parse(content);
      //console.log('Kernel Inspector: Result', kernelData)
      const dataframes = kernelData['ed_get_dfs'];
      //console.log('Number of dataframes:', dataframes.length);

      const variables = kernelData['ed_get_nondf_variables'];

      this.variablesLoaded = variables;

      if (dataframes.length === 0) {
        // If there is no data loaded, reset frontend component
        this.dataframesLoaded = [];
        this.resetStateFormulabarFlag = true;
        this.resetStateDatavisualizerFlag = true;
        this.packagesImported = kernelData['ed_get_imported_modules'];
        this.packageNamespaces = kernelData['ed_get_module_namespaces'];
        this.importedFunctions = kernelData['ed_get_functions'];
      } else {
        console.log('Refreshing dataframes');
        const dataframeList: Array<Dataframe> = [];
        // Note: Just trying to make an array so that I can iterate here
        (dataframes as Array<string>).forEach(item => {
          const dataframeItem = {
            value: item,
            label: item
          };
          dataframeList.push(dataframeItem);
        });

        this.dataframesLoaded = dataframeList;
        this.packagesImported = kernelData['ed_get_imported_modules'];
        this.packageNamespaces = kernelData['ed_get_module_namespaces'];
        this.importedFunctions = kernelData['ed_get_functions'];
      }
      // Emit signal to re-render the component
      this.signal.emit();
    }
  };
}

export type Dataframe = {
  value;
  label;
};
