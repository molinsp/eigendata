import { ReactWidget, UseSignal } from '@jupyterlab/apputils';

import React from 'react';

import Form from "@rjsf/core";

import Select from 'react-select';

import {JSONSchema7} from 'json-schema';

import { KernelConnector } from './kernelconnector';

import {NotebookPanel, NotebookActions, INotebookTracker} from '@jupyterlab/notebook';

import { KernelMessage, Kernel } from '@jupyterlab/services';

import {ISessionContext} from "@jupyterlab/apputils";

import { ISignal, Signal } from '@lumino/signaling';

import transformations_config from './transformations.json';

import {python_initialization_script} from './initscript';

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

  console.log('------> Rendering UI');

  /*-----------------------------------
  CUSTOM SELECT
  -----------------------------------*/
  const CustomSelect = function(props:any) {
    //console.log('Props custom select: ', props.value);
    
    const processSingleSelect = (selection: any) => {
      const {value} = selection;
      //console.log('Signle select change', selection);
      return value;
    };

    const processMultiSelect = (selection: any) => {
      const values = selection.map((item: any) => item.value);
      //console.log(values);
      return values;
    };

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
          defaultInputValue={props.value}
        />
      );
    }

  };

  // Define mapping of custom widgets
  const widgets = {
    SelectWidget: CustomSelect
  };

  function handleChange (data:any) {
    //console.log(data);

    // FUNCTION: merge
    // This handles the merge function
    if(data.schema.title === 'merge' && typeof(data.formData['right']) !== 'undefined'){
      console.log('-> Changed right in merge')
      // This was an attempt to make a dynamic form but
      //logic.updateMergeDataframesForm(data.formData['right']);
      data.formData = {};
    }
  }

  // To-do: Bring react-select to jsonschemaform https://codesandbox.io/s/13vo8wj13?file=/src/formGenerationEngine/Form.js

  /*-----------------------------------
  NO DATA LOADED: Show a load data form
  -----------------------------------*/
  if(logic.state_screen === 'load csv' ){
    return(
      <Form schema={logic.transformationForm} onSubmit={logic.generatePythonCodeFromForm}  uiSchema={uiSchema} />
      )
  }
  /*--------------------------------------
  SELECT TRANSFORMATION: When data loaded
  ---------------------------------------*/
  // To-do: Add button to load data even in this case
  else if(logic.state_screen == 'transformations'){
    console.log('Transformations state');
      return (
        <div>
        <Select options={logic.dataframes_available} label="Select data" onChange={logic.handleTableSelectionChange} />
        <Select options={logic.dataframe_functions} label="Select transformation" onChange={logic.handleTransformationSelectionChange} />
        {logic.show_formula_fields &&
          <Form schema={logic.transformationForm} onSubmit={logic.generatePythonCodeFromForm} onChange={handleChange.bind(this)} uiSchema={uiSchema} widgets={widgets}/>
        }
        </div>
       );
  }

};


// This allows to re-render the component whene there is a signal
// This is the recommended approach from the Jupyter team: https://github.com/jupyterlab/jupyterlab/blob/master/docs/source/developer/virtualdom.usesignal.tsx
// Inspired by this example: https://github.com/jupyterlab/jupyterlab/blob/master/docs/source/developer/virtualdom.usesignal.tsx

function UseSignalComponent(props: { signal: ISignal<FormWidget, void>, logic: FormWidget}) {
  return <UseSignal signal={props.signal}>{() => <FormComponent logic={props.logic} />}</UseSignal>;
}

// -------------------------------------------------------------------------------------------------------------
// 2. BUSINESS LOGIC
// -------------------------------------------------------------------------------------------------------------
export class FormWidget extends ReactWidget {

  /*---------------------------------
    Keep track of notebooks
  ----------------------------------*/

  // Object that holds the currently selected notebook
  private current_notebook: NotebookPanel;

  // Tracker that enables us to listen to notebook change events
  private _notebook_tracker: INotebookTracker;

  // Enables to connect to the kernel
  private _connector: KernelConnector;


  /*---------------------------------
    Communicate with UI
  ----------------------------------*/
  // Signal that triggers the update of the react component 
  private _signal = new Signal<this, void>(this);

  // Keeps track of the UI table selection
  public tableSelection: any;
  // Keeps track of the UI transformation selection
  public transformationSelection: string;

  // JSON schema that defines the transformationform
  public transformationForm: JSONSchema7;

  // GUI screen state
  public state_screen: string = 'load csv';

