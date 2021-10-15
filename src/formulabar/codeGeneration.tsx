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
    if (codeGenStyle === 'variable') {
      console.log('1.1 Variable codegenstyle');
      return fieldInput;
    }

    /*----------------------------------------------------------------------------------------------------------
      SERIES COLUMN
    ----------------------------------------------------------------------------------------------------------*/
    // CASE where a series is passed as df[Series_Name]
    else if (codeGenStyle === 'seriesColumn') {
      console.log('1.2 Column as series');
      return dataframeSelection + '["' + fieldInput + '"]';
    }
    /*----------------------------------------------------------------------------------------------------------
      SERIES COLUMN LIST 
    ----------------------------------------------------------------------------------------------------------*/
    // CASE where a series is passed as [df[Series_Name_1], df[Series_Name_2]]
    else if (codeGenStyle === 'seriesColumnList') {
      let seriesColumnList = fieldInput.map((listElement) => {
          return dataframeSelection + '["' + listElement + '"]'
      });
      console.log('1.2 Column as series list');
      return '[' + seriesColumnList.join(',') + ']';
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
      fieldSchema['$ref'] === '#/definitions/column'
    ) {
      console.log('2.2 Column single-select detected');
      return '"' + fieldInput + '"';
    }
    console.log('WARNING: No ref found');
  } else if (fieldSchema['type'] === 'array') {
  /*----------------------------------------------------------------------------------------------------------
    CASE C: Array
  ----------------------------------------------------------------------------------------------------------*/
    console.log('3. Array detected');
    // Array of variables, i.e. no quotation marks
    if (typeof fieldSchema.items['codegenstyle'] !== 'undefined') {
      console.log('3.1 Array of variables');
      const codeGenStyle = fieldSchema.items['codegenstyle'];
      if (codeGenStyle === 'variable') {
        return (
          '[' + fieldInput.map((item: any) => item.replace('/\\"/g', '')) + ']'
        );
      }
    }
    // Standard array of strings
    else if (fieldSchema.items['type'] === 'string') {
      console.log('3.2 Array of strings');
      return JSON.stringify(fieldInput);
    } else if (fieldSchema.items['type'] === 'number') {
      console.log('3.3 Array of numbers');
      return JSON.stringify(fieldInput);
    }
  } else if (fieldSchema['type'] === 'string') {
  /*----------------------------------------------------------------------------------------------------------
    CASE E: Standard jsonschema form types STRING/NUMBER
  ----------------------------------------------------------------------------------------------------------*/
    console.log('4. String detected');
    console.log('String detected');
    if (fieldInput === "None"){
      return fieldInput;  
    }
    else{
      return '"' + fieldInput + '"';
    }
  } else if (fieldSchema['type'] === 'number') {
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

  if (transformationType === 'property') {
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
  console.log('CG: Return type', returnType);

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

  /*-------------------------------
     MERGE ALL DEPENDENCIES
  --------------------------------*/
  let effectivePropertiesSchema = formResponse.schema.properties;
  console.log('CG: effectivePropertiesSchema', effectivePropertiesSchema);
  if(typeof formResponse.schema.dependencies !== 'undefined'){
    for (const dependencyParameter in formResponse.schema.dependencies){
      console.log('CG: Merging dependency for ', dependencyParameter);
      // Get dependency selected by the user
      const selectedDependency = formData[dependencyParameter];

      console.log('CG: Dependency input value ', selectedDependency);

      // Find the index of that dependency, i.e. is it the 0th, 1st, 2nd element
      const selectedDependencyEnumIndex = formResponse.schema.properties[dependencyParameter][
        'enum'
      ].findIndex(element => element === selectedDependency);
      
      console.log('CG: Selected dependency item ', selectedDependencyEnumIndex);

      // Copy the schema from the dependency object
      const schemaFromDependency = formResponse.schema.dependencies[dependencyParameter]['oneOf'][selectedDependencyEnumIndex].properties;

      // Delete the property that is used to stitch schemas
      // In the dependency object there is a property that indicates which dependency should be rendered. 
      // This needs to be removed when merging with the main schema according to selected dependency
      delete schemaFromDependency[dependencyParameter];
      console.log('CG: Dependency object to append', schemaFromDependency);

      effectivePropertiesSchema = Object.assign(
        schemaFromDependency
        , effectivePropertiesSchema);
    }
  }
  console.log('CG: Effective Property Schema', effectivePropertiesSchema);

  /*-------------------------------------------------------------------
    3. Process every parameter input
  --------------------------------------------------------------------*/
  // Process every input
  let parameterCounter = 0;
  for (const parameterName in formData) {
    const startNewLine = '\n    ';
    const fieldInput = formData[parameterName];
    let fieldSchema = effectivePropertiesSchema[parameterName];
    console.log('CG: Parameter', parameterName);

    /*----------------------------------------------------------------------------------------------------------
    3.2: Process the result parameters
    ----------------------------------------------------------------------------------------------------------*/
    // Check if we save to a variable or just print in the notebook
    // IF specified by the user, set the name of the result
    if (
      parameterName === 'new table name'
    ) {
      console.log('CG: 3.2 New table name detected');
      if (typeof formData[parameterName] !== 'undefined') {
        console.log('CG: 3.2 User entered table name');
        resultVariable = formData[parameterName].replace(/ /g, '_');
      }
    } else if (
      parameterName === 'new column name' &&
      returnType !== 'print'
    ) {
      console.log('CG: 3.2 New column name detected');
      if (typeof formData[parameterName] !== 'undefined') {
        console.log('CG: User entered series name');
        resultVariable =
          dataframeSelection + '["' + formData[parameterName].replace(/ /g, '_') + '"]';
      }
    } else if (
      parameterName === 'new variable name' && returnType !== 'print'
    ) {
      console.log('CG: 3.2 New variable name detected');
      if (typeof formData[parameterName] !== 'undefined') {
        console.log('CG: User entered variable name');
        resultVariable = formData[parameterName].replace(/ /g, '_');
      }
    }
    // IGNORE the fields marked as ignore
    else if (
      typeof fieldSchema['codegenstyle'] !== 'undefined' &&
      fieldSchema['codegenstyle'] === 'ignore'
    ) {
      //ignore
      console.log('CG: Ignore column field');
    }
    /*----------------------------------------------------------------------------------------------------------
    3.3: Handle complex arrays
    ----------------------------------------------------------------------------------------------------------*/
    // Build an object of type {parameterName: value, parameterName:value, ..} with an array consisting of two inputs
    else if (
      typeof fieldSchema['type'] !== 'undefined' &&
      fieldSchema['type'] === 'array' &&
      typeof fieldSchema['items']['type'] !== 'undefined' &&
      fieldSchema['items']['type'] === 'object'
    ) {
      console.log('CG: 3.3 Complex object');
      let parameterDict = '{';
      const mapperProperties = fieldSchema.items.properties;
      // Firs element is the parameterName
      const mapperKey = Object.keys(mapperProperties)[0];
      // Second element is the value
      const mapperValue = Object.keys(mapperProperties)[1];

      console.log(
        'Sub-field schema for parameterName',
        fieldSchema.items.properties[mapperKey]
      );
      for (const dict of formData[parameterName]) {
        const parameterName = mapFormResponseToPythonCode(
          dict[mapperKey],
          fieldSchema.items.properties[mapperKey],
          dataframeSelection
        );
        const value = mapFormResponseToPythonCode(
          dict[mapperValue],
          fieldSchema.items.properties[mapperValue],
          dataframeSelection
        );
        parameterDict = parameterDict + parameterName + ' : ' + value + ', ';
      }

      parameterDict = parameterDict.substring(0, parameterDict.length - 2);
      parameterDict = parameterDict + '}';
      console.log('Aggregation Dict', parameterDict);
      parameterDict = startNewLine + parameterName + '=' + parameterDict;
      formula = formula + parameterDict + ', ';
      parameterCounter += 1;
    } else {
      /*----------------------------------------------------------------------------------------------------------
    3.4: Handle standard fields according to type
    ----------------------------------------------------------------------------------------------------------*/
      console.log('------- MAP FORM RESPONSE:', parameterName);
      const mappedFieldResponse = mapFormResponseToPythonCode(
        fieldInput,
        fieldSchema,
        dataframeSelection
      );
      formula =
        formula + startNewLine + parameterName + '=' + mappedFieldResponse + ', ';
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
  if (transformationType !== 'property') {
    formula = formula + ')';
  }

  /*-------------------------------------------------------------------
    4. Handle defaults when there is no result variable defined
  --------------------------------------------------------------------*/

  /*------------------------------------
    4.1 Result is a dataframe
  ------------------------------------*/
  if (returnType === 'dataframe') {
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
  } else if (returnType === 'series') {
    /*------------------------------------
    4.2 Result is a series
  ------------------------------------*/
    console.log('CG: 4.2 Return type is series');
    // This covers both scenarios df->series and series->series

    let resultColumnName = '';

    // If not defined, change the column that has been selected
    if (resultVariable === '') {
      // Find the column that has a column definition to use
      for (const parameterName in formResponse.schema.properties) {
        const colSchema = formResponse.schema.properties[parameterName];
        if (typeof colSchema['$ref'] !== 'undefined') {
          console.log('Ref found', colSchema['$ref']);
          if (colSchema['$ref'] === '#/definitions/column') {
            console.log('CG: 4.2.1 Result defaults: Using default column');
            resultColumnName = formData[parameterName];
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
  } else if (returnType === 'variable') {
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
  if (returnType !== 'none') {
    formula = resultVariable + ' = ' + formula;
  }

  // Handle the cases where we append something at the end
  if (typeof formResponse.schema.append !== 'undefined') {
    formula = formula + formResponse.schema.append;
  }

  // In the case the ruturn type is a series, remove the column name from the variable
  // i.e. df instead of df['col name']
  let resultDataFrame = resultVariable;
  if (returnType === 'series') {
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
