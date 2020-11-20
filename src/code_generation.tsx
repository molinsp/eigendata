const mapFormResponseToPythonCode = ( fieldInput: any, fieldSchema: any, dataframeSelection: string) => {
  console.log('field fieldInput', fieldInput);
  console.log('field schema', fieldSchema);
  console.log('field schema type', typeof(fieldSchema['$ref']));
  
  /*----------------------------------------------------------------------------------------------------------
    CASE 1: Custom code generation style 
  ----------------------------------------------------------------------------------------------------------*/
  if(typeof(fieldSchema['codegenstyle']) !== 'undefined'){
    console.log('1. Codegenstyle detected');
    const codegenstyle = fieldSchema['codegenstyle'];
    if(codegenstyle.localeCompare('variable') == 0){
      console.log('1.1 Variable codegenstyle')
      return fieldInput;
    }
    // CASE where a series is passsed as df[Series_Name]
    else if (codegenstyle.localeCompare('seriesColumn') == 0){
      console.log('1.2 Column as series');
      return dataframeSelection + '["' + fieldInput + '"]';
    }
    console.log('WARNING: No codegenstyle');
  }
  /*----------------------------------------------------------------------------------------------------------
    CASE 2: Reference to a column definition
  ----------------------------------------------------------------------------------------------------------*/
  else if(typeof(fieldSchema['$ref']) !== 'undefined'){
    // Specific hardcoded cases
    console.log('2. REF detected');
    if(fieldSchema['$ref'].includes('columns')){    
      console.log('2.1 Column multi-select detected');
      return JSON.stringify(fieldInput);
    }else if(fieldSchema['$ref'].localeCompare('#/definitions/column') == 0){
      console.log('2.2 Column single-select detected');
      const inputAsString = '"' + fieldInput + '"';
      return inputAsString;
    }
    console.log('WARNING: No ref found');
  }
  /*----------------------------------------------------------------------------------------------------------
    CASE 3: Array
  ----------------------------------------------------------------------------------------------------------*/
  else if(fieldSchema['type'].localeCompare('array') == 0){
    console.log('3. Array detected');
    // Array of variables, i.e. no quotation marks
    if((typeof(fieldSchema.items['codegenstyle']) !== 'undefined')){
      console.log('3.1 Array of variables');
      const codegenstyle = fieldSchema.items['codegenstyle'];
      if(codegenstyle.localeCompare('variable') == 0){
        const removedQuotations = '[' + fieldInput.map((item: any) => item.replace( '/\\"/g', '' )) + ']';
        return removedQuotations;
      }
    }
    // Standard array of strings
    else if(fieldSchema.items['type'].localeCompare('string') == 0){
      console.log('3.2 Array of strings');
      return JSON.stringify(fieldInput);
    }
    else if(fieldSchema.items['type'].localeCompare('number') == 0){
      console.log('3.3 Array of numbers');
      return JSON.stringify(fieldInput);
    }

  }
  /*----------------------------------------------------------------------------------------------------------
    CASE 4: Standard hsonschema form types
  ----------------------------------------------------------------------------------------------------------*/
  else if(fieldSchema['type'].localeCompare('string') == 0){
    console.log('4. String detected');
    console.log('String detected');
    const inputAsString = '"' + fieldInput + '"';
    return inputAsString;
  }
  else if(fieldSchema['type'].localeCompare('number') == 0){
    console.log('5. Number detected');
    return fieldInput;
  }

  console.log('---------------------------------------');

}