  // Variable that controls if the formula field is shown
  public show_formula_fields: boolean = false;

  // Keeps track of dataframes that can be transformed through the UI
  public dataframes_available: any = [];

  /*---------------------------------
    Communicate with Python Kernel
  ----------------------------------*/

  // This variable is created so that we can avoid running the code to get the available dataframes when it is not 
  // needed, i.e. when we are executing code to get the form
  private _codeToRequestForm: string;

  /*---------------------------------
    Configurations
  ----------------------------------*/

  // Data transformation functions
  public dataframe_functions = [{'value': 'merge', 'label': 'merge'}, {'value': 'pivot_table', 'label': 'pivot_table'}];

  // Custom data transformations defined in JSON file
  private transformations_config: any;

  // -------------------------------------------------------------------------------------------------------------
  // VARIABLE INSPECTOR
  // -------------------------------------------------------------------------------------------------------------
  
  // This script will run in the kernel every time code runs
  // It returns an object so that it can be expanded with more info in the future, for example number of rows

  public _initScripts: string;

  // Returns a json object with all the dataframes
  private inspector_script = `_jupyterlab_variableinspector_dict_list()`;

// -------------------------------------------------------------------------------------------------------------
// FORM GENERATOR
// -------------------------------------------------------------------------------------------------------------

  

