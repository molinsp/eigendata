import { ReactWidget, UseSignal } from '@jupyterlab/apputils';

import React, { useState } from 'react';

import Form from '@rjsf/core';

import Select from 'react-select';

import { JSONSchema7 } from 'json-schema';

import { NotebookPanel, INotebookTracker } from '@jupyterlab/notebook';

import { KernelMessage, Kernel } from '@jupyterlab/services';

import { ISessionContext, Dialog, showDialog } from '@jupyterlab/apputils';

import { ISignal, Signal } from '@lumino/signaling';

// JSON configuration holding all information for the UI transformationsList
import localTransformationsConfig from './transformations.json';

// Initialization scripts. See file for more details.
import { python_initialization_script } from './initscript';

// KernelConnector class. See file for more details.
import { KernelConnector } from './kernelconnector';

// Utilities from another project. See file for more details.
import CellUtilities from './CellUtilities';

// This is used to force refresh the form schema for dynamic forms with react-jsonschema-form
import _ from 'lodash';

// Awesome querybuilder
import Demo from './querybuilder';
//import QueryBuilder from 'react-querybuilder';

import 'bootstrap/dist/css/bootstrap.css';

// Usage analytics
import amplitude from 'amplitude-js';

import { generatePythonCode } from './code_generation';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import ChatWidget from '@papercups-io/chat-widget';

// Before deploying to production, we change this flag
const packageVersion = '0.1.9';
let _transformationsConfig = localTransformationsConfig;

/*
 Description: This extension provides a GUI over pandas data transformationsList, with the goal of facilitating the use by non experts
 Components:
   1.  REACT GUI
       - Form code generator: A function that takes the form input and generates+executes the code in the notebook
   2.  BACKEND LOGIC
       - Variable tracker: There is a set of functions that keeps track of what dataframes are in the kernel
         The variable tracker takes the form of a set of Python scripts that are rendered to python
       - Functions that execute code agains the Python Kernel
*/

// -------------------------------------------------------------------------------------------------------------
// 1. REACT GUI
// -------------------------------------------------------------------------------------------------------------

/**
 React component that renders forms based on JSON
 Inputs from the backend:
   Functions:
     - getTransformationFormSchema: Gets the transformation form from the backend
     - pythonGetDataframeColumns: Used to update the forms dynamically
   Properties:
     - dataframesLoaded: Available dataframes
     - transformationsList: Available transformationsList
 */
