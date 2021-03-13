const mapFormResponseToPythonCode = (
  fieldInput: any,
  fieldSchema: any,
  dataframeSelection: string
): string => {
  console.log('field fieldInput', fieldInput);
  console.log('field schema', fieldSchema);
  console.log('field schema type', typeof fieldSchema['$ref']);

  /*----------------------------------------------------------------------------------------------------------
    CASE A: Custom code generation style
  ----------------------------------------------------------------------------------------------------------*/
  if (typeof fieldSchema['codegenstyle'] !== 'undefined') {
    console.log('1. CodeGenStyle detected');
    const codeGenStyle = fieldSchema['codegenstyle'];

    /*----------------------------------------------------------------------------------------------------------
      VARIABLES
    ----------------------------------------------------------------------------------------------------------*/
    if (codeGenStyle.localeCompare('variable') === 0) {
      console.log('1.1 Variable codegenstyle');
      return fieldInput;
    }

    /*----------------------------------------------------------------------------------------------------------
      SERIES COLUMN
    ----------------------------------------------------------------------------------------------------------*/
    // CASE where a series is passed as df[Series_Name]
    else if (codeGenStyle.localeCompare('seriesColumn') === 0) {
      console.log('1.2 Column as series');
      return dataframeSelection + '["' + fieldInput + '"]';
    }
    console.log('WARNING: No codeGenStyle');
  } else if (typeof fieldSchema['$ref'] !== 'undefined') {
  /*----------------------------------------------------------------------------------------------------------
    CASE B: Reference to a column definition
  ----------------------------------------------------------------------------------------------------------*/
    // Specific hardcoded cases
    console.log('2. REF detected');
    if (fieldSchema['$ref'].includes('columns')) {
      console.log('2.1 Column multi-select detected');
      return JSON.stringify(fieldInput);
    } else if (
      fieldSchema['$ref'].localeCompare('#/definitions/column') === 0
    ) {
      console.log('2.2 Column single-select detected');
      return '"' + fieldInput + '"';
    }
    console.log('WARNING: No ref found');
  } else if (fieldSchema['type'].localeCompare('array') === 0) {
  /*----------------------------------------------------------------------------------------------------------
    CASE C: Array
  ----------------------------------------------------------------------------------------------------------*/
    console.log('3. Array detected');
    // Array of variables, i.e. no quotation marks
    if (typeof fieldSchema.items['codegenstyle'] !== 'undefined') {
      console.log('3.1 Array of variables');
      const codeGenStyle = fieldSchema.items['codegenstyle'];
      if (codeGenStyle.localeCompare('variable') === 0) {
        return (
          '[' + fieldInput.map((item: any) => item.replace('/\\"/g', '')) + ']'
        );
      }
    }
    // Standard array of strings
    else if (fieldSchema.items['type'].localeCompare('string') === 0) {
      console.log('3.2 Array of strings');
      return JSON.stringify(fieldInput);
    } else if (fieldSchema.items['type'].localeCompare('number') === 0) {
      console.log('3.3 Array of numbers');
      return JSON.stringify(fieldInput);
    }
  } else if (fieldSchema['type'].localeCompare('string') === 0) {
  /*----------------------------------------------------------------------------------------------------------
    CASE E: Standard jsonschema form types STRING/NUMBER
  ----------------------------------------------------------------------------------------------------------*/
    console.log('4. String detected');
    console.log('String detected');
    return '"' + fieldInput + '"';
  } else if (fieldSchema['type'].localeCompare('number') === 0) {
    console.log('5. Number detected');
    return fieldInput;
  }

  console.log('---------------------------------------');
};