// Generate python code and write in the notebook
export const generatePythonCode = ( formReponse: any, dataframeSelection: string) => {
  // Commented out python implementation of the same functionality
  //logic.pythonGenerateCodeAndRun(formReponse, state.dataframeSelection); 
  // COMMENTED OUT CODE IS REPLACED BY PYTHON FUNCTION TO MAKE DEVELOPMENT FASTER
  console.log('------------------- Generating form code -------------------');
  console.log("CG: Data submitted: ", formReponse);

  /*-------------------------------------------------------------------
  Process formula with this pattern:
    result_variable = caller_object.transformation(parameters)
      1. Generate caller object & transformation selection
      2. Process every parameter input
      3. Assign to result to variable
  --------------------------------------------------------------------*/

  const formData = formReponse.formData;
  let transformationSelection: string = formReponse.schema.function;
  let callerObject: string =  formReponse.schema.callerObject;
  
  // The result will be saved in one variable: result_variable = object.transformation(parameters)
  // This variable is of type dataframe by default
  let result_variable: string = '';

  /*-------------------------------------------------------------------
    1. Generate caller object 
  --------------------------------------------------------------------*/
  // Compose the caller object
  if(callerObject.includes('DataFrame') == true){
  // If there is no dataframe selection, calling from pandas
    console.log('CG: Caller is Dataframe object');
    callerObject = callerObject.replace('DataFrame',dataframeSelection);
  }
  if(callerObject.includes('Series') == true){
  // In case of a series, the formula becomes df[series] = df[series].function(params)
    console.log('CG: Caller is Series object');
    // Replace the callerobject series placeholder with the value from the column parameter
    const seriesString = '"' + formData['column'] + '"';
    callerObject = callerObject.replace('Series',seriesString);
  }

  // In the initial state to load data, no explicit transformation has been selected by the user
  // thus, we need to initalize it
  if(!transformationSelection){
    transformationSelection = 'read_csv';
  }

  let formula: string;
  let transformationType: string = 'function';
  // Formula that will be generated in the form of: object.transformation(parameters)
  if(typeof(formReponse.schema.transformationType) !== 'undefined'){
    console.log('CG: Transformation type defined');
    transformationType = formReponse.schema.transformationType;
  }

  if (transformationType.localeCompare('property')==0){
    formula = callerObject + '.' + transformationSelection; 
  }else{
    formula = callerObject + '.' + transformationSelection + '('; 
  }

  /*-------------------------------------------------------------------
    2. Determine what the return type will be
  --------------------------------------------------------------------*/  

  let returnType = '';
  // Determine the type of the result variable. Default is dataframe
  if(typeof(formReponse.schema.returnType) !== 'undefined'){
    console.log('CG: Defined return type in schema');
    returnType = formReponse.schema.returnType;
  }else{
    if(typeof(formReponse.schema.properties['New variable name']) !== 'undefined'){
      returnType = 'variable';
    }else if(typeof(formReponse.schema.properties['New column name']) !== 'undefined'){
      returnType = 'series';
    }else{
      returnType = 'dataframe';
    }
  } 

  /*-------------------------------------------------------------------
    3. Process every parameter input
  --------------------------------------------------------------------*/
  // Process every input
  let parameter_counter = 0;
  for (var key in formData) {
    let parameterPrefix: string = '\n    '; 
    const fieldInput = formData[key];
    let fieldSchema = null;

    /*----------------------------------------------------------------------------------------------------------
    3.1: Find schema for the field
    ----------------------------------------------------------------------------------------------------------*/
    if(typeof(formReponse.schema.properties[key]) !== 'undefined'){
      fieldSchema = formReponse.schema.properties[key];
    }
    // Check if we can't find it because it is part of a schema dependency
    else if (typeof(formReponse.schema.properties['mode']) !== 'undefined'){
      const selectedMode = formData['mode'];
      const selectedModeIndex = formReponse.schema.properties['mode']['enum'].findIndex((element) => element.localeCompare(selectedMode) == 0);
      console.log('SELECTED MODE INDEX', selectedModeIndex);
      console.log('--->', formReponse.schema.dependencies.mode['oneOf'][selectedModeIndex]);
      fieldSchema = formReponse.schema.dependencies.mode['oneOf'][selectedModeIndex].properties[key];
    }

    /*----------------------------------------------------------------------------------------------------------
    3.2: Process the result parameters
    ----------------------------------------------------------------------------------------------------------*/
    // Check if we save to a variable or just print in the notebook
    // IF specified by the user, set the name of the result
    if (key.localeCompare('New table name') == 0 && returnType.localeCompare('print') != 0){
      console.log('CG: Result is dataframe');
      result_variable = formData[key].replace(/ /g,"_");
    }
    else if(key.localeCompare('New column name') == 0 && returnType.localeCompare('print') != 0){
      console.log('CG: Result is series');
      result_variable = dataframeSelection + '["' + formData[key].replace(/ /g,"_") + '"]';
    }
    else if(key.localeCompare('New variable name') == 0 && returnType.localeCompare('print') != 0){
      console.log('CG: Result is variable');
      result_variable = formData[key].replace(/ /g,"_");
    }
    // IGNORE the fields marked as ignore
    else if((typeof(fieldSchema['codegenstyle']) !== 'undefined')
            && (fieldSchema['codegenstyle'].localeCompare('ignore') == 0)
      ){
      //ignore
      console.log('CG: Ignore column field');
    }
    /*----------------------------------------------------------------------------------------------------------
    3.3: Handle complex arrays
    ----------------------------------------------------------------------------------------------------------*/ 
    // Build an object of type {key: value, key:value, ..} with an array consisting of two inputs
    else if((typeof(fieldSchema['type']) !== 'undefined')
        && (fieldSchema['type'].localeCompare('array') == 0)  
        && (typeof(fieldSchema['items']['type']) !== 'undefined')   
        && (fieldSchema['items']['type'].localeCompare('object') == 0)
      ){ 
      console.log('Complex object');
      var parameterDict = '{'
      const mapperProperties = fieldSchema.items.properties;
      // Firs element is the key
      const mapperKey = Object.keys(mapperProperties)[0];
      // Second element is the value
      const mapperValue = Object.keys(mapperProperties)[1];

      console.log('Sub-field schema for key', fieldSchema.items.properties[mapperKey]);
      for(const dict of formData[key]){
          const key = mapFormResponseToPythonCode(dict[mapperKey], fieldSchema.items.properties[mapperKey], dataframeSelection);
          const value = mapFormResponseToPythonCode(dict[mapperValue], fieldSchema.items.properties[mapperValue], dataframeSelection);
          parameterDict = parameterDict  + key + ' : ' + value + ', ';
      }

      parameterDict = parameterDict.substring(0,parameterDict.length - 2);
      parameterDict = parameterDict + '}';
      console.log('Aggregation Dict',parameterDict);
      parameterDict = parameterPrefix + key + '=' + parameterDict;
      formula = formula + parameterDict + ', ';
      parameter_counter +=1;
    }
    /*----------------------------------------------------------------------------------------------------------
    3.4: Handle standard fields according to type 
    ----------------------------------------------------------------------------------------------------------*/ 
    else{
      console.log('------- MAP FORM RESPONSE:',key);
      const mappedFieldResponse = mapFormResponseToPythonCode(fieldInput, fieldSchema, dataframeSelection);
      formula = formula + parameterPrefix + key + '=' + mappedFieldResponse + ', ';
      console.log('Mapped field', formula); 
      parameter_counter +=1;
    }
  }

  // Handle the case of 0 parameters found
  if(parameter_counter != 0){
    // Remove last comma and space given there are no more parameters
    formula = formula.substring(0, formula.length - 2);
  }

  // Close parethenis for functions, leave as is for properties (object.property)
  if(transformationType.localeCompare('property')==0){
    formula = formula;
  }else{
    formula = formula + ')';
  }

  /*-------------------------------------------------------------------
    4. Handle defaults when there is no result variable defined
  --------------------------------------------------------------------*/

  /*------------------------------------
    4.1 Result is a dataframe
  ------------------------------------*/
  if(returnType.localeCompare('dataframe') == 0){
    console.log('CG: 3.1 Return type is dataframe');
    // If no target variable, and calling from a given dataframe apply transformation to this dataframe
    if((result_variable === '') && (dataframeSelection !== null)){
      console.log('CG: 3.1.1 Result defaults: Use selected dataframe');
      result_variable = dataframeSelection;
    }
    // else if dataframe not defined (only case is read_csv), name it data
    else if ((result_variable === '') && (dataframeSelection === null)){
      console.log('CG: 3.1.2 Result defaults: no dataframe selected');
      result_variable = 'data';
    }
  }
  /*------------------------------------
    4.2 Result is a series
  ------------------------------------*/
  else if(returnType.localeCompare('series') == 0){
    console.log('CG: 3.2 Return type is series');
    // This covers both scenarios df->series and series->series
        
    var result_column_name = '';

    // If not defined, change the column that has been selected
    if(result_variable === ''){
     // Find the column that has a column definition to use
     for (var key in formReponse.schema.properties) {
       let col_schema = formReponse.schema.properties[key];
       if(typeof(col_schema['$ref']) !== 'undefined'){
          console.log('Ref found', col_schema['$ref']);
          if(col_schema['$ref'].localeCompare('#/definitions/column') == 0){ 
            console.log('CG: 3.2.1 Result defaults: Using default column');
            result_column_name = formData[key];
            break;               
          }
       }
     }
     if(result_column_name == ''){
       // This handle the case pandasObject -> series, where a column definition has not been found
       console.log('CG: 3.2.2 Result defaults: No column found');
       result_column_name = 'new column';
     }
     result_variable =  dataframeSelection + '["' + result_column_name + '"]';
    }
  }
  /*------------------------------------
    4.3 Result is a variable
  ------------------------------------*/
  else if (returnType.localeCompare('variable') == 0){
    console.log('CG: 3.3 Return type is variable');
    if(result_variable === ''){
      console.log('CG: 3.3.1 Result defaults: Using var');
      result_variable = 'var';
    }
  }
  
  // Handle the case where we do not save the result to a variable and we just want to print to a notebook
  if(returnType.localeCompare('print') != 0){
    formula = result_variable + ' = ' + formula;
  }

  // Handle the cases where we append something at the end
  if(typeof(formReponse.schema.append) != 'undefined'){
    formula = formula + formReponse.schema.append;
  }

  console.log('FORMULA: ', formula);
  return formula;
 };
