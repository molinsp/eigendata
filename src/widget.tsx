import { ReactWidget, UseSignal } from '@jupyterlab/apputils';

import React, {useState} from 'react';

import Form from "@rjsf/core";

import Select from 'react-select';

import {JSONSchema7} from 'json-schema';

import { KernelConnector } from './kernelconnector';

import {NotebookPanel, INotebookTracker} from '@jupyterlab/notebook';

import { KernelMessage, Kernel } from '@jupyterlab/services';

import {ISessionContext} from "@jupyterlab/apputils";

import { ISignal, Signal } from '@lumino/signaling';

import _transformationsConfig from './transformations.json';

import {python_initialization_script} from './initscript';

import CellUtilities from './CellUtilities';

import _ from "lodash";

// Awesome querybuilder
import Demo from "./demo";
//import QueryBuilder from 'react-querybuilder';

import 'bootstrap/dist/css/bootstrap.css';

/*
 Description: This extension provides a GUI over pandas data transformations, with the goal of facilitating the use by non experts
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
     - getDataframeColumns: Used to update the forms dynamically 
     - pythonGenerateCodeAndRun: Generate the code from the form using python (to accelerate development)
   Properties:
     - dataframesLoaded: Available dataframes
     - transformations: Available transformations
     - screen: Screen to show to the user
 */
