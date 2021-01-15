// -------------------------------------------------------------------------------------------------------------
// BACKEND LOGIC
// -------------------------------------------------------------------------------------------------------------
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
// KernelConnector class. See file for more details.
import { KernelConnector } from './kernelconnector';
import { Signal } from '@lumino/signaling';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
// Initialization scripts. See file for more details.
import { python_initialization_script } from '../initscript';
import { Dialog, ISessionContext, showDialog } from '@jupyterlab/apputils';
import ReactGA from 'react-ga';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import _ from 'lodash';
import { JSONSchema7 } from 'json-schema';
// Utilities from another project. See file for more details.
import CellUtilities from './CellUtilities';
// JSON configuration holding all information for the UI transformationsList
import localTransformationsConfig from '../transformations.json';
import amplitude from 'amplitude-js';

// Before deploying to production, we change this flag
const packageVersion = '0.2.2';
let _transformationsConfig = localTransformationsConfig;

export class Backend {
  /*---------------------------------
    Keep track of notebooks
  ----------------------------------*/
  // Tracker that enables us to listen to notebook change events
  private _notebookTracker: INotebookTracker;

  // Object that holds the currently selected notebook
  private _currentNotebook: NotebookPanel;

  // Enables to connect to the kernel
  private _connector: KernelConnector;

  /*---------------------------------
    Communicate with UI
  ----------------------------------*/
  // Signal that triggers the update of the react component
  public signal = new Signal<this, void>(this);

  // Keeps track of dataframes that can be transformed through the UI
  // Used to display forms
  public dataframesLoaded: any = [];
  public packagesImported: any = [];

  // Data transformation functions
  public transformationsList = [];

  // Flag to decide if we are going to share product data
  public shareProductData;

  public variablesLoaded: any = [];

  public completedProductTour: boolean;
  /*---------------------------------
    Communicate with Python Kernel
  ----------------------------------*/

  // This variable is created so that we can avoid running the code to get the available dataframes when it is not
  // needed, i.e. when we are executing code to get the form
  private _codeToIgnore: string;

  /*---------------------------------
    Configurations
  ----------------------------------*/
  // Custom data transformationsList defined in JSON file
  public _transformationsConfig: any;

  // Flag to reset the state of the frontend
  public _resetStateFormulabarFlag = false;
  public _resetStateDatavisualizerFlag = false;

  public _production = false;

  public eigendataSettings: ISettingRegistry.ISettings;

  // -------------------------------------------------------------------------------------------------------------
  // CONSTRUCTOR
  // -------------------------------------------------------------------------------------------------------------
  constructor(notebooks: INotebookTracker, settingRegistry: ISettingRegistry) {
    console.log('------> Backend Constructor');

    // Add a notebook tracker
    this._notebookTracker = notebooks;

    // Subscribe to signal when notebooks change
    this._notebookTracker.currentChanged.connect(
      this.updateCurrentNotebook,
      this
    );

    const readTransformationConfig = (): void => {
      this._transformationsConfig = _transformationsConfig['transformations'];
      console.log(
        'TRANSFORMATIONS VERSION:',
        _transformationsConfig['version']
      );
      const transformationList = [
        { value: 'query', label: 'Filter dataframe' }
      ];
      for (const transformation in _transformationsConfig['transformations']) {
        //console.log('type', transformation);
        transformationList.push({
          value: transformation,
          label:
            _transformationsConfig['transformations'][transformation]['form'][
              'title'
            ]
        });
      }
      this.transformationsList = transformationList;
    };

    //readTransformationConfig();

    if (this._production) {
      console.log('--- In Production environment ---');
      const myHeaders = new Headers();
      myHeaders.append(
        'Authorization',
        'Bearer yO2g8OCpvl45o4F93O4nxNsrPjCvYHcMTBiPvzU7pR0'
      );
      const requestOptions: RequestInit = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow'
      };
      fetch(
        'https://eigendata-auth.herokuapp.com/transformations.json',
        requestOptions
      )
        .then(response => {
          return response.json();
        })
        .then(parsedConfig => {
          _transformationsConfig = parsedConfig;
          readTransformationConfig();
          this.signal.emit();
        });
    } else {
      console.log('--- In Dev environment ---');
      readTransformationConfig();
    }