// Component takes props with the main class (FormWidget) that handles all the logic, communication with kernel etc.
const FormComponent = (props: { logic: Backend }): JSX.Element => {
  // Access backend class through logic object
  const logic = props.logic;

  // Defaults for form and UI schema
  const transformationForm: JSONSchema7 = logic._transformationsConfig[
    'read_csv'
  ]['form'] as JSONSchema7;
  const defaultUISchema: JSONSchema7 = logic._transformationsConfig['read_csv'][
    'uischema'
  ] as JSONSchema7;
  const defaultTransformationSelection = {
    value: 'read_csv',
    label: 'Read CSV'
  };

  const loadingTransformations = () => {
    const result = [];

    _.forIn(logic._transformationsConfig, (value, key) => {
      if (value['form']['transformationType'] === 'dataLoading') {
        result.push({ value: key, label: value['form']['title'] });
      }
    });

    return result;
  };

  /* State of the component:
      - Transformation form
      - UI schema
      - Show or not show form: If we don't have both dataframe and transformation selected, we don't show the form
      - DataFrame selection
      - Transformation selection
  */
  const [state, setState] = useState({
    transformationForm: transformationForm,
    transformationUI: defaultUISchema,
    showForm: false,
    dataframeSelection: null,
    transformationSelection: null,
    formData: {},
    queryConfig: null,
    error: null
  });

  /*-----------------------------------
  RESET STATE LOGIC: Backend triggers FE reset
  -----------------------------------*/
  if (logic._resetStateFormulabarFlag == true) {
    console.log('RESETING FORMULABAR STATE');
    setState({
      transformationForm: transformationForm,
      transformationUI: defaultUISchema,
      showForm: true,
      dataframeSelection: null,
      transformationSelection: defaultTransformationSelection,
      formData: {},
      queryConfig: null,
      error: null
    });

    logic._resetStateFormulabarFlag = false;
  }

  console.log('FB: State:', state);
  console.log('------> FB: Rendering Formulabar UI');

  /*-----------------------------------
  CUSTOM SELECT: Use React select with JSONschema form
  -----------------------------------*/
  // Inspired by example here https://codesandbox.io/s/13vo8wj13?file=/src/formGenerationEngine/Form.js
  // To-do: Move custom components to separate files
  const CustomSelect = function(props: any) {
    console.log('Props custom select: ', props);

    const processSingleSelect = (selection: any) => {
      const { value } = selection;
      //console.log('Signle select change', selection);
      return value;
    };

    const processMultiSelect = (selection: any) => {
      // Handle the case when the user removes selections
      if (selection === null) {
        //console.log('Return null');
        return [];
      }

      const result = selection.map((item: any) => item.value);
      //console.log('Result from selection',result);
      return result;
    };

    // If defined as array, use the multi-select
    if (props.schema.type === 'array') {
      return (
        <Select
          options={props.options.enumOptions}
          onChange={selection => props.onChange(processMultiSelect(selection))}
          isMulti={true}
        />
      );
    } else {
      return (
        <Select
          options={props.options.enumOptions}
          onChange={selection => props.onChange(processSingleSelect(selection))}
          //Default value is a dict {value: "", label: ""} and thus the need to filter from the available options
          //defaultValue={props.value}
          defaultValue={props.options.enumOptions.filter(
            (option: any) => option.value === props.value
          )}
        />
      );
    }
  };

  // Add the behavior described above
  const widgets = {
    SelectWidget: CustomSelect
  };

  // UPDATE FORMS DYNAMICALLY, i.e. when the input of a form field changes, the form itself changes
  const handleFormChange = async (data: any) => {
    console.log('Form data changed', data);
    /*-------------------------------
     MERGE
     -------------------------------*/
    // By selecting the right parameter, we get the options for the right_on

    if (
      data.schema.function === 'merge' &&
      typeof data.formData['right'] !== 'undefined'
    ) {
      console.log('-> Changed right in merge');
      // Get the columns from the backend
      const columns = await logic.pythonGetDataframeColumns(
        data.formData['right']
      );
      // Perform deep copy of the object, otherwise it does not re-render
      const new_state = _.cloneDeep(state.transformationForm);
      // Add the queried columns to the state
      new_state['definitions']['right_columns']['items']['enum'] = columns;
      setState(state => ({
        ...state,
        transformationForm: new_state,
        formData: data.formData,
        error: null
      }));
    }
  };

  // Save the input of the Dataframe seleciton in the UI to the state
  const handleDataframeSelectionChange = (input: any) => {
    //console.log(this);
    if (state.transformationSelection) {
      console.log('all defined');
      getTransformationFormToState(input, state.transformationSelection);
    } else {
      setState(state => ({ ...state, dataframeSelection: input, error: null }));
    }
  };

  // Save the input of the transformation seleciton in the UI to the state
  const handleTransformationSelectionChange = (input: any) => {
    console.log('Transformatino', input);
    // Event tracking
    if (logic._production && logic.shareProductData) {
      amplitude.getInstance().logEvent('Formulabar: select transformation', { userSelection: input.value });
    }

    if (state.dataframeSelection) {
      console.log('all defined');
      getTransformationFormToState(state.dataframeSelection, input);
    } else if (
      logic._transformationsConfig[input.value]['form'][
        'transformationType'
      ] === 'dataLoading'
    ) {
      console.log('Data loading transformation');
      setState(state => ({
        ...state,
        transformationForm: logic._transformationsConfig[input.value]['form'],
        transformationUI: logic._transformationsConfig[input.value]['uischema'],
        transformationSelection: input,
        showForm: true,
        formData: {},
        error: null
      }));
    } else {
      setState(state => ({
        ...state,
        transformationSelection: input,
        formData: {},
        error: null
      }));
    }
  };

  // Pupulates the transformation form into the state
  const getTransformationFormToState = async (
    dataframeSelection: any,
    transformationSelection: any
  ) => {
    // Querybuilder placeholder
    if (transformationSelection.value.localeCompare('query') == 0) {
      console.log('Querybuilder');
      const queryConfig = await logic.pythonGenerateQuerybuilderConfig(
        dataframeSelection.value
      );
      setState(state => ({
        ...state,
        queryConfig: queryConfig,
        showForm: false,
        dataframeSelection: dataframeSelection,
        transformationSelection: transformationSelection,
        formData: {},
        error: null
      }));
    } else {
      // STANDARD behavior
      const newFormSchema = await logic.getTransformationFormSchema(
        dataframeSelection.value,
        transformationSelection.value
      );
      const newUISchema = logic.getTransfromationUISchema(
        transformationSelection.value
      );
      setState({
        transformationForm: newFormSchema,
        transformationUI: newUISchema,
        showForm: true,
        dataframeSelection: dataframeSelection,
        transformationSelection: transformationSelection,
        queryConfig: null,
        formData: {},
        error: null
      });
    }
  };

  // Generate python code and write in the notebook
  const callGeneratePythonCode = async (formReponse: any) => {
    // Track submitted transformations
    let dataframeSelection: string;
    if (state.dataframeSelection) {
      dataframeSelection = state.dataframeSelection.value;
    } else {
      dataframeSelection = null;
    }
    const formula = generatePythonCode(formReponse, dataframeSelection);
    if (logic._production && logic.shareProductData) {
      amplitude.getInstance().logEvent('Formulabar: submit transformation', {
        function: formReponse.schema.function,
        formInput: formReponse.formData,
        generatedCode: formula,
      });
    }
    try {
      await logic.writeToNotebookAndExecute(formula);
      // Write and execute the formula in the notebook
      setState(state => ({
        ...state,
        transformationSelection: null,
        showForm: false,
        error: null
      }));
    } catch (error) {
      if (logic._production && logic.shareProductData) {
        amplitude.getInstance().logEvent('Formulabar: transformation error', {
          function: formReponse.schema.function,
          formInput: formReponse.formData,
          generatedCode: formula,
          errorMessage: error.message
        });
      }
      console.log('Error in submit', error);
      setState(state => ({
        ...state,
        error: error
      }));
    }
  };

  /*--------------------------------------
  SELECT TRANSFORMATION: When data loaded
  ---------------------------------------*/
  // To-do: Add button to load data even in this case

  const extraErrors = state.error
    ? { form: { __errors: [state.error.message] } }
    : undefined;

  return (
    <div className="side-by-side-fields">
      <fieldset className="data-transformation-form">
        <Select
          name="Select dataframe"
          placeholder="No data loaded"
          options={logic.dataframesLoaded}
          value={state.dataframeSelection}
          label="Select data"
          onChange={handleDataframeSelectionChange}
          className="left-field"
        />
        <Select
          name="Select transformation"
          placeholder="select data loading transformation"
          options={
            logic.dataframesLoaded.length !== 0
              ? logic.transformationsList
              : loadingTransformations()
          }
          value={state.transformationSelection}
          label="Select transformation"
          onChange={handleTransformationSelectionChange}
          className="right-field"
          components={{
            DropdownIndicator: () => null,
            IndicatorSeparator: () => null
          }}
        />
      </fieldset>
      {state.showForm && (
        <Form
          formData={state.formData}
          schema={state.transformationForm}
          onSubmit={callGeneratePythonCode}
          onChange={handleFormChange}
          widgets={widgets}
          uiSchema={state.transformationUI}
          extraErrors={extraErrors}
        />
      )}
      {state.queryConfig && (
        <Demo
          queryConfig={state.queryConfig}
          dataframeSelection={state.dataframeSelection.value}
          backend={logic}
        />
      )}
      <div>
      <ChatWidget
        // Pass in your Papercups account token here after signing up 
        accountId='784f140c-6c85-4613-bfd0-9869026cd1cb'
        title='Welcome to Eigendata'
        subtitle='We are here to help you become a data superhero'
        newMessagePlaceholder='Start typing...'
        primaryColor='#13c2c2'
      />
      </div>
    </div> 
  );
};

