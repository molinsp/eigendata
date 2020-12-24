import {
  Dialog,
  ISessionContext,
  ReactWidget,
  showDialog,
  UseSignal
} from '@jupyterlab/apputils';

import React, { useEffect, useState } from 'react';

import Form from '@rjsf/core';

import Select from 'react-select';

import { JSONSchema7 } from 'json-schema';

import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';

import { Kernel, KernelMessage } from '@jupyterlab/services';

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
import QueryBuilder from './querybuilder';

// Feedback buttons library
import { BinaryFeedback } from 'react-simple-user-feedback';

import 'bootstrap/dist/css/bootstrap.css';

// Usage analytics
import amplitude from 'amplitude-js';

import { generatePythonCode } from './code_generation';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import ChatWidget from '@papercups-io/chat-widget';

import ReactGA from 'react-ga';

// Thumbs svg for feedback buttons
import { magnifier, tableIcon, thumbDown, thumbUp } from './assets/svgs';
import { formulabarMainSelect } from './styles/reactSelectStyles';

import Joyride from 'react-joyride';

// Before deploying to production, we change this flag
const packageVersion = '0.2.0';
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

  // Separate state for feedback buttons (for to not expand the common state)
  const [feedbackState, setFeedbackState] = useState({
    negativeDescription: '',
    submittedTransformation: null
  });

  // Hide feedback buttons if there is transformation or query builder form
  useEffect((): void => {
    if (state.showForm || state.queryConfig) {
      setFeedbackState({ ...feedbackState, submittedTransformation: null });
    }   
  }, [state.showForm, state.queryConfig]);

  /*-----------------------------------
  PRODUCT TOUR
  -----------------------------------*/
  const [productTourState, setProductTourState] = useState({
    run: false
  });

  const productTourSteps = [
    {
      content: (
        <div>
          <p>This is the magic formula bar, your gateway to data superpowers</p>
        </div>
        ),
      target: '.data-transformation-form',
      // Remove beacon with circle to enable autostart
      disableBeacon: true,
      placement: 'bottom-start' as 'bottom-start'
    },
    {
      content: 'On the left you select which dataset you want to transform',
      target: '#dataselect',
      // Remove beacon with circle to enable autostart
      disableBeacon: true
    },
    {
      content: (
        <div>
          <p>On the right you search for data transformations.</p> 
          <p>We will start by loading a csv file.</p>
        </div>
        ),
      target: '#transformationselect',
      // Remove beacon with circle to enable autostart
      disableBeacon: true
    },
    {
      content: 'Here is where you enter the parameters, like the csv file name.',
      target: '#root_filepath_or_buffer',
      // Remove beacon with circle to enable autostart
      disableBeacon: true
    },
    {
      content: (
        <div>
          <p>To get the name of the csv files, you can use the file browser on the left.</p> 
          <p>You can also hide it by clicking the browser icon</p>
        </div>
        ),
      target: '#filebrowser',
      // Remove beacon with circle to enable autostart
      disableBeacon: true,
      placement: 'left' as 'left'
    },
    {
      content: 'After entering the file-name, press Submit to run your transformations.',
      target: '.btn-info',
      // Remove beacon with circle to enable autostart
      disableBeacon: true
    },
    {
      content: (
        <div>
          <p>The data will be displayed in the data visualizer.</p> 
          <p>Enjoy your data.</p>
        </div>
        ),
      target: '.full-height-container',
      // Remove beacon with circle to enable autostart
      disableBeacon: true,
      placement: 'left' as 'left'
    }
  ];

  /*-----------------------------------
  RESET STATE LOGIC: Backend triggers FE reset
  -----------------------------------*/
  if (logic._resetStateFormulabarFlag === true) {
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

    // This starts the product tour. It's here because it needs to load after the rest of the lements
    if(logic.completedProductTour == false){
      setProductTourState({run:true});
      // Change the settings for it not to run next time (next refresh)
      logic.eigendataSettings.set('completedProductTour', true);
      // Set to true for it not to run again in the current session
      logic.completedProductTour = true;
    }
  }

  /*-----------------------------------
  Custom search for transformations
  -----------------------------------*/
  const getKeywordsForFilter = (option, rawInput) => {
    // Add keywords to search
    let keywords = '';
    if (option.value === 'query') {
      // Query is handled differently
      keywords = ['filter', 'more', 'less', 'equal'].join(' ');
    } else if (option.value === 'notfound') {
      return true;
    } else if (logic._transformationsConfig[option.value]['keywords']) {
      keywords = logic._transformationsConfig[option.value]['keywords'].join(
        ' '
      );
    }

    const textToSearch =
      option.label + ' ' + keywords + ' ' + option.value.replace(/_/g, ' ');

    const words = rawInput.split(' ');
    return words.reduce(
      (acc, cur) =>
        acc && textToSearch.toLowerCase().includes(cur.toLowerCase()),
      true
    );
  };

  /*-----------------------------------
  CUSTOM SELECT: Use React select with JSONschema form
  -----------------------------------*/
  // Inspired by example here https://codesandbox.io/s/13vo8wj13?file=/src/formGenerationEngine/Form.js
  // To-do: Move custom components to separate files
  const CustomSelect = function(props: any): JSX.Element {
    //console.log('Props custom select: ', props);

    const processSingleSelect = (selection: any): any => {
      const { value } = selection;
      return value;
    };

    const processMultiSelect = (selection: any): any => {
      // Handle the case when the user removes selections
      if (selection === null) {
        return [];
      }

      return selection.map((item: any) => item.value);
    };

    // If defined as array, use the multi-select
    if (props.schema.type === 'array') {
      return (
        <Select
          options={props.options.enumOptions}
          onChange={(selection): void =>
            props.onChange(processMultiSelect(selection))
          }
          isMulti={true}
        />
      );
    } else {
      return (
        <Select
          options={props.options.enumOptions}
          onChange={(selection): void =>
            props.onChange(processSingleSelect(selection))
          }
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
  const handleFormChange = async (data: any): Promise<void> => {
    /*-------------------------------
     MERGE
     -------------------------------*/
    if (
      data.schema.function === 'merge' &&
      // Do not trigger this when another parameter is set
      typeof data.formData['right'] !== 'undefined' &&
      // Only trigger if the state does not have the data (undefined) or if the state has different data (selected another right)
      (typeof state.formData['right'] === 'undefined' ||
        data.formData['right'] !== state.formData['right'])
    ) {
      console.log('Dynamic forms: Changed right in merge');
      // Get the columns from the backend
      const columns = await logic.pythonGetDataframeColumns(
        data.formData['right']
      );
      // Perform deep copy of the object, otherwise it does not re-render
      const newState = _.cloneDeep(state.transformationForm);
      // Add the queried columns to the state
      newState['definitions']['right_columns']['items']['enum'] = columns;
      setState(state => ({
        ...state,
        transformationForm: newState,
        formData: data.formData,
        error: null
      }));
    }
  };

  // Save the input of the Dataframe selection in the UI to the state
  const handleDataframeSelectionChange = (input: any): void => {
    //console.log(this);
    if (state.transformationSelection) {
      console.log('Formulabar: get transformation to state');
      getTransformationFormToState(input, state.transformationSelection);
    } else {
      setState(state => ({ ...state, dataframeSelection: input, error: null }));
    }
  };

  // Save the input of the transformation selection in the UI to the state
  const handleTransformationSelectionChange = (input: any): void => {
    // Event tracking
    if (logic._production && logic.shareProductData) {
      amplitude.getInstance().logEvent('Formulabar: select transformation', {
        userSelection: input.value
      });
    }
    if (state.dataframeSelection) {
      console.log('all defined');
      getTransformationFormToState(state.dataframeSelection, input);
    } else if (
      logic._transformationsConfig[input.value]['form'][
        'transformationType'
      ] === 'dataLoading' ||
      input.value === 'notfound'
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

  // Populates the transformation form into the state
  const getTransformationFormToState = async (
    dataframeSelection: any,
    transformationSelection: any
  ): Promise<void> => {
    if (transformationSelection.value.localeCompare('query') === 0) {
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
        ...state,
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
  const callGeneratePythonCode = async (formResponse: any): Promise<void> => {
    console.log('SUBMIT WAS PRESSED');
    /*-----------------------------------------------
    Handle not found case
    -----------------------------------------------*/
    // Add submitted transformation to the feedback state
    setFeedbackState({
      ...feedbackState,
      submittedTransformation: state.transformationSelection
    });

    if (state.transformationSelection.value === 'notfound') {
      // Remove transformation selection and hide form
      setState(state => ({
        ...state,
        transformationSelection: null,
        showForm: false,
        error: null
      }));

      //console.log('Loge event', formResponse.formData.description);
      // Log event
      if (logic._production && logic.shareProductData) {
        amplitude.getInstance().logEvent('Formulabar: request transformation', {
          userRequest: formResponse.formData.description
        });
      }

      return;
    }

    /*-----------------------------------------------
    Generate formula
    -----------------------------------------------*/

    let dataframeSelection: string;
    if (state.dataframeSelection) {
      dataframeSelection = state.dataframeSelection.value;
    } else {
      dataframeSelection = null;
    }
    const { formula, result_variable, returnType } = generatePythonCode(
      formResponse,
      dataframeSelection
    );

    /*-----------------------------------------------
    Tracking in amplitude
    -----------------------------------------------*/
    if (logic._production && logic.shareProductData) {
      amplitude.getInstance().logEvent('Formulabar: submit transformation', {
        function: formResponse.schema.function,
        formInput: formResponse.formData,
        generatedCode: formula
      });
    }
    /*-----------------------------------------------
    Import libraries if needed
    -----------------------------------------------*/
    const library =
      logic._transformationsConfig[formResponse.schema.function]['library'];

    // Check if the library is already imported or not
    if (logic.packagesImported.includes(library['name'])) {
      console.log('CG: Package already imported');
    } else {
      console.log(
        'CG: Not importes, using statement',
        library['importStatement']
      );

      try {
        await logic.pythonImportLibraries(library['importStatement']);
      } catch (error) {
        console.log(error);
      }
    }

    /*-----------------------------------------------
    Generate & execute code
    -----------------------------------------------*/

    try {
      await logic.writeToNotebookAndExecute(formula);
      // Write and execute the formula in the notebook
      if (returnType === 'dataframe') {
        setState(state => ({
          ...state,
          dataframeSelection: {
            label: result_variable,
            value: result_variable
          },
          transformationSelection: null,
          showForm: false,
          error: null
        }));
      } else {
        setState(state => ({
          ...state,
          transformationSelection: null,
          showForm: false,
          error: null
        }));
      }
    } catch (error) {
      // Log transformation errors
      if (logic._production && logic.shareProductData) {
        amplitude.getInstance().logEvent('Formulabar: transformation error', {
          function: formResponse.schema.function,
          formInput: formResponse.formData,
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

  // Content of feedback buttons
  const getFeedBackContent = (
    thumb: JSX.Element,
    text: string,
    textColor: string
  ): JSX.Element => {
    return (
      <div className="feedback__content">
        {thumb}
        <p
          className="full-width  feedback__buttons-text"
          style={{ color: textColor }}
        >
          {text}
        </p>
      </div>
    );
  };

  // Action when click "Worked" button
  const onNegativeClick = (): void => {
    console.log('Logged: ', feedbackState.submittedTransformation.value);
    // Log result
    if (logic._production && logic.shareProductData) {
      amplitude
        .getInstance()
        .logEvent('Formulabar: transformation did not work', {
          transformation: feedbackState.submittedTransformation.value
        });
    }
    // Show the block with text input
    const elem = document.getElementById('feedback__negative-description');
    elem.className = 'show_flex';
  };

  // Action when click "Didn't work" button
  const onPositiveClick = (): void => {
    console.log('Logged: ', feedbackState.submittedTransformation.value);
    // Log result
    if (logic._production && logic.shareProductData) {
      amplitude.getInstance().logEvent('Formulabar: transformation worked', {
        transformation: feedbackState.submittedTransformation.value
      });
    }
    // Hide the feedback buttons
    setFeedbackState({ ...feedbackState, submittedTransformation: null });
  };

  // Action when click "Submit" in the block for negative description
  const onSubmitDescription = (e): void => {
    e.preventDefault();
    const text = feedbackState.negativeDescription;
    console.log('Logged: ', feedbackState.submittedTransformation.value, text);
    // Log result
    if (logic._production && logic.shareProductData) {
      amplitude
        .getInstance()
        .logEvent('Formulabar: transformation did not work', {
          transformation: feedbackState.submittedTransformation.value,
          description: text
        });
    }
    // Hide the feedback buttons and clear text input content
    setFeedbackState({
      submittedTransformation: null,
      negativeDescription: ''
    });
  };

  // Update feedback state when type something in the text input
  const onTextChange = (e): void => {
    setFeedbackState({ ...feedbackState, negativeDescription: e.target.value });
  };

  return (
    <div className="app">
      <Joyride 
          steps={productTourSteps}
          continuous={true}
          run={productTourState.run}
          hideBackButton={true}
          disableScrollParentFix={true}
          showSkipButton={true}
          locale={{ back: 'Back', close: 'Close', last: 'Finish', next: 'Next', skip: 'Skip' }}
          styles={{
            options: {
              zIndex: 1000,
              primaryColor: '#3698DC'
              }
          }}
        />
      <div className="side-by-side-fields">
        <div className="centered">
        </div>
        <fieldset className="data-transformation-form">
          <Select
            name="Select dataframe"
            placeholder="No data"
            options={logic.dataframesLoaded}
            value={state.dataframeSelection}
            label="Select data"
            onChange={handleDataframeSelectionChange}
            className="left-field"
            id="dataselect"
            components={{
              DropdownIndicator: (): JSX.Element => tableIcon,
              IndicatorSeparator: (): null => null
            }}
            styles={formulabarMainSelect}
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
              DropdownIndicator: (): JSX.Element => magnifier,
              IndicatorSeparator: (): null => null
            }}
            id="transformationselect"
            filterOption={getKeywordsForFilter}
            maxMenuHeight={400}
            styles={formulabarMainSelect}
          />
        </fieldset>
        <div className="centered formulaFormDivider" />
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
          <QueryBuilder
            queryConfig={state.queryConfig}
            dataframeSelection={state.dataframeSelection.value}
            backend={logic}
          />
        )}
        {/* If transformation was submit show the feedback buttons */}
        {feedbackState.submittedTransformation && (
          <form id="feedback" onSubmit={onSubmitDescription}>
            <div id="feedback__buttons">
              <BinaryFeedback
                onPositiveClick={onPositiveClick}
                onNegativeClick={onNegativeClick}
                positiveContent={getFeedBackContent(thumbUp, 'Worked', '#93C47d')}
                negativeContent={getFeedBackContent(
                  thumbDown,
                  "Didn't work",
                  '#E06666'
                )}
                singleSelect
              />
            </div>
            <div id="feedback__negative-description">
              <input
                placeholder="Share the issue so we can fix it!"
                type="text"
                className="short form-control margin-right"
                onChange={onTextChange}
              />
              <input
                type="submit"
                className="short btn btn-info"
                disabled={feedbackState.negativeDescription === ''}
              />
            </div>
          </form>
        )}
        <div>
          <ChatWidget
            // Pass in your Papercups account token here after signing up
            accountId="784f140c-6c85-4613-bfd0-9869026cd1cb"
            title="Welcome to Eigendata"
            subtitle="We are here to help you become a data superhero"
            newMessagePlaceholder="Start typing..."
            primaryColor="#13c2c2"
          />
        </div>
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

        this.completedProductTour = settings.get('completedProductTour').composite as boolean;
        console.log('Settings: completedProductTour', this.completedProductTour);
        
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