    // Load python initialization script
    this._initScripts = python_initialization_script;

    /*------------------------------
      Get user consent for analytics
    -------------------------------*/
    settingRegistry.load('@molinsp/eigendata:plugin').then(
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
            .then((result: any) => {
              settings.set('answeredProductDataDialog', true);
              const clickedButtonLabel = result.button.label;
              console.log('Analytics: Clicked', clickedButtonLabel);
              if (clickedButtonLabel === 'Accept') {
                console.log('Analytics: Accepted permission');
                settings.set('shareProductData', true);
                this.shareProductData = true;
              } else {
                settings.set('shareProductData', false);
                this.shareProductData = false;
              }
            });
        } else {
          console.log('Analytics: Reading product dada settings');
          this.shareProductData = settings.get('shareProductData')
            .composite as boolean;
        }

        this.completedProductTour = settings.get('completedProductTour')
          .composite as boolean;
        console.log(
          'Settings: completedProductTour',
          this.completedProductTour
        );

        // Save the settings object to be used. Use case is to change settings after product tour
        this.eigendataSettings = settings;

        console.log('Analytics: Product tracking data', this.shareProductData);
        // Tracking setup
        if (this._production && this.shareProductData) {
          amplitude.getInstance().init('c461bfacd2f2ac406483d90c01a708a7');
          ReactGA.initialize('UA-111934622-2');
          ReactGA.pageview('EigendataApp');
          amplitude.getInstance().setVersionName(packageVersion);
        }
      },
      (err: Error) => {
        console.error(
          `jupyterlab-execute-time: Could not load settings, so did not active the plugin: ${err}`
        );
      }
    );
  }

  // -------------------------------------------------------------------------------------------------------------
  // DATA/VARIABLE INSPECTOR
  // -------------------------------------------------------------------------------------------------------------

  // This script will run in the kernel every time code runs
  // It returns an object so that it can be expanded with more info in the future, for example number of rows

  private _initScripts: string;

  // Returns a json object with all the dataframes & imported modules
  // Use multi import call strategy
  private kernelInspectorRequest = `
  call_backend_functions([
   {'name': 'ed_get_dfs', 'parameters': {}},
   {'name': 'ed_get_imported_modules', 'parameters': {}},  
   {'name': 'ed_get_nondf_variables', 'parameters': {}}
  ])
  `;

  // -------------------------------------------------------------------------------------------------------------
  // INTERNAL UTILITIES
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
  // API FOR REACT GUI
  // -------------------------------------------------------------------------------------------------------------

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Based on the user selection of dataframe and transformation returns form to render UI
  -> Returns: custom_transformation as JSONSchema7
  -> Writes: _codeToIgnore

    Depends on:
    - sendKernelRequest
  -----------------------------------------------------------------------------------------------------*/
  public async getTransformationFormSchema(
    dataFrameSelection: string,
    transformationSelection: string
  ) {
    // Check that there is a transformation selection and a dataframe selection
    console.log('------> Get transformation UI form');
    console.log('Transformation Selection', transformationSelection);

    if (
      typeof this._transformationsConfig[transformationSelection] ===
      'undefined'
    ) {
      console.log('TG: No transformation found');
    } else {
      /*-------------------------------------------
        Read form from custom configuration
      -------------------------------------------*/
      const custom_transformation = _.cloneDeep(
        this._transformationsConfig[transformationSelection].form
      );

      // Check if there is a definitions object
      if (typeof custom_transformation['definitions'] !== 'undefined') {
        const definitions = custom_transformation['definitions'];

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
            typeof custom_transformation['definitions']['columns'] !==
            'undefined'
          ) {
            custom_transformation['definitions']['columns']['items'][
              'enum'
            ] = columns;
          }

          // Check if single select column defined
          if (
            typeof custom_transformation['definitions']['column'] !==
            'undefined'
          ) {
            custom_transformation['definitions']['column']['enum'] = columns;
          }
        }

        // Check if there is a dataframes select
        if (
          typeof custom_transformation['definitions']['dataframes'] !==
          'undefined'
        ) {
          custom_transformation['definitions']['dataframes'][
            'enum'
          ] = this.dataframesLoaded.map((item: any) => item.value);
        }
      }

      return custom_transformation as JSONSchema7;
    }
  }

  public getTransfromationUISchema(transformationSelection: string) {
    if (
      typeof this._transformationsConfig[transformationSelection] ===
      'undefined'
    ) {
      console.log('TG: No transformation form defined');
      return;
    } else {
      if (
        typeof this._transformationsConfig[transformationSelection][
          'uischema'
        ] !== 'undefined'
      ) {
        return this._transformationsConfig[transformationSelection]['uischema'];
      } else {
        console.log('TG: No transformation uischema defined');
      }
    }
  }

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Write to the last cell of the notebook and execute
  -> Returns: None
  -----------------------------------------------------------------------------------------------------*/
  public async writeToNotebookAndExecute(code: string) {
    // Calculate index of last cell
    const last_cell_index = this._currentNotebook.content.widgets.length - 1;
    /*
    if (last_cell_index == 0){
      last_cell_index += 1;
    }
    */
    console.log('Last cell index', last_cell_index);

    // Run and insert using cell utilities
    try {
      await CellUtilities.insertRunShow(
        this._currentNotebook,
        last_cell_index,
        code,
        true
      );
      return 'success';
    } catch (error) {
      throw error;
    }
  }

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Get list of columns from Kernel for selected dataframe
  -> Returns: Array of columns
  -> Writes: _codeToIgnore
  -----------------------------------------------------------------------------------------------------*/
  public async pythonGetDataframeColumns(rightParameter: string) {
    const codeToRun =
      'ed_form = ed_get_json_column_values(' + rightParameter + ')';
    // Flag as code to ignore avoid triggering the pythonRequestDataframes function
    this._codeToIgnore = codeToRun;
    //console.log('Request expression', codeToRun);

    // Execute code and save the result. The last parameter is a mapping from the python variable to the javascript object
    const result = await Backend.sendKernelRequest(
      this._currentNotebook.sessionContext.session.kernel,
      codeToRun,
      { form: 'ed_form' }
    );
    // Retriev the data behind the javascript object where the result is saved
    let content = result.form.data['text/plain'];

    // Clean the JSON result that python returns
    if (content.slice(0, 1) == "'" || content.slice(0, 1) == '"') {
      content = content.slice(1, -1);
      // Replace \' with ', \" with " and \xa0 with \\xa0
      content = content
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\xa0/g, '\\\\xa0');
    }

    const columns = JSON.parse(content);
    //console.log('New columns', columns);

    return columns;
  }

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Get the querybuilder configuration
  -> Returns: JSON object to pass to querybuiler
  -> Writes: _codeToIgnore
  -----------------------------------------------------------------------------------------------------*/
  public async pythonGenerateQuerybuilderConfig(dataframe: string) {
    const codeToRun =
      'ed_queryconfig = ed_generate_querybuilder_config(' + dataframe + ')';
    // Flag as code to ignore avoid triggering the pythonRequestDataframes function
    this._codeToIgnore = codeToRun;
    console.log('Request expression', codeToRun);

    // Execute code and save the result. The last parameter is a mapping from the python variable to the javascript object
    const result = await Backend.sendKernelRequest(
      this._currentNotebook.sessionContext.session.kernel,
      codeToRun,
      { queryconfig: 'ed_queryconfig' }
    );
    // Retriev the data behind the javascript object where the result is saved
    let content = result.queryconfig.data['text/plain'];

    // Clean the JSON result that python returns
    if (content.slice(0, 1) == "'" || content.slice(0, 1) == '"') {
      content = content.slice(1, -1);
      // Replace \' with ', \" with "
      content = content
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\xa0/g, '\\\\xa0');
    }

    console.log('Content', content);

    const query_config = JSON.parse(content);
    console.log('Query config', query_config);
    return query_config;
  }

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Get the backendata in the visualizer
  -> Returns: JSON object to pass to querybuiler
  -> Writes: _codeToIgnore
  -----------------------------------------------------------------------------------------------------*/
  public async pythonGetDataForVisualization(dataframe: string) {
    const codeToRun =
      'ed_visualizer_data = ed_prep_data_for_visualization(' + dataframe + ')';
    // Flag as code to ignore avoid triggering the pythonRequestDataframes function
    this._codeToIgnore = codeToRun;
    console.log('DataViz: Request expression', codeToRun);
    let result_object = {};

    // Execute code and save the result. The last parameter is a mapping from the python variable to the javascript object
    const result = await Backend.sendKernelRequest(
      this._currentNotebook.sessionContext.session.kernel,
      codeToRun,
      { data: 'ed_visualizer_data' }
    );

    let content = result.data.data['text/plain'];
    //console.log('DataViz content', content.slice(0,100));

    if (content.slice(0, 1) == "'" || content.slice(0, 1) == '"') {
      content = content.slice(1, -1);
      // Replace \' with ', \" with " and \xa0 with \\xa0
      content = content
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\xa0/g, '\\\\xa0');
    }

    let parsed_data = {};
    try {
      parsed_data = JSON.parse(content);
    } catch (e) {
      console.error('DataViz: (!) Cannot parse data', e);
    }

    result_object = parsed_data;
    console.log('DataViz: Backend visualizer object', result_object);

    return result_object;
  }

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Remove table
  -----------------------------------------------------------------------------------------------------*/
  public async pythonRemoveTable(table: string) {
    const codeToRun = 'del ' + table;
    console.log('Request expression', codeToRun);

    // Execute code and save the result. The last parameter is a mapping from the python variable to the javascript object
    const result = await Backend.sendKernelRequest(
      this._currentNotebook.sessionContext.session.kernel,
      codeToRun,
      {}
    );

    console.log('Result', result);
  }

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Import library with given statment
  -----------------------------------------------------------------------------------------------------*/
  public async pythonImportLibraries(importStatement: string) {
    // Execude the import in the kernel
    await Backend.sendKernelRequest(
      this._currentNotebook.sessionContext.session.kernel,
      importStatement,
      {}
    );

    // Get content of first cell, which by convention is for the imports
    const importsCell = CellUtilities.getCell(this._currentNotebook.content, 0);
    const importsCellContent = importsCell.value.text;
    let importsCellNewContent = '';
    console.log('imports cell', importsCellContent);

    // If the cell is empty, write the imports
    if (importsCellContent === '') {
      importsCellNewContent = importStatement;
      CellUtilities.insertRunShow(
        this._currentNotebook,
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

    console.log('imports cell new content', importsCellNewContent);

    // Write in the first cell
    //this._currentNotebook.content.model.cells.get(0).value.text = importsCellNewContent;
    //await CellUtilities.injectCodeAtIndex(this._currentNotebook.content, 0, importsCellNewContent);
  }

  // -------------------------------------------------------------------------------------------------------------
  // HANDLE CHANGE OF NOTEBOOK
  // -------------------------------------------------------------------------------------------------------------

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Update current notebook and create kernel connector
  -> Writes: _currentNotebook, _connector
  -----------------------------------------------------------------------------------------------------*/
  private async updateCurrentNotebook(sender: any, nbPanel: NotebookPanel) {
    console.log('------> Notebook changed', nbPanel.content.title.label);
    // Update the current notebook
    this._currentNotebook = nbPanel;

    // Creates a new way to connect to the Kernel in this notebook
    const session = this._currentNotebook.sessionContext;
    // Note: When an IOptions object is passed, need to look at the sourc code to see which variables this option has. If ther eis one, we can pass it with brackets and the same name
    // To-do: Not sure if at some point I need to drop all these connections
    this._connector = new KernelConnector({ session });

    // Basically if the connector is ready, should not have to worry about this
    this._connector.ready.then(() => {
      const content: KernelMessage.IExecuteRequestMsg['content'] = {
        code: this._initScripts,
        stop_on_error: false,
        store_history: false
      };
      this._connector
        .fetch(content, () => {})
        .then(() => {
          this.pythonRequestDataframes();
        });
    });

    // Connect to changes running in the code
    this._connector.iopubMessage.connect(this.codeRunningOnNotebook);

    /*----------------------------------------------
    Handle the case where the Kernel is restarted
    -----------------------------------------------*/
    this._connector.kernelRestarted.connect(
      (sender, kernelReady: Promise<void>) => {
        this._connector.ready.then(() => {
          // Flag to reset the frontend
          this._resetStateFormulabarFlag = true;
          this._resetStateDatavisualizerFlag = true;
          // Reset dataframes
          this.dataframesLoaded = [];
          this.packagesImported = [];
          this.variablesLoaded = [];

          // Restart init scripts
          const content: KernelMessage.IExecuteRequestMsg['content'] = {
            code: this._initScripts,
            stop_on_error: false,
            store_history: false
          };
          this._connector
            .fetch(content, () => {})
            .then(() => {
              // Emit signal to re-render the component
              this.signal.emit();
            });
        });
      }
    );

    // Need to re-render so that the output function in the button has the latest version of
    // the current notebook. Probably there is a better way of doing this.
    this.signal.emit();
  }

  // -------------------------------------------------------------------------------------------------------------
  // HANDLE CODE RUNNING IN NOTEBOOK
  // -------------------------------------------------------------------------------------------------------------

  // Overview: codeRunningOnNotebook ->  pythonRequestDataframes -> handleGetDataframesResponse

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Get list of dataframes through reqeuestDataframes when new code runs
  -> Returns: None
  -----------------------------------------------------------------------------------------------------*/
  private codeRunningOnNotebook = (
    sess: ISessionContext,
    msg: KernelMessage.IExecuteInputMsg
  ) => {
    //console.log('------> Code running in the notebook');
    const msgType = msg.header.msg_type;
    switch (msgType) {
      case 'execute_input':
        const code = msg.content.code;
        // Check this is not my code running
        if (
          !(code == this.kernelInspectorRequest) &&
          !(code == this._initScripts) &&
          !(code == this._codeToIgnore)
        ) {
          console.log('Non-internal code running');
          this.pythonRequestDataframes();
        }
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
    console.log('------> Get dataframe list');
    const content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: this.kernelInspectorRequest,
      stop_on_error: false,
      store_history: false
    };
    this._connector.fetch(content, this.handleGetDataframesResponse);
  }

  /*----------------------------------------------------------------------------------------------------
  [FUNCTION] Send request to the Kernel to get dataframes, processed with handleGetDataframesResponse
  -> Writes: dataframesLoaded
  -----------------------------------------------------------------------------------------------------*/
  private handleGetDataframesResponse = (
    response: KernelMessage.IIOPubMessage
  ): void => {
    //console.log('------> Handle inspector request');
    const message_type = response.header.msg_type;
    if (message_type === 'execute_result') {
      const payload: any = response.content;
      let content: string = payload.data['text/plain'] as string;

      // The resulting python JSON neets to be cleaned
      if (content.slice(0, 1) == "'" || content.slice(0, 1) == '"') {
        content = content.slice(1, -1);
        content = content.replace(/\\"/g, '"').replace(/\\'/g, "'");
      }

      const kerneldata = JSON.parse(content);
      //console.log('Kernel Inspector: Result', kerneldata)
      const dataframes = kerneldata['ed_get_dfs'];
      //console.log('Number of dataframes:', dataframes.length);

      const variables = kerneldata['ed_get_nondf_variables'];

      if (variables.length > 0) {
        this.variablesLoaded = variables;
      }

      if (dataframes.length == 0) {
        // If there is no data loaded, reset frontend component
        this._resetStateFormulabarFlag = true;
        this._resetStateDatavisualizerFlag = true;
      } else {
        console.log('Refreshing dataframes');
        const dataframe_list: Array<any> = [];
        // Note: Just trying to make an array so that I can iterate here
        (dataframes as Array<any>).forEach((item, index) => {
          //console.log(item, index);
          const dataframe_item = {
            value: item,
            label: item
          };
          dataframe_list.push(dataframe_item);
        });

        this.dataframesLoaded = dataframe_list;
        this.packagesImported = kerneldata['ed_get_imported_modules'];
      }
      // Emit signal to re-render the component
      this.signal.emit();
    }
  };
}