// Component takes props with the main class (FormWidget) that handles all the logic, communication with kernel etc.
const FormComponent = (props: {logic: Backend}): JSX.Element => {
  // Testing definig a UI schema for the form
  
  let logic = props.logic;
  let transformationForm: JSONSchema7 = _transformationsConfig['read_csv']['form'] as JSONSchema7;
  const defaultUISchema: JSONSchema7 = {};


  // State of the component
  const [state, setState] = useState({
      transformationForm: transformationForm,
      transformationUI: defaultUISchema,
      showForm: null,
      dataframeSelection: null,
      transformationSelection: null
    });

  console.log('State:', state);
  console.log('------> Rendering UI');


  /*-----------------------------------
  CUSTOM SELECT
  -----------------------------------*/
  // Inspired by example here https://codesandbox.io/s/13vo8wj13?file=/src/formGenerationEngine/Form.js
  // To-do: Move custom components to separate files
  const CustomSelect = function(props:any) {
    //console.log('Props custom select: ', props);

    const processSingleSelect = (selection: any) => {
      const {value} = selection;
      //console.log('Signle select change', selection);
      return value;
    };

    const processMultiSelect = (selection: any) => {
      // Handle the case when the user removes selections
      if (selection === null) {
        //console.log('Return null');
        return [];
      }
      console.log
      const result = selection.map((item: any) => item.value);
      //console.log('Result from selection',result);
      return result;
    };

    // If defined as array, use the multi-select
    if(props.schema.type === "array"){
       return (
        <Select options={props.options.enumOptions} 
          onChange= {selection => props.onChange(processMultiSelect(selection))}
          isMulti={true}
        />
      );

    }else{
      return (
        <Select options={props.options.enumOptions} 
          onChange= {selection => props.onChange(processSingleSelect(selection))}
          //Default value is a dict {value: "", label: ""} and thus the need to filter from the available options
          defaultValue={props.options.enumOptions.filter((option: any) => option.label === props.value)}
        />
      );
    }

  };

  // Define mapping of custom widgets
  const widgets = {
    SelectWidget: CustomSelect
  };

  // Handle changes in the form
  const handleFormChange = async (data:any) => {
    console.log('Form data changed', data);
     /*-------------------------------
        MERGE
     -------------------------------*/
     if(data.schema.function === 'merge' && typeof(data.formData['right']) !== 'undefined'){
       console.log('-> Changed right in merge')
       // Get the columns from the backend
       let columns = await logic.getDataframeColumns(data.formData['right']);
       // Perform deep copy of the object, otherwise it does not re-render
       let new_state = _.cloneDeep(state.transformationForm);
       // Add the queried columns to the state
       new_state["definitions"]["right_columns"]['items']['enum'] = columns;
       setState(state => ({...state,transformationForm : new_state}));
     }
     /*-------------------------------
        GET DUMMIES
     -------------------------------*/
     else if(data.schema.title === 'merge' && typeof(data.formData['right']) !== 'undefined'){

     }
   }

  // Process selection of table
  const handleDataframeSelectionChange = (input: any) => {
     //console.log(this);
     if(state.transformationSelection){
       console.log('all defined');
       getTransformationFormToState(input.value, state.transformationSelection);
     }else{
       setState(state => ({...state,dataframeSelection:input.value}));
     }
  }

   // Process selection of transformation
  const handleTransformationSelectionChange = (input: any) => {
     //console.log(input);
     if(state.dataframeSelection){
       console.log('all defined');
       getTransformationFormToState(state.dataframeSelection, input.value);
     }else{
       setState(state => ({...state,transformationSelection:input.value}));
     }
  }

  // Pupulates the transformation form into the state 
  const getTransformationFormToState = async (dataframeSelection: string, transformationSelection: string) => {  
     let newFormSchema = await logic.getTransformationFormSchema(dataframeSelection, transformationSelection);
     let newUISchema = logic.getTransfromationUISchema(transformationSelection);
     setState({
        transformationForm: newFormSchema,
        transformationUI: newUISchema,
        showForm: true,
        dataframeSelection: dataframeSelection,
        transformationSelection: transformationSelection
     });
  }

  const generatePythonCode = ( formReponse: any) => {
    // Commented out python implementation
    logic.pythonGenerateCodeAndRun(formReponse, state.dataframeSelection); 
    /* COMMENTED OUT CODE IS REPLACED BY PYTHON FUNCTION TO MAKE DEVELOPMENT FASTER
    console.log('------------------- Generating form code -------------------');
    console.log("Data submitted: ", formReponse);

    const formData = formReponse.formData;
    let transformationSelection: string = formReponse.schema.function;
    let dataframeSelection: string = state.dataframeSelection; 
    let callerObject: string =  formReponse.schema.callerObject;
    let series:string = '';

    if(callerObject.includes('DataFrame') == true){
    // If there is no dataframe selection, calling from pandas
      console.log('Replace dataframe name with', dataframeSelection);
      callerObject = callerObject.replace('DataFrame',dataframeSelection);
    }
    if(callerObject.includes('Series') == true){
    // In case of a series, the formula becomes df[series] = df[series].function(params)
      console.log('Series here');
      const seriesString = '"' + formData['column'] + '"';
      series = '[' + seriesString + ']';
      callerObject = callerObject.replace('Series',seriesString);
    }

    // In the initial state to load data, no explicit transformation has been selected by the user
    // thus, we need to initalize it
    if(!transformationSelection){
      transformationSelection = 'read_csv';
    }

    // Formula that will be generated in the form of: object.transformation(parameters)
    let formula = callerObject + '.' + transformationSelection + '(';
    
    // The result will be saved in one variable: variable = object.transformation(parameters)
    let variable = '';

    // Process every input
    for (var key in formData) {
        console.log('-----> Paramter', key);
        let parameterPrefix: string = '\n    ';     
        // Check if there is a codegenstyle
        if(typeof(formReponse.schema.properties[key]['codegenstyle']) !== 'undefined'){
            const codegenstyle = formReponse.schema.properties[key]['codegenstyle'];
            // ------------------------------------ CODEGEN STYLE DEFINED ------------------------------------------
            // CODEGEN: VARIABLE
            if(codegenstyle === 'variable'){
              console.log('*** Codgenstyle variable')
              formula = formula + parameterPrefix + key + '=' + formData[key] + ', '; 
            // CODEGEN: ARRAY
            }else if(codegenstyle === 'array'){
              console.log('** Codegenstyle array')
              formula = formula + parameterPrefix + key + '=["' + formData[key].join('","') + '"], ';
            // CODEGEN: PIVOT TABLE: FUNCTION
            }else if(codegenstyle === 'aggregation'){
              console.log('** Codegenstyle dict')
                var aggregationDict = '{'
                for(const dict of formData[key]){
                    aggregationDict = aggregationDict + '"' + dict['column'] + '" : [' + dict['function'] + '], ';
                }
                aggregationDict = aggregationDict.substring(0,aggregationDict.length - 2);
                aggregationDict = aggregationDict + '}';
                console.log('Aggregation Dict',aggregationDict);
                aggregationDict = parameterPrefix + 'aggfunc=' + aggregationDict;
                formula = formula + aggregationDict + ', ';
            //   CODEGEN: CHECK NONE        
            }else{
              console.log('** Un-implemented codegenstyle')
            }
        } else{
          // ------------------------------------ CODEGEN NOT DEFINED ------------------------------------------
            // The form input is a Table name 
            if (key.localeCompare('New table') == 0){
              console.log('* New dataframe');
              variable = formData[key];
            }else{
              formula = formula + parameterPrefix + key + '="' + String(formData[key]) + '", ';
            }
        }
    }


    // If no variable defined, and calling from a given dataframe apply to this dataframe
    // else if dataframe not defined, name it data
    if((variable === '') && (dataframeSelection !== null)){
      variable = dataframeSelection;
    // If there is no variable defined and it is not being called from a dataframe, set as data
    }else if ((variable === '') && (dataframeSelection === null)){
      variable = 'data';
    }

    // Remove last comma and space given there are no more parameters
    formula = formula.substring(0, formula.length - 2);
    formula = formula + ')';
    
    // Compose formula
    formula = variable + series + ' = ' + formula;
    console.log('FORMULA: ', formula);

    // Write and execute the formula in the notebook
    logic.writeToNotebookAndExecute(formula);  
   */
   };


  /*-----------------------------------
  NO DATA LOADED: Show a load data form
  -----------------------------------*/
  if(logic.screen.localeCompare('load csv') == 0){
    console.log('------------- DATA LOADING -------------');
    return(
      <Form schema={state.transformationForm} onSubmit={generatePythonCode}  />
      )
  }
  /*--------------------------------------
  SELECT TRANSFORMATION: When data loaded
  ---------------------------------------*/
  // To-do: Add button to load data even in this case
  else if(logic.screen.localeCompare('transformations') == 0){
    console.log('------------- DATA TRANSFORMATION -------------');
      return (
        <div>
        <Select name='Select dataframe' placeholder='select data table' options={logic.dataframesLoaded} label="Select data" onChange={handleDataframeSelectionChange.bind(this)} />
        <Select name='Select transformation' placeholder='select transformation' options={logic.transformations} label="Select transformation" onChange={handleTransformationSelectionChange} />
        {state.showForm &&
          <Form schema={state.transformationForm} onSubmit={generatePythonCode} onChange={handleFormChange.bind(this)} widgets={widgets} uiSchema={state.transformationUI}/>
        }
        </div>
       );
  }
  /*--------------------------------------
  DEV: TEST QUERY BUILDER
  ---------------------------------------*/
  else if(logic.screen.localeCompare('querybuilder') == 0){
    console.log('------------- QUERYBUILDER -------------');
    return(
      <Demo />
    );
  }

};


