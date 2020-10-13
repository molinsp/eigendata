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




/*
 Description: This extension provides a GUI over pandas data transformations, with the goal of facilitating the use by non experts
 Components:
   1.  REACT GUI
   2.  BUSINESS LOGIC
       1.Variable tracker: There is a set of functions that keeps track of what dataframes are in the kernel
       The variable tracker takes the form of a set of Python scripts that are rendered to python
       2.Form code generator: A function that takes the form input and generates+executes the code in the notebook

*/


// -------------------------------------------------------------------------------------------------------------
// 1. REACT GUI
// -------------------------------------------------------------------------------------------------------------

 /**
 * React component that renders forms based on JSON
 *
 * 
 */
// Component takes props with the main class (FormWidget) that handles all the logic, communication with kernel etc.
const FormComponent = (props: {logic: FormWidget}): JSX.Element => {

  // Testing definig a UI schema for the form
  const uiSchema = {
    classNames: "input"   
  };

  let logic = props.logic;

  let transformationForm: JSONSchema7 = _transformationsConfig['read_csv']['form'] as JSONSchema7;


  // State of the component
  const [state, setState] = useState({
      transformationForm: transformationForm,
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

     // FUNCTION: MERGE
     // When the dataframe is changed
     if(data.schema.title === 'merge' && typeof(data.formData['right']) !== 'undefined'){
       console.log('-> Changed right in merge')
       // Get the columns from the backend
       let columns = await logic.getDataframeColumns(data.formData['right']);
       // Perform deep copy of the object, otherwise it does not re-render
       let new_state = _.cloneDeep(state.transformationForm);
       // Add the queried columns to the state
       new_state["definitions"]["right_columns"]['items']['enum'] = columns;
       setState(state => ({...state,transformationForm : new_state}));
     }
   }

  // Process selection of table
   const handleDataframeSelectionChange = (input: any) => {
     //console.log(this);
     if(state.transformationSelection){
       console.log('all defined');
       dataframeTransformationSelection(input.value, state.transformationSelection);
     }else{
       setState(state => ({...state,dataframeSelection:input.value}));
     }
   }

   // Process selection of transformation
   const handleTransformationSelectionChange = (input: any) => {
     //console.log(input);
     if(state.dataframeSelection){
       console.log('all defined');
       dataframeTransformationSelection(state.dataframeSelection, input.value);
     }else{
       setState(state => ({...state,transformationSelection:input.value}));
     }
   }

   
   const dataframeTransformationSelection = async (dataframeSelection: string, transformationSelection: string) => {  
     let newTransformationForm = await logic.requestTransformationFormJSON(dataframeSelection, transformationSelection);
     setState({
        transformationForm: newTransformationForm,
        showForm: true,
        dataframeSelection: dataframeSelection,
        transformationSelection: transformationSelection
     });
   }

   const generatePythonCode = ( formReponse: any) => {
    console.log('------------------- Generating form code -------------------');
    console.log("Data submitted: ", formReponse);

    const formData = formReponse.formData;
    let callerObject: string;
    let transformationSelection: string = state.transformationSelection;
    let dataframeSelection: string = state.transformationSelection; 

    if(!dataframeSelection){
    // If there is no dataframe selection, calling from pandas
      callerObject = 'pd';
    }else{
      callerObject = state.dataframeSelection;
    }

    if(!transformationSelection){
      transformationSelection = 'read_csv';
    }

    // Formula that will be generated in the form of: object.transformation(parameters)
    let formula = callerObject + '.' + transformationSelection + '(';
    
    // The result will be saved in one variable
    let variable = '';

    // Process every input
    for (var key in formData) {
        console.log('-----> Paramter', key);     
        // Check if there is a codegenstyle
        console.log('Codegenstyle', formReponse.schema.properties[key]['codegenstyle']);
        if(typeof(formReponse.schema.properties[key]['codegenstyle']) !== 'undefined'){
            // ------------------------------------ CODEGEN STYLE DEFINED ------------------------------------------
            /*-------------------------------
               CODEGEN: VARIABLE
            -------------------------------*/
            if(formReponse.schema.properties[key]['codegenstyle'] === 'variable'){
              console.log('*** Codgenstyle variable')
              formula = formula + key + '=' + formData[key] + ', '; 
            /*-------------------------------
               CODEGEN: ARRAY
            -------------------------------*/
            }else if(formReponse.schema.properties[key]['codegenstyle'] === 'array'){
              console.log('** Codegenstyle array')
              formula = formula + key + '=["' + formData[key].join('","') + '"], ';
            /*-------------------------------
               CODEGEN: AGGREGATION
            -------------------------------*/
            }else if(formReponse.schema.properties[key]['codegenstyle'] === 'aggregation'){
              console.log('** Codegenstyle dict')
                var input = '{'
                for(const aggregationdict of formData[key]){
                    input = input + '"' + aggregationdict['column'] + '" : ' + aggregationdict['function'] + ', ';
                }
                input = input.substring(0,input.length - 2);
                input = input + '}';
                input = 'aggfunc=' + input;
                formula = formula + input + ', ';
                console.log('Input of dict parameter', input);
            /*-------------------------------
               CODEGEN: CHECK NONE
            -------------------------------*/        
            }else if(formReponse.schema.properties[key]['codegenstyle'] === 'checkNone') {
              console.log('** Codegenstyle check none')
              if (formData[key].localeCompare('None') == 0){
                formula = formula + key + '=' + String(formData[key]) + ', ';
              }else{
                formula = formula + key + '="' + String(formData[key]) + '", ';
              }
            }else{
              console.log('** Undefined codegenstyle')
            }
        } else{
          // ------------------------------------ CODEGEN NOT DEFINED ------------------------------------------
            // The form input is a Table name 
            if (key.localeCompare('New table') == 0){
              console.log('* New dataframe');
              variable = formData[key];
            }else{
              formula = formula + key + '="' + String(formData[key]) + '", ';
            }
        }
    }

    console.log('Dataframe selection', dataframeSelection);
    // If no variable defined, and calling from a given dataframe apply to this dataframe
    // else if dataframe not defined, name it data
    if((variable === '') && (dataframeSelection !== null)){
      variable = dataframeSelection;
    }else if ((variable === '') && (dataframeSelection === null)){
      variable = 'data';
    }

    // Remove last comma and space given there are no more parameters
    formula = formula.substring(0, formula.length - 2);
    formula = formula + ')';
    
    // Compose formula
    formula = variable + ' = ' + formula;
    console.log('FORMULA: ', formula);

    logic.writeAndExecuteCode(formula);

   };


  /*-----------------------------------
  NO DATA LOADED: Show a load data form
  -----------------------------------*/
  if(logic.screen.localeCompare('load csv') == 0){
    console.log('------------- DATA LOADING -------------');
    return(
      <Form schema={state.transformationForm} onSubmit={generatePythonCode}  uiSchema={uiSchema} />
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
        <Select options={logic.dataframesLoaded} label="Select data" onChange={handleDataframeSelectionChange.bind(this)} />
        <Select options={logic.dataframeFunctions} label="Select transformation" onChange={handleTransformationSelectionChange} />
        {state.showForm &&
          <Form schema={state.transformationForm} onSubmit={generatePythonCode} onChange={handleFormChange.bind(this)} uiSchema={uiSchema} widgets={widgets}/>
        }
        </div>
       );
  }

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

function UseSignalComponent(props: { signal: ISignal<FormWidget, void>, logic: FormWidget}) {
  return <UseSignal signal={props.signal}>{() => <FormComponent logic={props.logic} />}</UseSignal>;
}

// -------------------------------------------------------------------------------------------------------------
// 2. BUSINESS LOGIC
// -------------------------------------------------------------------------------------------------------------
// Class that acts as a wrapper for rendering React in jupyter (based on the react jupyterlab extension example )
export class FormWidget extends ReactWidget {

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
  private _signal = new Signal<this, void>(this);

  // GUI screen
  public screen: string = 'load csv';

  // Keeps track of dataframes that can be transformed through the UI
  // Used to display forms
  public dataframesLoaded: any = [];

  /*---------------------------------
    Communicate with Python Kernel
  ----------------------------------*/

  // This variable is created so that we can avoid running the code to get the available dataframes when it is not 
  // needed, i.e. when we are executing code to get the form
  private _codeToRequestForm: string;

  private _importedPandas: boolean = false;

  /*---------------------------------
    Configurations
  ----------------------------------*/

  // Data transformation functions
  public dataframeFunctions = [{'value': 'merge', 'label': 'merge'}, {'value': 'pivot_table', 'label': 'pivot_table'}];

  // Custom data transformations defined in JSON file
  private _transformationsConfig: any;

  // -------------------------------------------------------------------------------------------------------------
  // VARIABLE INSPECTOR
  // -------------------------------------------------------------------------------------------------------------
  
  // This script will run in the kernel every time code runs
  // It returns an object so that it can be expanded with more info in the future, for example number of rows

  private _initScripts: string;

  // Returns a json object with all the dataframes
  private _inspectorScript = `_jupyterlab_variableinspector_dict_list()`;

  // -------------------------------------------------------------------------------------------------------------
  // FORM GENERATOR
  // -------------------------------------------------------------------------------------------------------------
   public async requestTransformationFormJSON(dataFrameSelection: string, transformationSelection: string){
    // Check that there is a transformation selection and a dataframe selection
    console.log('------> Get transformation UI form');

       
    if(typeof(this._transformationsConfig[transformationSelection]) === 'undefined'){
      /*-------------------------------------------
        Generate form on the fly by running python
      -------------------------------------------*/
      console.log('----> No custom transformation');
      let request_expression = 'form = get_multi_select_values(' + dataFrameSelection + '.' + transformationSelection + ',caller=' + dataFrameSelection + ')';      
      // Save it so that we can avoid triggering the codeRunningOnNotebook function
      this._codeToRequestForm = request_expression;
      console.log('Form request expression',request_expression);
      const result = await FormWidget.sendKernelRequest(this._currentNotebook.sessionContext.session.kernel, request_expression, {'form' : 'form'});
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
      console.log('Custom transformation ',transformationSelection);
      let request_expression = 'form = get_json_column_values(' + dataFrameSelection + ')';      
      // Save it so that we can avoid triggering the codeRunningOnNotebook function
      this._codeToRequestForm = request_expression;
      console.log('Form request expression',request_expression);
      const result = await FormWidget.sendKernelRequest(this._currentNotebook.sessionContext.session.kernel, request_expression, {'form' : 'form'});
      let content = result.form.data["text/plain"];
      
      // The resulting python JSON neets to be cleaned
      if (content.slice(0, 1) == "'" || content.slice(0, 1) == "\""){
        content = content.slice(1,-1);
        content = content.replace( /\\"/g, "\"" ).replace( /\\'/g, "\'" );
      }

      const columns = JSON.parse(content);
      console.log('Retrieved columns:', columns);

      // Fill columns in custom transformation json
      let custom_transformation = this._transformationsConfig[transformationSelection].form;
      
      // Check if multi-select columns defined
      if(typeof(custom_transformation['definitions']['columns']) !== 'undefined'){
        custom_transformation['definitions']['columns']['items']['enum'] = columns;
      }

      // Check if single select column defined
      if(typeof(custom_transformation['definitions']['column']) !== 'undefined'){
        custom_transformation['definitions']['column']['enum'] = columns;
      }

      // Check if there is a dataframes select
      if(typeof(custom_transformation['definitions']['dataframes']) !== 'undefined'){
        custom_transformation['definitions']['dataframes']['enum'] = this.dataframesLoaded.map((item: any) => item.value);
      }
      
      return custom_transformation as JSONSchema7;
    }
    
  }

  

  // -------------------------------------------------------------------------------------------------------------
  // INTERNAL UTILITIES
  // -------------------------------------------------------------------------------------------------------------

  // Send request to the Kernel (NOT USED)
  // From: https://github.com/kubeflow-kale/kale/blob/167aa8859b58918622bb9b742a08cf5807dee4d8/labextension/src/utils/NotebookUtils.tsx#L326
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
  // Note: Here for some reason I need to do these arrow functions

  // CODE GENERATION FUNCTION
  // Takes the inputs of the form and creates a string that is sent to the notebook and executed

  public writeAndExecuteCode = (code: string) => {
    // Add pandas if not already added
    if(this._importedPandas == false){
      code = 'import pandas as pd \n' + code;
      this._importedPandas = true;
    }

    // Calculate index of last cell
    const last_cell_index = this._currentNotebook.content.widgets.length - 1;
    
    // Run and insert using cell utilities
    CellUtilities.insertRunShow(this._currentNotebook, last_cell_index, code, false);

    this.screen = 'transformations';
  };

  // -------------------------------------------------------------------------------------------------------------
  // CONSTRUCTOR
  // -------------------------------------------------------------------------------------------------------------
  constructor(notebooks: INotebookTracker) {
    super();
    console.log('------> Constructor');
    this.addClass('jp-ReactWidget');
    this.addClass('input');

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
  // HANDLE CHANGE OF NOTEBOOK
  // -------------------------------------------------------------------------------------------------------------

  // Updates the variable that holds the  
  private async updateCurrentNotebook(sender: any, nbPanel: NotebookPanel ){
    console.log('------> Notebook changed', nbPanel.content.title.label);
    // Update the current notebook
    this._currentNotebook = nbPanel;

    // Creates a new way to connect to the Kernel in this notebook
    const session = this._currentNotebook.sessionContext;
    // Note: When an IOptions object is passed, need to look at the sourc code to see which variables this option has. If ther eis one, we can pass it with brackets and the same name
    // To-do: Ok at some point we cannot keep creating connections, these should be somehow dropped
    this._connector = new KernelConnector( { session } );

    //console.log('Connector:', this._connector);

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
    this._signal.emit();
  }

  // -------------------------------------------------------------------------------------------------------------
  // HANDLE CODE RUNNING IN NOTEBOOK (GENERAL FOR ALL FUNCTIONS)
  // -------------------------------------------------------------------------------------------------------------

  // Run inspector every time code is running and the code is not from eigendata application
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

  // This sends a request to the Kernel to get a list of dataframes
  private requestDataframes(): void {
    console.log('------> Get dataframe list');
    let content: KernelMessage.IExecuteRequestMsg['content'] = {
        code: this._inspectorScript,
        stop_on_error: false,
        store_history: false
    };
    this._connector.fetch( content, this.handleGetDataframesResponse );
  };

  // Triggered when the getDataframesrequest responds.
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
      this._signal.emit();
    }
  };

  // -------------------------------------------------------------------------------------------------------------
  // FUNCTION MERGE: Incomplete, custom code to handle this specific function
  // -------------------------------------------------------------------------------------------------------------

  public async getDataframeColumns(rightParameter: string){
     let request_expression = 'form = get_json_column_values(' + rightParameter + ')';      
      // Save it so that we can avoid triggering the codeRunningOnNotebook function
      this._codeToRequestForm = request_expression;
      console.log('Form request expression',request_expression);
      const result = await FormWidget.sendKernelRequest(this._currentNotebook.sessionContext.session.kernel, request_expression, {'form' : 'form'});
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

  // -------------------------------------------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------------------------------------------

  // Render
  render(): JSX.Element {
    return <UseSignalComponent signal={this._signal} logic={this} />;
  }
}