// This allows to re-render the component whene there is a signal emitted (Read about signals here https://jupyterlab.readthedocs.io/en/stable/developer/patterns.html)
// This is the recommended approach from the Jupyter team: https://jupyterlab.readthedocs.io/en/stable/developer/virtualdom.html
// Inspired by this example: https://github.com/jupyterlab/jupyterlab/blob/master/docs/source/developer/virtualdom.usesignal.tsx
// ...and this example: https://github.com/jupyterlab/jupyterlab/blob/f2e0cde0e7c960dc82fd9b010fcd3dbd9e9b43d0/packages/running/src/index.tsx#L157-L159
function UseSignalComponent(props: {
  signal: ISignal<Backend, void>;
  logic: Backend;
}) {
  return (
    <UseSignal signal={props.signal}>
      {() => <FormComponent logic={props.logic} />}
    </UseSignal>
  );
}

// Class that acts as a wrapper for rendering React in jupyter (based on the react jupyterlab extension example )
export class FormWidget extends ReactWidget {
  private _backend = null;

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
  // Render
  render(): JSX.Element {
    return (
      <UseSignalComponent signal={this._backend.signal} logic={this._backend} />
    );
  }
}

// -------------------------------------------------------------------------------------------------------------
// 2. BACKEND LOGIC
// -------------------------------------------------------------------------------------------------------------
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

  // Data transformation functions
  public transformationsList = [];

  // Flag to decide if we are going to share product data
  public shareProductData;

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

    const readTransformationConfig = () => {
      this._transformationsConfig = _transformationsConfig['transformations'];
      console.log(
        'TRANSFORMATIONS VERSION:',
        _transformationsConfig['version']
      );
      const transformationList = [
        { value: 'query', label: 'Filter/Query dataframe' }
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

    readTransformationConfig();

    if (this._production) {
      console.log('--- In Production environment ---');
      const myHeaders = new Headers();
      myHeaders.append(
        'Authorization',
        'Bearer yO2g8OCpvl45o4F93O4nxNsrPjCvYHcMTBiPvzU7pR0'
      );
      const requestOptions = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow'
      };
      fetch(
        'https://eigendata-auth.herokuapp.com/transformations.json',
        //@ts-ignore
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
    }

    // Load python initialization script
    this._initScripts = python_initialization_script;

    /*------------------------------
      Get user consent for analytics
    -------------------------------*/
    settingRegistry.load('@molinsp/eigendata:plugin').then(
      (settings: ISettingRegistry.ISettings) => {
        if (settings.get('answeredProductDataDialog').composite == false) {
          showDialog({
            title: 'Welcome to Eigendata',
            body:
              'Eigendata captures anonymous product data using cookies. If you wish, you can opt-out by selecting reject.',
            buttons: [
              Dialog.okButton({ label: 'Accept' }),
              Dialog.cancelButton({ label: 'Reject' })
            ]
          })
            .catch(e => console.log(e))
            .then((result: any) => {
              settings.set('answeredProductDataDialog', true);
              const clickedButtonLabel = result.button.label;
              console.log('Analytics: Clicked', clickedButtonLabel);
              if (clickedButtonLabel == 'Accept') {
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

        console.log('Analytics: Product tracking data', this.shareProductData);
        // Tracking setup
        if (this._production && this.shareProductData) {
          amplitude.getInstance().init('c461bfacd2f2ac406483d90c01a708a7');
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

  // Returns a json object with all the dataframes
  private _inspectorScript = 'ed_variableinspector_dict_list()';

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
      console.log('----> No transformation found');
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
          console.log('Transformation needs columns');
          const request_expression =
            'form = ed_get_json_column_values(' + dataFrameSelection + ')';
          // Save it so that we can avoid triggering the pythonRequestDataframes function
          this._codeToIgnore = request_expression;
          console.log('Form request expression', request_expression);
          const result = await Backend.sendKernelRequest(
            this._currentNotebook.sessionContext.session.kernel,
            request_expression,
            { form: 'form' }
          );
          let content = result.form.data['text/plain'];

          // The resulting python JSON neets to be cleaned
          if (content.slice(0, 1) == "'" || content.slice(0, 1) == '"') {
            content = content.slice(1, -1);
            content = content.replace(/\\"/g, '"').replace(/\\'/g, "'");
          }

          const columns = JSON.parse(content);
          console.log('Retrieved columns:', columns);

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
      console.log('No transformation form defined');
      return;
    } else {
      if (
        typeof this._transformationsConfig[transformationSelection][
          'uischema'
        ] !== 'undefined'
      ) {
        return this._transformationsConfig[transformationSelection]['uischema'];
      } else {
        console.log('No transformation uischema defined');
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
      'form = ed_get_json_column_values(' + rightParameter + ')';
    // Flag as code to ignore avoid triggering the pythonRequestDataframes function
    this._codeToIgnore = codeToRun;
    console.log('Request expression', codeToRun);

    // Execute code and save the result. The last parameter is a mapping from the python variable to the javascript object
    const result = await Backend.sendKernelRequest(
      this._currentNotebook.sessionContext.session.kernel,
      codeToRun,
      { form: 'form' }
    );
    // Retriev the data behind the javascript object where the result is saved
    let content = result.form.data['text/plain'];

    // Clean the JSON result that python returns
    if (content.slice(0, 1) == "'" || content.slice(0, 1) == '"') {
      content = content.slice(1, -1);
      content = content.replace(/\\"/g, '"').replace(/\\'/g, "'");
    }

    const columns = JSON.parse(content);
    console.log('New columns', columns);

    return columns;
  }

  /*---------------------------------------------------------------------------------------------------- 
  [FUNCTION] Get the querybuilder configuration
  -> Returns: JSON object to pass to querybuiler
  -> Writes: _codeToIgnore
  -----------------------------------------------------------------------------------------------------*/
  public async pythonGenerateQuerybuilderConfig(dataframe: string) {
    const codeToRun =
      'queryconfig = ed_generate_querybuilder_config(' + dataframe + ')';
    // Flag as code to ignore avoid triggering the pythonRequestDataframes function
    this._codeToIgnore = codeToRun;
    console.log('Request expression', codeToRun);

    // Execute code and save the result. The last parameter is a mapping from the python variable to the javascript object
    const result = await Backend.sendKernelRequest(
      this._currentNotebook.sessionContext.session.kernel,
      codeToRun,
      { queryconfig: 'queryconfig' }
    );
    // Retriev the data behind the javascript object where the result is saved
    let content = result.queryconfig.data['text/plain'];

    // Clean the JSON result that python returns
    if (content.slice(0, 1) == "'" || content.slice(0, 1) == '"') {
      content = content.slice(1, -1);
      content = content.replace(/\\"/g, '"').replace(/\\'/g, "'");
    }

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
      '_visualizer_data = ed_prep_data_for_visualization(' + dataframe + ')';
    // Flag as code to ignore avoid triggering the pythonRequestDataframes function
    this._codeToIgnore = codeToRun;
    console.log('DataViz: Request expression', codeToRun);
    let result_object = {};

    // Execute code and save the result. The last parameter is a mapping from the python variable to the javascript object
    const result = await Backend.sendKernelRequest(
      this._currentNotebook.sessionContext.session.kernel,
      codeToRun,
      { data: '_visualizer_data', columns: '_visualizer_columns' }
    );

    let content = result.data.data['text/plain'];
    //console.log('DataViz content', content.slice(0,100));

    if (content.slice(0, 1) == "'" || content.slice(0, 1) == '"') {
      content = content.slice(1, -1);
      content = content.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\xa0/g,'\\\\xa0');
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
  [FUNCTION] Get list of columns from Kernel for selected dataframe
  -> Returns: Array of columns
  -> Writes: _codeToIgnore
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
    console.log('------> Code running in the notebook');
    const msgType = msg.header.msg_type;
    switch (msgType) {
      case 'execute_input':
        const code = msg.content.code;
        // Check this is not my code running
        if (
          !(code == this._inspectorScript) &&
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
      code: this._inspectorScript,
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
    console.log('------> Handle inspector request');
    const message_type = response.header.msg_type;
    if (message_type === 'execute_result') {
      const payload: any = response.content;
      let content: string = payload.data['text/plain'] as string;

      // The resulting python JSON neets to be cleaned
      if (content.slice(0, 1) == "'" || content.slice(0, 1) == '"') {
        content = content.slice(1, -1);
        content = content.replace(/\\"/g, '"').replace(/\\'/g, "'");
      }
      const dataframes = JSON.parse(content);
      console.log('Number of dataframes:', dataframes.length);
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
            value: item['varName'],
            label: item['varName']
          };
          dataframe_list.push(dataframe_item);
        });

        this.dataframesLoaded = dataframe_list;
      }
      // Emit signal to re-render the component
      this.signal.emit();
    }
  };
}