// Generate python code and write in the notebook
export const generatePythonCode = (
  formResponse: any,
  dataframeSelection: string
): PythonCode => {
  // Commented out python implementation of the same functionality
  //logic.pythonGenerateCodeAndRun(formReponse, state.dataframeSelection);
  // COMMENTED OUT CODE IS REPLACED BY PYTHON FUNCTION TO MAKE DEVELOPMENT FASTER
  console.log('------------------- Generating form code -------------------');
  console.log('CG: Data submitted: ', formResponse);

  /*-------------------------------------------------------------------
  Process formula with this pattern:
    resultVariable = caller_object.transformation(parameters)
      1. Generate caller object & transformation selection
      2. Process every parameter input
      3. Assign to result to variable
  --------------------------------------------------------------------*/

  const formData = formResponse.formData;
  let transformationSelection: string = formResponse.schema.function;
  let callerObject: string = formResponse.schema.callerObject;

  // The result will be saved in one variable: resultVariable = object.transformation(parameters)
  // This variable is of type dataframe by default
  let resultVariable = '';

  /*-------------------------------------------------------------------
    1. Generate caller object
  --------------------------------------------------------------------*/
  // Compose the caller object
  if (typeof callerObject !== 'undefined') {
    if (callerObject.includes('DataFrame') === true) {
      // If there is no dataframe selection, calling from pandas
      console.log('CG: Caller is Dataframe object');
      callerObject = callerObject.replace('DataFrame', dataframeSelection);
    }
    if (callerObject.includes('Series') === true) {
      // In case of a series, the formula becomes df[series] = df[series].function(params)
      console.log('CG: Caller is Series object');
      // Replace the callerobject series placeholder with the value from the column parameter
      const seriesString = '"' + formData['column'] + '"';
      callerObject = callerObject.replace('Series', seriesString);
    }
  }

  // In the initial state to load data, no explicit transformation has been selected by the user
  // thus, we need to initalize it
  if (!transformationSelection) {
    transformationSelection = 'read_csv';
  }

  let formula: string;
  let transformationType = 'function';
  // Formula that will be generated in the form of: object.transformation(parameters)
  if (typeof formResponse.schema.transformationType !== 'undefined') {
    console.log('CG: Transformation type defined');
    transformationType = formResponse.schema.transformationType;
  }

  if (transformationType.localeCompare('property') === 0) {
    formula = callerObject + '.' + transformationSelection;
  } else if (typeof callerObject === 'undefined') {
    formula = transformationSelection + '(';
  } else {
    formula = callerObject + '.' + transformationSelection + '(';
  }

  /*-------------------------------------------------------------------
    2. Determine what the return type will be
  --------------------------------------------------------------------*/

  let returnType = '';
  // Determine the type of the result variable. Default is dataframe
  if (typeof formResponse.schema.returnType !== 'undefined') {
    console.log('CG: Defined return type in schema');
    returnType = formResponse.schema.returnType;
  } else {
    if (
      typeof formResponse.schema.properties['new variable name'] !== 'undefined'
    ) {
      returnType = 'variable';
    } else if (
      typeof formResponse.schema.properties['new column name'] !== 'undefined'
    ) {
      returnType = 'series';
    } else {
      returnType = 'dataframe';
    }
  }

  /*-------------------------------------------------------------------
   Use the object selectino dropdown as a parameter input
   E.g. px.line(df, ...) 
  --------------------------------------------------------------------*/
  // If there is a selectionAsParameter config and it's set to true,
  // add a first parameter that is equal to the dataframe selection
  if (typeof formResponse.schema.selectionAsParameter !== 'undefined'
      && formResponse.schema.selectionAsParameter === true) {
      formula = formula + dataframeSelection + ',';
  }

  /*-------------------------------------------------------------------
    3. Process every parameter input
  --------------------------------------------------------------------*/
  // Process every input
  let parameterCounter = 0;
  for (const key in formData) {
    const parameterPrefix = '\n    ';
    const fieldInput = formData[key];
    let fieldSchema = null;
    console.log('CG: Parameter', key);

    /*----------------------------------------------------------------------------------------------------------
    3.1: Find schema for the field
    ----------------------------------------------------------------------------------------------------------*/
    if (typeof formResponse.schema.properties[key] !== 'undefined') {
      fieldSchema = formResponse.schema.properties[key];
    }
    // Check if we can't find it because it is part of a schema dependency
    else if (typeof formResponse.schema.dependencies !== 'undefined') {
      // Name of the field that holds the dependencies. WE ONLY SUPPORT ONE FIELD
      const modeFieldName = Object.keys(formResponse.schema.dependencies)[0];

      // Get mode selected by the user
      const selectedMode = formData[modeFieldName];
      // Get index of that mode
      const selectedModeIndex = formResponse.schema.properties[modeFieldName][
        'enum'
      ].findIndex(element => element.localeCompare(selectedMode) === 0);
      console.log('SELECTED MODE INDEX', selectedModeIndex);
      console.log(
        '--->',
        formResponse.schema.dependencies[modeFieldName]['oneOf'][selectedModeIndex]
      );

      // Get the schema from the dependencies
      fieldSchema =
        formResponse.schema.dependencies[modeFieldName]['oneOf'][selectedModeIndex]
          .properties[key];
    }
    console.log('CG: Field schema', fieldSchema);

    /*----------------------------------------------------------------------------------------------------------
    3.2: Process the result parameters
    ----------------------------------------------------------------------------------------------------------*/
    // Check if we save to a variable or just print in the notebook
    // IF specified by the user, set the name of the result
    if (
      key.localeCompare('new table name') === 0 &&
      returnType.localeCompare('print') !== 0
    ) {
      console.log('CG: 3.2 New table name detected');
      if (typeof formData[key] !== 'undefined') {
        console.log('CG: 3.2 User entered table name');
        resultVariable = formData[key].replace(/ /g, '_');
      }
    } else if (
      key.localeCompare('new column name') === 0 &&
      returnType.localeCompare('print') !== 0
    ) {
      console.log('CG: 3.2 New column name detected');
      if (typeof formData[key] !== 'undefined') {
        console.log('CG: User entered series name');
        resultVariable =
          dataframeSelection + '["' + formData[key].replace(/ /g, '_') + '"]';
      }
    } else if (
      key.localeCompare('new variable name') === 0 &&
      returnType.localeCompare('print') !== 0
    ) {
      console.log('CG: 3.2 New variable name detected');
      if (typeof formData[key] !== 'undefined') {
        console.log('CG: User entered variable name');
        resultVariable = formData[key].replace(/ /g, '_');
      }
    }
    // IGNORE the fields marked as ignore
    else if (
      typeof fieldSchema['codegenstyle'] !== 'undefined' &&
      fieldSchema['codegenstyle'].localeCompare('ignore') === 0
    ) {
      //ignore
      console.log('CG: Ignore column field');
    }
    /*----------------------------------------------------------------------------------------------------------
    3.3: Handle complex arrays
    ----------------------------------------------------------------------------------------------------------*/
    // Build an object of type {key: value, key:value, ..} with an array consisting of two inputs
    else if (
      typeof fieldSchema['type'] !== 'undefined' &&
      fieldSchema['type'].localeCompare('array') === 0 &&
      typeof fieldSchema['items']['type'] !== 'undefined' &&
      fieldSchema['items']['type'].localeCompare('object') === 0
    ) {
      console.log('CG: 3.3 Complex object');
      let parameterDict = '{';
      const mapperProperties = fieldSchema.items.properties;
      // Firs element is the key
      const mapperKey = Object.keys(mapperProperties)[0];
      // Second element is the value
      const mapperValue = Object.keys(mapperProperties)[1];

      console.log(
        'Sub-field schema for key',
        fieldSchema.items.properties[mapperKey]
      );
      for (const dict of formData[key]) {
        const key = mapFormResponseToPythonCode(
          dict[mapperKey],
          fieldSchema.items.properties[mapperKey],
          dataframeSelection
        );
        const value = mapFormResponseToPythonCode(
          dict[mapperValue],
          fieldSchema.items.properties[mapperValue],
          dataframeSelection
        );
        parameterDict = parameterDict + key + ' : ' + value + ', ';
      }

      parameterDict = parameterDict.substring(0, parameterDict.length - 2);
      parameterDict = parameterDict + '}';
      console.log('Aggregation Dict', parameterDict);
      parameterDict = parameterPrefix + key + '=' + parameterDict;
      formula = formula + parameterDict + ', ';
      parameterCounter += 1;
    } else {
      /*----------------------------------------------------------------------------------------------------------
    3.4: Handle standard fields according to type
    ----------------------------------------------------------------------------------------------------------*/
      console.log('------- MAP FORM RESPONSE:', key);
      const mappedFieldResponse = mapFormResponseToPythonCode(
        fieldInput,
        fieldSchema,
        dataframeSelection
      );
      formula =
        formula + parameterPrefix + key + '=' + mappedFieldResponse + ', ';
      console.log('Mapped field', formula);
      parameterCounter += 1;
    }
  }

  // Handle the case of 0 parameters found
  if (parameterCounter !== 0) {
    // Remove last comma and space given there are no more parameters
    formula = formula.substring(0, formula.length - 2);
  }

  // Close parenthesis for functions, leave as is for properties (object.property)
  if (transformationType.localeCompare('property') !== 0) {
    formula = formula + ')';
  }

  /*-------------------------------------------------------------------
    4. Handle defaults when there is no result variable defined
  --------------------------------------------------------------------*/

  /*------------------------------------
    4.1 Result is a dataframe
  ------------------------------------*/
  if (returnType.localeCompare('dataframe') === 0) {
    console.log('CG: 3.1 Return type is dataframe');
    // If no target variable, and calling from a given dataframe apply transformation to this dataframe
    if (
      resultVariable === '' &&
      dataframeSelection !== null &&
      transformationType !== 'dataLoading'
    ) {
      console.log('CG: 4.1.1 Result defaults: Use selected dataframe');
      resultVariable = dataframeSelection;
    }
    // else if dataframe not defined (only case is read_csv), name it data
    else if (resultVariable === '' && dataframeSelection === null) {
      console.log('CG: 4.1.2 Result defaults: no dataframe selected');
      resultVariable = 'data';
    }
    // If the variable is written above no need to handle default cases
    else if (resultVariable === '') {
      console.log('CG: 4.1.3 Catch remaining cases');
      resultVariable = 'data';
    }
  } else if (returnType.localeCompare('series') === 0) {
    /*------------------------------------
    4.2 Result is a series
  ------------------------------------*/
    console.log('CG: 4.2 Return type is series');
    // This covers both scenarios df->series and series->series

    let resultColumnName = '';

    // If not defined, change the column that has been selected
    if (resultVariable === '') {
      // Find the column that has a column definition to use
      for (const key in formResponse.schema.properties) {
        const colSchema = formResponse.schema.properties[key];
        if (typeof colSchema['$ref'] !== 'undefined') {
          console.log('Ref found', colSchema['$ref']);
          if (colSchema['$ref'].localeCompare('#/definitions/column') === 0) {
            console.log('CG: 4.2.1 Result defaults: Using default column');
            resultColumnName = formData[key];
            break;
          }
        }
      }
      if (resultColumnName === '') {
        // This handle the case pandasObject -> series, where a column definition has not been found
        console.log('CG: 4.2.2 Result defaults: No column found');
        resultColumnName = 'new column';
      }
      resultVariable = dataframeSelection + '["' + resultColumnName + '"]';
    }
  } else if (returnType.localeCompare('variable') === 0) {
    /*------------------------------------
    4.3 Result is a variable
  ------------------------------------*/
    console.log('CG: 4.3 Return type is variable');
    if (resultVariable === '') {
      console.log('CG: 4.3.1 Result defaults: Using var');
      resultVariable = 'var';
    }
  }

  // Handle the case where we do not save the result to a variable and we just want to print to a notebook
  if (returnType.localeCompare('none') !== 0) {
    formula = resultVariable + ' = ' + formula;
  }

  // Handle the cases where we append something at the end
  if (typeof formResponse.schema.append !== 'undefined') {
    formula = formula + formResponse.schema.append;
  }

  // In the case the ruturn type is a series, remove the column name from the variable
  // i.e. df instead of df['col name']
  let resultDataFrame = resultVariable;
  if (returnType.localeCompare('series') == 0) {
    resultDataFrame = dataframeSelection;
  }

  console.log('RESULT DF', resultDataFrame);
  console.log('FORMULA: ', formula);
  return {
    formula: formula,
    resultVariable: resultDataFrame,
    returnType: returnType
  };
};

type PythonCode = {
  formula: string;
  resultVariable: string;
  returnType: string;
};
