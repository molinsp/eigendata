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

  console.log('Rendered form', logic.transformationForm);


  /*-----------------------------------
  CUSTOM SELECT
  -----------------------------------*/
  const CustomSelect = function(props:any) {
    console.log('Props custom select: ', props.value);
    
    const processSingleSelect = (selection: any) => {
      const {value} = selection;
      //console.log(value);
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

  // To-do: Bring react-select to jsonschemaform https://codesandbox.io/s/13vo8wj13?file=/src/formGenerationEngine/Form.js

  /*-----------------------------------
  NO DATA LOADED: Show a load data form
  -----------------------------------*/
  if(logic.state_screen === 'load csv' ){
    return(
      <Form schema={logic.form_read_csv} onSubmit={logic.generateFormCode}  uiSchema={uiSchema} />
      )
  }
  /*--------------------------------------
  SELECT TRANSFORMATION: When data loaded
  ---------------------------------------*/
  // To-do: Add button to load data even in this case
  else if(logic.state_screen == 'transformations'){
      return (
        <div>
        <Select options={logic.dataframes_available} label="Select data" onChange={logic.handleTableSelectionChange} />
        <Select options={logic.dataframe_functions} label="Select transformation" onChange={logic.handleTransformationSelectionChange} />
        {logic.show_formula_fields &&
          <Form schema={logic.transformationForm} onSubmit={logic.generateFormCode}  uiSchema={uiSchema} widgets={widgets}/>
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

  // Object that holds the currently selected notebook
  private current_notebook: NotebookPanel;

  // Tracker that enables us to listen to notebook change events
  private _notebook_tracker: INotebookTracker;

  // Enables to connect to the kernel
  private _connector: KernelConnector;

  // Signal that triggers the update of the react component 
  private _signal = new Signal<this, void>(this);

  // This variable is created so that we can avoid running the code to get the available dataframes when it is not 
  // needed, i.e. when we are executing code to get the form
  private _codeToRequestForm: string;

  // -------------------------------------------------------------------------------------------------------------
  // PUBLIC STATE VARIABLES
  // -------------------------------------------------------------------------------------------------------------

  // Initial JSON form schema
  public form_read_csv: JSONSchema7 = {
    "properties": {
      "filepath_or_buffer": {"type": "string"}, 
      "sep": {"type": "string", "default": ","}, 
      "delimiter": {"type": "string", "default": "None"}, 
      "decimal": {"type": "string", "default": "."},
      "Table name": {"type": "string"}
    }, 
    "title": "read_csv", 
    "required": ["filepath_or_buffer", "sep", "delimiter", "decimal"]
  };

  public transformationForm: JSONSchema7;
 
  public state_screen: string = 'load csv';
  // Placeholder to determine if the GUI will start in a loaddata state

  // Variable that controls if the formula field is shown
  public show_formula_fields: boolean = false;

  // Placeholder for available dataframes
  public dataframes_available: any = [];

  public tableSelection: any;
  public transformationSelection: string;

  // Data transformation functions
  public dataframe_functions = [ {'value': 'merge', 'label': 'merge'}];

  // -------------------------------------------------------------------------------------------------------------
  // VARIABLE INSPECTOR
  // -------------------------------------------------------------------------------------------------------------
  
  // This script will run in the kernel every time code runs
  // Basically returns a json object with all the dataframes
  // It returns an object so that it can be expanded with more info in the future, for example number of rows

  public _initScripts = `
import json
from IPython import get_ipython
from IPython.core.magics.namespace import NamespaceMagics


_jupyterlab_variableinspector_nms = NamespaceMagics()
_jupyterlab_variableinspector_Jupyter = get_ipython()
_jupyterlab_variableinspector_nms.shell = _jupyterlab_variableinspector_Jupyter.kernel.shell


def _jupyterlab_variableinspector_keep_dataframes(v):
    try:
        obj = eval(v)
        # Check if datadrame
        if isinstance(obj, pd.core.frame.DataFrame) or isinstance(obj,pd.core.series.Series):
            return True
        return False
    except:
        return False

def _jupyterlab_variableinspector_dict_list():
    values = _jupyterlab_variableinspector_nms.who_ls()
    vardic = [{'varName': _v} for _v in values if _jupyterlab_variableinspector_keep_dataframes(_v)]
    return json.dumps(vardic, ensure_ascii=False)

def _jupyterlab_variableinspector_array():
    values = _jupyterlab_variableinspector_nms.who_ls()
    vararray = [_v for _v in values if _jupyterlab_variableinspector_keep_dataframes(_v)]
    return vararray


custom_config = {
    'read_csv' : {
        'included_parameters' : ['filepath_or_buffer','sep','delimiter','decimal'],
    },
    'merge' : {
        'included_parameters' : ['right','how','left_on','right_on'],
    }
    
    
}

from numpydoc.docscrape import NumpyDocString
import re
import json
def get_multi_select_values(function, caller=None):
    """
    This function takes a pandas function an returns a parameter configuration that allows us to build a graphical
    user interface
    """
    doc = NumpyDocString(function.__doc__)
    
    function_name = function.__name__
    
    # Check if there is a cusom config
    has_custom_config = 0
    if(function_name in custom_config):
        #print('Reading custom config for function ' + function_name)
        has_custom_config = 1
    
    # Check if there is a custom parameter config
    has_custom_parameters_config = 0
    if((has_custom_config == 1) and 'parameters' in custom_config[function_name]):
        has_custom_parameters_config = 1
        
    # Check if there is a custom parameter list
    has_custom_parameters_list = 0
    if((has_custom_config == 1) and 'included_parameters' in custom_config[function_name]):
        has_custom_parameters_list = 1
        
    # Iterate over all parameters
    # ------------------------------------------------------------------------------------------
    # ------------------------------------------------------------------------------------------
    # ------------------------------------------------------------------------------------------
    
    parameter_configuration = {'properties': {}}
    parameter_configuration['title'] = function_name
    parameter_configuration['required'] = []
    for i in doc['Parameters']:
        # CHECK FOR CUSTOM CONFIGS
        # ------------------------------------------------------------------------------------------
        # ------------------------------------------------------------------------------------------
       
        # Check if the parameter is excluded 
        if has_custom_parameters_list == 1:
            if((has_custom_config == 1) and i.name in custom_config[function_name]['included_parameters']):
                pass
                #print(i.name + '  is included in the custom parameter list')
            else:
                # Skip the config
                continue
        
        # Check if there is custom parameter config
        has_custom_config_parameter = 0
        
        custom_parameter_config = {}
        if has_custom_parameters_config == 1:           
            if((has_custom_config == 1) and i.name in custom_config[function_name]['parameters']):
                #print('reading custom parameter config')
                has_custom_config_parameter = 1
                custom_parameter_config = custom_config[function_name]['parameters'][i.name]
        
        
        # CREATE THE OUTPUT
        # ------------------------------------------------------------------------------------------
        # ------------------------------------------------------------------------------------------
        parameter_description = {}
        parameter_description[i.name] = {}
        
        # 1. PARAMETER TYPE
        # ------------------------------------------------------------------------------------------
        # Check for custom config
        if 'parameter_type' in custom_parameter_config:
            parameter_description[i.name]['type'] = custom_parameter_config['parameter_type'] 
        # Automatic check
        elif 'column' in i.type:
            if 'list' in i.type:
                parameter_description[i.name]['type'] = 'array'
                parameter_description[i.name]['codegenstyle'] = 'array'
                parameter_description[i.name]['uniqueItems'] = True
                parameter_description[i.name]['items'] = {}
                parameter_description[i.name]['items']['type'] = 'string'
                parameter_description[i.name]['items']['enum'] = caller.columns.tolist()
            else:
                parameter_description[i.name]['enum'] = caller.columns.tolist()
                parameter_description[i.name]['type'] = 'string'
        elif 'label' in i.type:
            if 'list' in i.type:
                parameter_description[i.name]['type'] = 'array'
                parameter_description[i.name]['codegenstyle'] = 'array'
                parameter_description[i.name]['uniqueItems'] = True
                parameter_description[i.name]['items'] = {}
                parameter_description[i.name]['items']['type'] = 'string'
                parameter_description[i.name]['items']['enum'] = caller.columns.tolist()
            else:
                parameter_description[i.name]['enum'] = caller.columns.tolist()
                parameter_description[i.name]['type'] = 'string'
            # To-do add also row labels
        elif 'DataFrame' in i.type:
            parameter_description[i.name]['type'] = 'string'
            parameter_description[i.name]['enum'] = _jupyterlab_variableinspector_array()
            parameter_description[i.name]['codegenstyle'] = 'variable'
        elif 'function' in i.type:
            parameter_description[i.name]['type'] = 'string'
        elif 'scalar' in i.type:
            parameter_description[i.name]['type'] = 'integer'
        elif 'int' in i.type:
            parameter_description[i.name]['type'] = 'integer'
        elif 'bool' in i.type:
            parameter_description[i.name]['type'] = 'boolean'
        elif 'str' in i.type:
            parameter_description[i.name]['type'] = 'string'
        else:
            parameter_description[i.name]['type'] = 'string'

        
        
        # 3. CHECK FOR OPTIONS
        # ------------------------------------------------------------------------------------------
        # Check for custom config
        if 'values' in custom_parameter_config:
            parameter_description[i.name]['values'] = custom_parameter_config['values'] 
        # Automatic check: Check if the parameter has specific set of values given
        elif '{' in i.type:
            options = re.search('{(.*)}', i.type).group(1)
            options = options.replace('"', '')
            options = options.replace("'", '')
            options = options.replace(' ', '')
            options = options.split(',')
            #options = options.replace('"', '').replace(' ', '').split(',')
            parameter_description[i.name]['enum'] = options


        # 3. DETERMINE SELECTOR TYPE
        # ------------------------------------------------------------------------------------------     
        if 'selector_type' in custom_parameter_config:
            #print('selecto type from config')
            parameter_description[i.name]['selector_type'] = custom_parameter_config['selector_type'] 
        # Automatic check: Check if more than one input can be given             
        #elif 'list' in i.type:
        #    parameter_description[i.name]['selector_type'] = 'multiselect'
        #elif 'str' in i.type:
        #    parameter_description[i.name]['selector_type'] = 'text'
        #else:
        #    parameter_description[i.name]['selector_type'] = 'singleselect'
        
        # 4. OPTIONAL VS REQUIRED
        # ------------------------------------------------------------------------------------------
        if 'optional' not in i.type:
            parameter_configuration['required'].append(i.name)
            
        # 5. DEFAULT VALUE
        # ------------------------------------------------------------------------------------------
        if 'default is' in i.type:
                default_index = i.type.find('default is') + 11
                default_val = i.type[default_index:]
                # Clean the string
                default_val = default_val.strip("'")
                parameter_description[i.name]['default'] = default_val      
        elif 'default' in i.type:
                default_index = i.type.find('default') + 8
                default_val = i.type[default_index:]
                # Clean the string
                default_val = default_val.strip("'")
                parameter_description[i.name]['default'] = default_val
        
        parameter_configuration['properties'].update(parameter_description) 
        
    parameter_configuration['properties']['New table'] = {'type': 'string'};
    res = json.dumps(parameter_configuration, ensure_ascii=False) 
    return json.dumps(parameter_configuration, ensure_ascii=False) 
`;

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
  public generateFormCode = ( formReponse: any) => {
    console.log("Data submitted: ", formReponse);

    console.log('------------------- Generating form -------------------');

    const formData = formReponse.formData;
    let callerObject: string;

    if(!this.tableSelection){
      callerObject = 'pd';
      this.transformationSelection = 'read_csv';
    }else{
      callerObject = this.tableSelection;
    }

    let formula = callerObject + '.' + this.transformationSelection + '(';
    let variable = '';

    for (var key in formData) {
      console.log('-----> Paramter', key);
      // Handle the case where there is no data
      // The form input is a Table name 
      if (key.localeCompare('New table') == 0){
          console.log('* New table');
          variable = formData[key];
      }
      // The form input has data and is not a table name
      else { 
        console.log('* Standard parameter'); 
        // SIMPLE INPUT ---------------------------------------------------
        if(true){
          console.log('** String');
          // Check if there is a codegenstyle
          console.log('Codegenstyle', formReponse.schema.properties[key]['codegenstyle']);
          if(typeof(formReponse.schema.properties[key]['codegenstyle']) !== 'undefined'){
            if(formReponse.schema.properties[key]['codegenstyle'] === 'variable'){
              console.log('***** Dataframe input')
              formula = formula + key + '=' + formData[key] + ', '; 
            }else if(formReponse.schema.properties[key]['codegenstyle'] === 'array'){
              formula = formula + key + '=["' + formData[key].join('","') + '"], ';
            }else{
              console.log('***** Undefined codegenstyle')
            }
          } else{
            if(formData[key].localeCompare('None')  == 0){
              console.log('*** None');
              formula = formula + key + '=' + formData[key] + ', ';
              // Check if the user has defined a new variable name
            }else{
              formula = formula + key + '="' + String(formData[key]) + '", ';
            }
          }
  
        // MULTISELECT ---------------------------------------------------
        }else{
          console.log('** Multiselect (not a string');
          formula = formula + key + '=["' + formData[key].join('","') + '"], ';
          //Handle None as not a string
        }
      }
    }

    if(variable === ''){
      variable = 'data';
    }

    formula = formula.substring(0, formula.length - 2);
    formula = formula + ')';
    
    formula = variable + ' = ' + formula;

    console.log('------>Formula', formula);

    const last_cell_index = this.current_notebook.content.widgets.length - 1;
    const last_cell = this.current_notebook.content.widgets[last_cell_index];
    console.log('Last cell inded: ', last_cell_index);
    last_cell.model.value.text = formula;  

    // The code here is to run the cell 
    this.runCellAtIndex(this.current_notebook, last_cell_index);

    this.state_screen = 'transformations';
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
    this.addClass('jp-ReactWidget');
    this.addClass('input');

    // Add a notebook tracker
    this._notebook_tracker = notebooks;

    // Subscribe to signal when notebooks change
    this._notebook_tracker.currentChanged.connect(this._update_current_notebook, this);
  }

  // -------------------------------------------------------------------------------------------------------------
  // HANDLE CHANGE OF NOTEBOOK
  // -------------------------------------------------------------------------------------------------------------

  // Updates the variable that holds the  
  private async _update_current_notebook(sender: any, nbPanel: NotebookPanel ){

    console.log('NOTEBOOK CHANGED: ',nbPanel.content.title.label);
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
        this.performInspection();
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

  // This is linked in the constructor. It runs every time there is code running
  private _codeRunningOnNotebook = ( sess: ISessionContext, msg: KernelMessage.IExecuteInputMsg ) => {
    let msgType = msg.header.msg_type;
    switch ( msgType ) {
        case 'execute_input':
            let code = msg.content.code;
            // Check this is not my code running
            if(!(code == this.inspector_script) && !(code == this._initScripts) && !(code == this._codeToRequestForm)){
              console.log('Code running');
              this.performInspection();
            }
            //if(code == this._codeToRequestForm){
            //  this._signal.emit();
            //}
            break;
        default:
            break;
    }
  };

  // This sends a request to the Kernel to get a list of dataframes
  private performInspection(): void {
    let content: KernelMessage.IExecuteRequestMsg['content'] = {
        code: this.inspector_script,
        stop_on_error: false,
        store_history: false
    };
    this._connector.fetch( content, this._handleQueryResponse );
  };

  private async requestTransformationForm(){
    // Check that there is a transformation selection and a table selection
    if(this.transformationSelection && this.tableSelection){
      
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

      // Update the state to indicate that we are now ready to show a formula field
      this.show_formula_fields = true;
      this._signal.emit();
    }
  }

  // This formats the dataframes that we are reading to show them in the UI
  private _handleQueryResponse = ( response: KernelMessage.IIOPubMessage ): void => {
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
      }else{
        console.log('Refreshing dataframes');
        this.state_screen = 'transformations';
        this.generateDataFrameSelectionForm(dataframes);
      }
      // Emit signal to re-render the component
      this._signal.emit();
    }
  };

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
  // RENDER
  // -------------------------------------------------------------------------------------------------------------

  // Render
  render(): JSX.Element {
    return <UseSignalComponent signal={this._signal} logic={this} />;
  }
}