// This allows to re-render the component whene there is a signal
// This is the recommended approach from the Jupyter team: https://jupyterlab.readthedocs.io/en/stable/developer/virtualdom.html
// Inspired by this example: https://github.com/jupyterlab/jupyterlab/blob/master/docs/source/developer/virtualdom.usesignal.tsx
// ...and this example: https://github.com/jupyterlab/jupyterlab/blob/f2e0cde0e7c960dc82fd9b010fcd3dbd9e9b43d0/packages/running/src/index.tsx#L157-L159
function UseSignalComponent(props: { signal: ISignal<Backend, void>, logic: Backend}) {
  return <UseSignal signal={props.signal}>{() => <FormComponent logic={props.logic} />}</UseSignal>;
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
    return <UseSignalComponent signal={this._backend.signal} logic={this._backend} />;
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

  // GUI screen
  public screen: string = 'load csv';

  // Keeps track of dataframes that can be transformed through the UI
  // Used to display forms
  public dataframesLoaded: any = [];

  // Data transformation functions
  public transformations = [{'value': 'merge', 'label': 'join'}, 
    {'value': 'pivot_table', 'label': 'pivot table'},
    {'value': 'get_dummies', 'label': 'pivot dummies'}, 
    {'value': 'sort_values', 'label': 'sort'},
    {'value': 'drop', 'label': 'drop columns'},
    {'value': 'flatten_multiindex', 'label': 'flatten multi-index'},
    {'value': 'fillna', 'label': 'fill empty values'}
    ];

  /*---------------------------------
    Communicate with Python Kernel
  ----------------------------------*/

  // This variable is created so that we can avoid running the code to get the available dataframes when it is not 
  // needed, i.e. when we are executing code to get the form
  private _codeToRequestForm: string;

  // Boolean to determine if libraries are imported
  private _importedLibraries: boolean = false;

  /*---------------------------------
    Configurations
  ----------------------------------*/
  // Custom data transformations defined in JSON file
  private _transformationsConfig: any;

  // -------------------------------------------------------------------------------------------------------------
  // CONSTRUCTOR
  // -------------------------------------------------------------------------------------------------------------
  constructor(notebooks: INotebookTracker) {
    console.log('------> Backend Constructor');

    // Add a notebook tracker
    this._notebookTracker = notebooks;

    // Subscribe to signal when notebooks change
    this._notebookTracker.currentChanged.connect(this.updateCurrentNotebook, this);

    // Read the transformation config
    this._transformationsConfig = _transformationsConfig;

    // Load initialization script
    this._initScripts = python_initialization_script;
  }

  // -------------------------------------------------------------------------------------------------------------
  // DATA/VARIABLE INSPECTOR
  // -------------------------------------------------------------------------------------------------------------
  
  // This script will run in the kernel every time code runs
  // It returns an object so that it can be expanded with more info in the future, for example number of rows

  private _initScripts: string;

  // Returns a json object with all the dataframes
  private _inspectorScript = `_jupyterlab_variableinspector_dict_list()`;

  // -------------------------------------------------------------------------------------------------------------
  // INTERNAL UTILITIES
  // -------------------------------------------------------------------------------------------------------------

  /*---------------------------------------------------------------------------------------------------- 
  [FUNCTION] Sends request to Kernel
  -> Returns: User expressions
  SOURCE: https://github.com/kubeflow-kale/kale/blob/167aa8859b58918622bb9b742a08cf5807dee4d8/labextension/src/utils/NotebookUtils.tsx#L326
  -----------------------------------------------------------------------------------------------------*/
  public static async sendKernelRequest(
    kernel: Kernel.IKernelConnection,
    runCode: string,
    userExpressions: any,
    runSilent: boolean = false,
    storeHistory: boolean = false,
    allowStdIn: boolean = false,
    stopOnError: boolean = false,
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
      user_expressions: userExpressions,
    }).done;

    const content: any = message.content;

    if (content.status !== 'ok') {
      // If response is not 'ok', throw contents as error, log code
      const msg: string = `Code caused an error:\n${runCode}`;
      console.error(msg);
      if (content.traceback) {
        content.traceback.forEach((line: string) =>
          console.log(
            line.replace(
              /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
              '',
            ),
          ),
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
  -> Writes: _codeToRequestForm

    Depends on:
    - sendKernelRequest
  -----------------------------------------------------------------------------------------------------*/
  public async getTransformationFormSchema(dataFrameSelection: string, transformationSelection: string){
    // Check that there is a transformation selection and a dataframe selection
    console.log('------> Get transformation UI form');
    console.log('Transformation Selection', transformationSelection);
       
    if(typeof(this._transformationsConfig[transformationSelection]) === 'undefined'){
      /*-------------------------------------------
        Generate form on the fly by running python
      -------------------------------------------*/
      console.log('----> No custom transformation');
      let request_expression = 'form = get_multi_select_values(' + dataFrameSelection + '.' + transformationSelection + ',caller=' + dataFrameSelection + ')';      
      // Save it so that we can avoid triggering the codeRunningOnNotebook function
      this._codeToRequestForm = request_expression;
      console.log('Form request expression',request_expression);
      const result = await Backend.sendKernelRequest(this._currentNotebook.sessionContext.session.kernel, request_expression, {'form' : 'form'});
      let content = result.form.data["text/plain"];
      
      // The resulting python JSON neets to be cleaned
      if (content.slice(0, 1) == "'" || content.slice(0, 1) == "\""){
        content = content.slice(1,-1);
        content = content.replace( /\\"/g, "\"" ).replace( /\\'/g, "\'" );
      }

      return JSON.parse(content);
    }else{
      /*-------------------------------------------
        Read form from custom configuration
      -------------------------------------------*/
      let custom_transformation = this._transformationsConfig[transformationSelection].form;
      console.log('Custom transformation ',transformationSelection);

      // Check if there is a definitions object
      if(typeof(custom_transformation['definitions']) !== 'undefined' ){

        let definitions = custom_transformation['definitions'];
        
        // Check if column or columns defined
        if((typeof(definitions['columns']) !== 'undefined' ) || (typeof(definitions['column']) !== 'undefined')){
          console.log("Transformation needs columns");
          let request_expression = 'form = get_json_column_values(' + dataFrameSelection + ')';      
          // Save it so that we can avoid triggering the codeRunningOnNotebook function
          this._codeToRequestForm = request_expression;
          console.log('Form request expression',request_expression);
          const result = await Backend.sendKernelRequest(this._currentNotebook.sessionContext.session.kernel, request_expression, {'form' : 'form'});
          let content = result.form.data["text/plain"];
          
          // The resulting python JSON neets to be cleaned
          if (content.slice(0, 1) == "'" || content.slice(0, 1) == "\""){
            content = content.slice(1,-1);
            content = content.replace( /\\"/g, "\"" ).replace( /\\'/g, "\'" );
          }

          const columns = JSON.parse(content);
          console.log('Retrieved columns:', columns);
          
          // Check if multi-select columns defined
          if(typeof(custom_transformation['definitions']['columns']) !== 'undefined'){
            custom_transformation['definitions']['columns']['items']['enum'] = columns;
          }

          // Check if single select column defined
          if(typeof(custom_transformation['definitions']['column']) !== 'undefined'){
            custom_transformation['definitions']['column']['enum'] = columns;
          }
        }

        // Check if there is a dataframes select
        if(typeof(custom_transformation['definitions']['dataframes']) !== 'undefined'){
          custom_transformation['definitions']['dataframes']['enum'] = this.dataframesLoaded.map((item: any) => item.value);
        }
      }



      
      return custom_transformation as JSONSchema7;
    }
  }

  public getTransfromationUISchema(transformationSelection: string){
    if(typeof(this._transformationsConfig[transformationSelection]) === 'undefined'){
      console.log('No transformation form defined');
      return;
    }else{
      if(typeof(this._transformationsConfig[transformationSelection]['uischema']) !== 'undefined'){
        return this._transformationsConfig[transformationSelection]['uischema'];  
      }else{
        console.log('No transformation uischema defined');
      }
    }

  }

  /*---------------------------------------------------------------------------------------------------- 
  [FUNCTION] Write to the last cell of the notebook and execute
  -> Returns: None
  -----------------------------------------------------------------------------------------------------*/
  public writeToNotebookAndExecute = (code: string) => {
    // Add pandas if not already added
    if(this._importedLibraries == false){
      code = 'import pandas as pd\nimport numpy as np\nfrom fastdata.fastdata.core import *\n' + code;
      this._importedLibraries = true;
    }

    // Calculate index of last cell
    const last_cell_index = this._currentNotebook.content.widgets.length - 1;
    console.log('Last cell index',last_cell_index);
    
    // Run and insert using cell utilities
    CellUtilities.insertRunShow(this._currentNotebook, last_cell_index, code, false);

    this.screen = 'transformations';
  };

  /*---------------------------------------------------------------------------------------------------- 
  [FUNCTION] Get list of columns from Kernel for selected dataframe
  -> Returns: Array of columns
  -----------------------------------------------------------------------------------------------------*/
  public async getDataframeColumns(rightParameter: string){
     let request_expression = 'form = get_json_column_values(' + rightParameter + ')';      
      // Save it so that we can avoid triggering the codeRunningOnNotebook function
      this._codeToRequestForm = request_expression;
      console.log('Form request expression',request_expression);
      const result = await Backend.sendKernelRequest(this._currentNotebook.sessionContext.session.kernel, request_expression, {'form' : 'form'});
      let content = result.form.data["text/plain"];
      
      // The resulting python JSON neets to be cleaned
      if (content.slice(0, 1) == "'" || content.slice(0, 1) == "\""){
        content = content.slice(1,-1);
        content = content.replace( /\\"/g, "\"" ).replace( /\\'/g, "\'" );
      }

      const columns = JSON.parse(content);
      console.log('New columns', columns);

      return columns;
  }

  /*---------------------------------------------------------------------------------------------------- 
  [FUNCTION] Request function from Python: Call python to generate code from form & write+execute
  -> Returns: None
    1. Send form output and dataframe selection to python
    2. Get code returned from python
    3. Write and execute this code
   

    Depends on:
    - writeToNotebookAndExecute
  -----------------------------------------------------------------------------------------------------*/
  public async pythonGenerateCodeAndRun(formReponse: any, dataframeSelection: any){
     var start = new Date().getTime();
     console.log('Form response',formReponse);
     
     let dataframeSelectionInput: string;
     if(!dataframeSelection){
       console.log('No dataframe input');
       dataframeSelectionInput = 'None';
     }else{
       dataframeSelectionInput = dataframeSelection as string;
     }
     console.log('df sel input', dataframeSelectionInput);

     // Replace True and False to be read by python
     let processedString = JSON.stringify(formReponse).replace(/true/g , 'True').replace(/false/g,'False');

     // Generate function call
     let request_expression = 'functionCall = generate_function_call_from_form(' + processedString + ',' + dataframeSelectionInput +')';      
      // Save it so that we can avoid triggering the codeRunningOnNotebook function
      this._codeToRequestForm = request_expression;
      console.log('Funciton call request expression',request_expression);
      const result = await Backend.sendKernelRequest(this._currentNotebook.sessionContext.session.kernel, request_expression, {'functionCall' : 'functionCall'});
      console.log('result',result);
      let content = result.functionCall.data["text/plain"];
      
      // The resulting python JSON neets to be cleaned
      
      if (content.slice(0, 1) == "'" || content.slice(0, 1) == "\""){
        content = content.slice(1,-1);
        // Format the new line characters
        content = content.replace(/\\n/g , '\n');
        // Format the 
        content = content.replace( /\\"/g, "\"" ).replace( /\\'/g, "\'" );
      }  
      console.log('Result ',content);
      var end = new Date().getTime();
      console.log('DURATION ',end - start);
      this.writeToNotebookAndExecute(content);
  }

  // -------------------------------------------------------------------------------------------------------------
  // HANDLE CHANGE OF NOTEBOOK
  // -------------------------------------------------------------------------------------------------------------

  /*---------------------------------------------------------------------------------------------------- 
  [FUNCTION] Update current notebook and create kernel connector
  -> Writes: _currentNotebook, _connector
  -----------------------------------------------------------------------------------------------------*/
  private async updateCurrentNotebook(sender: any, nbPanel: NotebookPanel ){
    console.log('------> Notebook changed', nbPanel.content.title.label);
    // Update the current notebook
    this._currentNotebook = nbPanel;

    // Creates a new way to connect to the Kernel in this notebook
    const session = this._currentNotebook.sessionContext;
    // Note: When an IOptions object is passed, need to look at the sourc code to see which variables this option has. If ther eis one, we can pass it with brackets and the same name
    // To-do: Not sure if at some point I need to drop all these connections
    this._connector = new KernelConnector( { session } );

    // Basically if the connector is ready, should not have to worry about this
    this._connector.ready.then(() => {
      let content: KernelMessage.IExecuteRequestMsg['content'] = {
        code: this._initScripts,
        stop_on_error: false,
        store_history: false
      };
      this._connector.fetch( content, ( () => { } ) ).then(() => {
        this.requestDataframes();
      });
    });

    // Connect to changes running in the code
    this._connector.iopubMessage.connect( this.codeRunningOnNotebook );

    // Need to re-render so that the output function in the button has the latest version of 
    // the current notebook. Probably there is a better way of doing this.
    this.signal.emit();
  }

  // -------------------------------------------------------------------------------------------------------------
  // HANDLE CODE RUNNING IN NOTEBOOK 
  // -------------------------------------------------------------------------------------------------------------

  // Overview: codeRunningOnNotebook ->  requestDataframes -> handleGetDataframesResponse

  /*---------------------------------------------------------------------------------------------------- 
  [FUNCTION] Get list of dataframes through reqeuestDataframes when new code runs
  -> Returns: None
  -----------------------------------------------------------------------------------------------------*/
  private codeRunningOnNotebook = ( sess: ISessionContext, msg: KernelMessage.IExecuteInputMsg ) => {
    console.log('------> Code running in the notebook');
    let msgType = msg.header.msg_type;
    switch ( msgType ) {
        case 'execute_input':
            let code = msg.content.code;
            // Check this is not my code running
            if(!(code == this._inspectorScript) && !(code == this._initScripts) && !(code == this._codeToRequestForm)){
              console.log('Non-internal running');
              this.requestDataframes();
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
  private requestDataframes(): void {
    console.log('------> Get dataframe list');
    let content: KernelMessage.IExecuteRequestMsg['content'] = {
        code: this._inspectorScript,
        stop_on_error: false,
        store_history: false
    };
    this._connector.fetch( content, this.handleGetDataframesResponse );
  };

  /*---------------------------------------------------------------------------------------------------- 
  [FUNCTION] Send request to the Kernel to get dataframes, processed with handleGetDataframesResponse
  -> Writes: screen, dataframesLoaded
  -----------------------------------------------------------------------------------------------------*/
  private handleGetDataframesResponse = ( response: KernelMessage.IIOPubMessage ): void => {
    console.log('------> Handle inspector request');
    let message_type = response.header.msg_type;
    if (message_type === "execute_result"){
      let payload: any = response.content;
      let content: string = payload.data["text/plain"] as string;

      // The resulting python JSON neets to be cleaned
      if (content.slice(0, 1) == "'" || content.slice(0, 1) == "\""){
        content = content.slice(1,-1);
        content = content.replace( /\\"/g, "\"" ).replace( /\\'/g, "\'" );
      }
      const dataframes = JSON.parse( content );
      console.log('Number of dataframes:', dataframes.length);
      if(dataframes.length == 0){
        // TEMP: Disable for testing
        this.screen = 'load csv';
      }else{
        console.log('Refreshing dataframes'); 
        let dataframe_list: Array<any> = [];
        // Note: Just trying to make an array so that I can iterate here
        (dataframes as Array<any>).forEach(function (item, index) {
          //console.log(item, index);
          const dataframe_item = {value: item['varName'], label: item['varName']};
          dataframe_list.push(dataframe_item);
        });

        this.dataframesLoaded = dataframe_list;

        // TEMP: Disable for testing
        this.screen = 'transformations';
      }
      // Emit signal to re-render the component
      this.signal.emit();
    }
  };

}