  // -------------------------------------------------------------------------------------------------------------
  // INTERNAL UTILITIES
  // -------------------------------------------------------------------------------------------------------------
  // Function to run cell at a specific nidex
  // FROM: https://github.com/CDAT/jupyter-vcdat/blob/master/src/CellUtilities.ts
  public async runCellAtIndex(
    notebookPanel: NotebookPanel,
    index: number
  ): Promise<string> {
    if (notebookPanel === null) {
      throw new Error(
        "Null or undefined parameter was given for command or notebook argument."
      );
    }
    // await notebookPanel.sessionContext.ready;
    const notebook = notebookPanel.content;
    if (index < 0 || index >= notebook.widgets.length) {
      throw new Error("The index was out of range.");
    }
    // Save the old index, then set the current active cell
    const oldIndex = notebook.activeCellIndex;
    notebook.activeCellIndex = index;
    try {
      await NotebookActions.run(notebook, notebookPanel.sessionContext);

      // await command.execute("notebook:run-cell");
      notebook.activeCellIndex = oldIndex;

      return 'Success';
    } finally {
      notebook.activeCellIndex = oldIndex;
    }
  }


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
  public generatePythonCodeFromForm = ( formReponse: any) => {
    console.log('------------------- Generating form code -------------------');
    console.log("Data submitted: ", formReponse);

    const formData = formReponse.formData;
    let callerObject: string;

    if(!this.tableSelection){
    // If there is no table selection, calling from pandas
      callerObject = 'pd';
    }else{
      callerObject = this.tableSelection;
    }

    // Formula that will be generated in the form of: object.transformation(parameters)
    let formula = callerObject + '.' + this.transformationSelection + '(';
    
    // The result will be saved in one variable
    let variable = '';

    // Process every input
    for (var key in formData) {
        console.log('-----> Paramter', key);     
        // Check if there is a codegenstyle
        console.log('Codegenstyle', formReponse.schema.properties[key]['codegenstyle']);
        if(typeof(formReponse.schema.properties[key]['codegenstyle']) !== 'undefined'){
            // Codegenstyle defined -----------------------------------------------
            if(formReponse.schema.properties[key]['codegenstyle'] === 'variable'){
              console.log('*** Codgenstyle variable')
              formula = formula + key + '=' + formData[key] + ', '; 
            }else if(formReponse.schema.properties[key]['codegenstyle'] === 'array'){
              console.log('** Codegenstyle array')
              formula = formula + key + '=["' + formData[key].join('","') + '"], ';
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
            // The form input is a Table name 
            if (key.localeCompare('New table') == 0){
              console.log('* New table');
              variable = formData[key];
            }else{
              formula = formula + key + '="' + String(formData[key]) + '", ';
            }
        }
    }

    // If no variable defined, overwrite dataframe
    if((variable === '') && (typeof(this.tableSelection) !== 'undefined')){
      variable = this.tableSelection;
    }else{
      variable = 'data';
    }

    // Remove last comma and space given there are no more parameters
    formula = formula.substring(0, formula.length - 2);
    formula = formula + ')';
    
    // Compose formula
    formula = variable + ' = ' + formula;

    const last_cell_index = this.current_notebook.content.widgets.length - 1;
    const last_cell = this.current_notebook.content.widgets[last_cell_index];
    console.log('Last cell inded: ', last_cell_index);
    last_cell.model.value.text = formula;  

    // The code here is to run the cell 
    this.runCellAtIndex(this.current_notebook, last_cell_index);

    // Go back to transformation state
    this.state_screen = 'transformations';
    //Reset the selection
    this.transformationSelection = null;
  };

  public handleTableSelectionChange = (selection:any) => {
    this.tableSelection = selection.value as string;
    this.requestTransformationForm();
    //console.log(this.tableSelection);
  }

  public handleTransformationSelectionChange = (selection:any) => {
    this.transformationSelection = selection.value;
    this.requestTransformationForm();
    //console.log(this.transformationSelection);
  }


  // -------------------------------------------------------------------------------------------------------------
  // CONSTRUCTOR
  // -------------------------------------------------------------------------------------------------------------
  constructor(notebooks: INotebookTracker) {
    super();
    console.log('------> Constructor');
    this.addClass('jp-ReactWidget');
    this.addClass('input');

    // Add a notebook tracker
    this._notebook_tracker = notebooks;

    // Subscribe to signal when notebooks change
    this._notebook_tracker.currentChanged.connect(this._updateCurrentNotebook, this);

    // Read the transformation config
    this.transformations_config = transformations_config;

    // Default is to have the read csv form
    this.transformationForm = this.transformations_config['read_csv']['form'];

    // Load initialization script
    this._initScripts = python_initialization_script;

  }


  // -------------------------------------------------------------------------------------------------------------
  // HANDLE CHANGE OF NOTEBOOK
  // -------------------------------------------------------------------------------------------------------------

  // Updates the variable that holds the  
  private async _updateCurrentNotebook(sender: any, nbPanel: NotebookPanel ){
    console.log('------> Notebook changed', nbPanel.content.title.label);
    // Update the current notebook
    this.current_notebook = nbPanel;

    // Creates a new way to connect to the Kernel in this notebook
    const session = this.current_notebook.sessionContext;
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
        this.getDataframes();
      });
    });

    // Connect to changes running in the code
    this._connector.iopubMessage.connect( this._codeRunningOnNotebook );


    // To-do:Need to call render so that the output function in the button has the latest version of 
    // the current notebook. Probably there is a better way of doing this.
    this.render();
  }

  // -------------------------------------------------------------------------------------------------------------
  // HANDLE CODE RUNNING IN NOTEBOOK
  // -------------------------------------------------------------------------------------------------------------

  // Run inspector every time code is running and the code is not from eigendata application
  private _codeRunningOnNotebook = ( sess: ISessionContext, msg: KernelMessage.IExecuteInputMsg ) => {
    console.log('------> Code running in the notebook');
    let msgType = msg.header.msg_type;
    switch ( msgType ) {
        case 'execute_input':
            let code = msg.content.code;
            // Check this is not my code running
            if(!(code == this.inspector_script) && !(code == this._initScripts) && !(code == this._codeToRequestForm)){
              console.log('Code running');
              this.getDataframes();
            }
            break;
        default:
            break;
    }
  };

  // This sends a request to the Kernel to get a list of dataframes
  private getDataframes(): void {
    console.log('------> Get dataframe list');
    let content: KernelMessage.IExecuteRequestMsg['content'] = {
        code: this.inspector_script,
        stop_on_error: false,
        store_history: false
    };
    this._connector.fetch( content, this._handleGetDataframesResponse );
  };

  // This formats the dataframes that we are reading to show them in the UI
  private _handleGetDataframesResponse = ( response: KernelMessage.IIOPubMessage ): void => {
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
        this.state_screen = 'load csv';
        this.transformationSelection = 'read_csv';
      }else{
        console.log('Refreshing dataframes');
        this.state_screen = 'transformations';
        this.generateDataFrameSelectionForm(dataframes);
      }
      // Emit signal to re-render the component
      this._signal.emit();
    }
  };

  private async requestTransformationForm(){
    // Check that there is a transformation selection and a table selection
    console.log('------> Get transformation UI form');
    if(this.transformationSelection && this.tableSelection){
       
      if(typeof(this.transformations_config[this.transformationSelection]) === 'undefined'){
        /*-------------------------------------------
          Generate form on the fly by running python
        -------------------------------------------*/
        console.log('----> No custom transformation');
        let request_expression = 'form = get_multi_select_values(' + this.tableSelection + '.' + this.transformationSelection + ',caller=' + this.tableSelection + ')';      
        // Save it so that we can avoid triggering the _codeRunningOnNotebook function
        this._codeToRequestForm = request_expression;
        console.log('Form request expression',request_expression);
        const result = await FormWidget.sendKernelRequest(this.current_notebook.sessionContext.session.kernel, request_expression, {'form' : 'form'});
        let content = result.form.data["text/plain"];
        
        // The resulting python JSON neets to be cleaned
        if (content.slice(0, 1) == "'" || content.slice(0, 1) == "\""){
          content = content.slice(1,-1);
          content = content.replace( /\\"/g, "\"" ).replace( /\\'/g, "\'" );
        }

        this.transformationForm = JSON.parse(content);
      }else{
        /*-------------------------------------------
          Read form from custom configuration
        -------------------------------------------*/
        console.log('Custom transformation', this.transformations_config[this.transformationSelection]);
        let request_expression = 'form = get_json_column_values(' + this.tableSelection + ')';      
        // Save it so that we can avoid triggering the _codeRunningOnNotebook function
        this._codeToRequestForm = request_expression;
        console.log('Form request expression',request_expression);
        const result = await FormWidget.sendKernelRequest(this.current_notebook.sessionContext.session.kernel, request_expression, {'form' : 'form'});
        let content = result.form.data["text/plain"];
        
        // The resulting python JSON neets to be cleaned
        if (content.slice(0, 1) == "'" || content.slice(0, 1) == "\""){
          content = content.slice(1,-1);
          content = content.replace( /\\"/g, "\"" ).replace( /\\'/g, "\'" );
        }

        const columns = JSON.parse(content);
        console.log('Retrieved columns:', columns);

        // Fill columns in custom transformation json
        let custom_transformation = this.transformations_config[this.transformationSelection].form;
        
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
          custom_transformation['definitions']['dataframes']['enum'] = this.dataframes_available.map((item: any) => item.value);
        }
        
        this.transformationForm = custom_transformation;


      }

      // Update the state to indicate that we are now ready to show a formula field
      this.show_formula_fields = true;
      this._signal.emit();
      console.log('<-------------- Transformation UI form generated');
    }
  }

  // Test: Right now after code runs we are just creating a new JSON form schema
  // and replacing the old one with the new one
  // Probably not the best way of doing it
  private generateDataFrameSelectionForm (dataframes: JSONSchema7): void {
    let dataframe_list: Array<any> = [];
    
    // Note: Just trying to make an array so that I can iterate here
    (dataframes as Array<any>).forEach(function (item, index) {
      //console.log(item, index);
      const dataframe_item = {value: item['varName'], label: item['varName']};
      dataframe_list.push(dataframe_item);
    });
   
    this.dataframes_available = dataframe_list;
    
    // Emit a signal so that the UI re-renders
    this._signal.emit();
  };

  // -------------------------------------------------------------------------------------------------------------
  // FUNCTION MERGE
  // -------------------------------------------------------------------------------------------------------------

  public async updateMergeDataframesForm(rightParameter: string){
     let request_expression = 'form = get_json_column_values(' + rightParameter + ')';      
      // Save it so that we can avoid triggering the _codeRunningOnNotebook function
      this._codeToRequestForm = request_expression;
      console.log('Form request expression',request_expression);
      const result = await FormWidget.sendKernelRequest(this.current_notebook.sessionContext.session.kernel, request_expression, {'form' : 'form'});
      let content = result.form.data["text/plain"];
      
      // The resulting python JSON neets to be cleaned
      if (content.slice(0, 1) == "'" || content.slice(0, 1) == "\""){
        content = content.slice(1,-1);
        content = content.replace( /\\"/g, "\"" ).replace( /\\'/g, "\'" );
      }

      const columns = JSON.parse(content);
      console.log('New columns', columns);

      let custom_merge_transformation = this.transformations_config[this.transformationSelection].form;

      custom_merge_transformation['definitions']['right_columns'] = {
        "type" : "array", 
        "uniqueItems" : true, 
        "items": {
          "type":"array", 
          "enum": columns
          }
      };

      custom_merge_transformation['definitions']['columns']['items']['enum'] = columns;
      custom_merge_transformation['definitions']['dataframes']['enum'] = this.dataframes_available.map((item: any) => item.value);

      this.transformationForm = custom_merge_transformation;

      this._signal.emit();

      console.log('New transformation form', this.transformationForm);
  }

  // -------------------------------------------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------------------------------------------

  // Render
  render(): JSX.Element {
    return <UseSignalComponent signal={this._signal} logic={this} />;
  }
}
