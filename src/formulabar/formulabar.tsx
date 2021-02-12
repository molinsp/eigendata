import React, { useState } from 'react';
import Form from '@rjsf/core';
import Select from 'react-select';
import { JSONSchema7 } from 'json-schema';
import Joyride from 'react-joyride';
import { generatePythonCode } from './codeGeneration';
import ChatWidget from '@papercups-io/chat-widget';
import 'bootstrap/dist/css/bootstrap.css';
// Feedback buttons library
import { BinaryFeedback } from 'react-simple-user-feedback';
import { FeedbackContent } from '../components/feedbackContent';
// Usage analytics
import amplitude from 'amplitude-js';
// This is used to force refresh the form schema for dynamic forms with react-jsonschema-form
import _ from 'lodash';
// Awesome querybuilder
import QueryBuilder from '../components/querybuilder';
import { magnifier, tableIcon, thumbDown, thumbUp } from '../assets/svgs';
import { formulabarMainSelect } from '../styles/reactSelectStyles';
import CustomSelect from '../components/customSelect';
import productTourSteps from '../productTour';
import { Backend, Dataframe } from '../core/backend';
import { RadioButtonGroup } from '../components/radioButtonGroup';

// -------------------------------------------------------------------------------------------------------------
// FORMULABAR COMPONENT
// -------------------------------------------------------------------------------------------------------------
/*
 This magic formula bar provides a GUI over python functions with the goal of facilitating the use by non experts
 and non technical users

 How this works on a high-level is that we define a json schema for each function, and render that as a form for
 the end user. The end user can interact with the form, and upon submission this form generates "code" in a 
 notebook cell

 Functionality in this file:
   - (A) Search: Find transformations using keywords and log data when users search
   - (B) Form handling: Display form when user selects data and transformation and request the json schema
   - (C) Code generation: Update internal state after generating code and generating the "text" out of the
       json object returned by reactjsonschemaform
   - (D) Logic to get feedback from users after they have used a transformation
*/

// Component takes props with the main class (FormWidget) that handles all the logic, communication with kernel etc.
export const FormComponent = (props: { logic: Backend }): JSX.Element => {
  // Access backend class through logic object
  const logic = props.logic;

  // Defaults for form and UI schema
  const transformationForm: JSONSchema7 = logic.transformationsConfig[
    'read_csv'
  ]['form'] as JSONSchema7;
  const defaultUISchema: JSONSchema7 = logic.transformationsConfig['read_csv'][
    'uischema'
  ] as JSONSchema7;
  const defaultTransformationSelection = {
    value: 'read_csv',
    label: 'Read CSV'
  };

  const loadingTransformations = (): Dataframe[] => {
    const result = [];

    _.forIn(logic.transformationsConfig, (value, key) => {
      if (value['form']['transformationType'] === 'dataLoading') {
        result.push({ value: key, label: value['form']['title'] });
      }
    });

    return result;
  };

  const dataframeSelectionRef = React.useRef();

  /* Main state of the component:
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

  // Separate state for product tour
  const [productTourState, setProductTourState] = useState({
    run: false
  });

  const setFocusOnElement = (element: HTMLElement): void => {
    element.focus();
  };

  /*-----------------------------------
  RESET STATE LOGIC
  -----------------------------------*/
  if (logic.resetStateFormulabarFlag === true) {
    console.log('RESETING FORMULABAR STATE');
    setState({
      ...state,
      transformationForm: transformationForm,
      transformationUI: defaultUISchema,
      showForm: true,
      dataframeSelection: null,
      transformationSelection: defaultTransformationSelection,
      formData: {},
      queryConfig: null
    });
    logic.resetStateFormulabarFlag = false;

    // This starts the product tour. It's here because it needs to load after the rest of the elements
    if (logic.completedProductTour === false) {
      setProductTourState({ run: true });
      // Change the settings for it not to run next time (next refresh)
      logic.eigendataSettings.set('completedProductTour', true);
      // Set to true for it not to run again in the current session
      logic.completedProductTour = true;
    }
  }

  /*-----------------------------------
    (A) SEARCH
  -----------------------------------*/
  // Log what the users are searching
  let prevInput = '';
  const handleInputChange = (inputValue): void => {
    if (inputValue.length === 0 && prevInput.length !== 0) {
      console.log('Formulabar search: search and select - ', prevInput);

      if (logic.production && logic.shareProductData) {
        amplitude
          .getInstance()
          .logEvent('Formulabar search: search and select', {
            searchString: prevInput
          });
      }
    } else if (inputValue.length < prevInput.length) {
      //console.log('Formulabar Search: Deleted text', prevInput);
    } else if (inputValue.endsWith(' ')) {
      console.log('Formulabar search: search keyword - ', prevInput);

      if (logic.production && logic.shareProductData) {
        amplitude
          .getInstance()
          .logEvent('Formulabar search: search and select', {
            searchString: prevInput
          });
      }
    }

    prevInput = inputValue;
  };

  // Search logic
  const getKeywordsForFilter = (option, rawInput) => {
    // Add keywords to search
    let keywords = '';
    if (option.value === 'query') {
      // Query is handled differently
      keywords = ['filter', 'more', 'less', 'equal'].join(' ');
    } else if (option.value === 'notfound') {
      return true;
    } else if (logic.transformationsConfig[option.value]['keywords']) {
      keywords = logic.transformationsConfig[option.value]['keywords'].join(
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

  /*--------------------------------------
    (B) FORM HANDLING
  ---------------------------------------*/

  // Add the behavior described above
  const widgets = {
    SelectWidget: CustomSelect,
    RadioWidget: RadioButtonGroup
  };

  // UPDATE FORMS DYNAMICALLY, i.e. when the input of a form field changes, the form itself changes
  const handleFormChange = async (data): Promise<void> => {
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
  const handleDataframeSelectionChange = async (input): Promise<void> => {
    //console.log(this);
    if (state.transformationSelection) {
      console.log('Formulabar: get transformation to state');
      await getTransformationFormToState(input, state.transformationSelection);
    } else {
      setState(state => ({ ...state, dataframeSelection: input, error: null }));
    }
  };

  // Save the input of the transformation selection in the UI to the state
  const handleTransformationSelectionChange = async (input): Promise<void> => {
    // Event tracking
    if (logic.production && logic.shareProductData) {
      amplitude.getInstance().logEvent('Formulabar: select transformation', {
        userSelection: input.value
      });
    }
    if (state.dataframeSelection) {
      console.log('all defined');
      await getTransformationFormToState(state.dataframeSelection, input);
    } else if (
      logic.transformationsConfig[input.value]['form']['transformationType'] ===
        'dataLoading' ||
      input.value === 'notfound'
    ) {
      console.log('Data loading transformation');
      setState(state => ({
        ...state,
        transformationForm: logic.transformationsConfig[input.value]['form'],
        transformationUI: logic.transformationsConfig[input.value]['uischema'],
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
    dataframeSelection: Dataframe,
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
      const newUISchema = logic.getTransformationUISchema(
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

  /*--------------------------------------
    (C) GENERATE CODE & UPDATE INTERNALS
  ---------------------------------------*/

  // Generate python code and write in the notebook
  const callGeneratePythonCode = async (formResponse: any): Promise<void> => {
    console.log('SUBMIT WAS PRESSED');
    /*-----------------------------------------------
    Handle not found case
    -----------------------------------------------*/
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
      if (logic.production && logic.shareProductData) {
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
    const { formula, resultVariable, returnType } = generatePythonCode(
      formResponse,
      dataframeSelection
    );
    /*-----------------------------------------------
    Tracking in amplitude
    -----------------------------------------------*/
    if (logic.production && logic.shareProductData) {
      amplitude.getInstance().logEvent('Formulabar: submit transformation', {
        function: formResponse.schema.function,
        formInput: formResponse.formData,
        generatedCode: formula
      });
    }
    /*-----------------------------------------------
    Import libraries/functions if needed
    -----------------------------------------------*/
    if (
      typeof logic.transformationsConfig[formResponse.schema.function][
        'library'
      ] === 'undefined' &&
      typeof logic.transformationsConfig[formResponse.schema.function][
        'snippet'
      ] !== 'undefined'
    ) {
      console.log('CG: Code-gen for snippet');
      /*----------------
        FUNC SNIPPETS
      -----------------*/
      const snippetFunction =
        logic.transformationsConfig[formResponse.schema.function]['snippet'];

      console.log('CG: Imported functions', logic.importedFunctions);
      if (logic.importedFunctions.includes(snippetFunction['name'])) {
        console.log('CG: Snippet already imported');
      } else {
        console.log(
          'CG: Snippet not imported, using statement',
          snippetFunction['name']
        );

        try {
          await logic.pythonImportLibraries(snippetFunction['code']);
        } catch (error) {
          console.log(error);
        }
      }
    } else {
      /*----------------
        MODULES
      -----------------*/
      console.log('CG: Code-gen for module');

      const library =
        logic.transformationsConfig[formResponse.schema.function]['library'];

      // Check if there is a need for a namespace
      let hasNamespace = false;
      if (typeof library['namespace'] !== 'undefined') {
        hasNamespace = true;
      }
      // Check if the library is already imported or not

      // Case 1: No namespace
      if (!hasNamespace && logic.packagesImported.includes(library['name'])) {
        console.log('CG: Module already imported');
      }
      // Case 2: There is a namespace, in which case you need both the import and the namespace for it to work
      else if (
        hasNamespace &&
        logic.packagesImported.includes(library['name']) &&
        logic.packageNamespaces.includes(library['namespace'])
      ) {
        console.log('CG: Package & namespace already imported');
      } else {
        console.log(
          'CG: Module not imported, using statement',
          library['importStatement']
        );

        try {
          await logic.pythonImportLibraries(library['importStatement']);
        } catch (error) {
          console.log(error);
        }
      }
    }

    /*-----------------------------------------------
    Generate & execute code
    -----------------------------------------------*/

    try {
      await logic.writeToNotebookAndExecute(formula);

      console.log('CG: Return type', returnType);

      // Write and execute the formula in the notebook
      // Add submitted transformation to the feedback state
      setFeedbackState({
        ...feedbackState,
        submittedTransformation: state.transformationSelection
      });

      if (returnType === 'dataframe') {
        setState(state => ({
          ...state,
          dataframeSelection: {
            label: resultVariable,
            value: resultVariable
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
      setFocusOnElement(dataframeSelectionRef.current);
    } catch (error) {
      // Log transformation errors
      if (logic.production && logic.shareProductData) {
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
    (D) FEEDBACK LOGIC
  ---------------------------------------*/

  const extraErrors = state.error
    ? { form: { __errors: [state.error.message] } }
    : undefined;

  // Action when click "Worked" button
  const onNegativeClick = (): void => {
    console.log('Logged: ', feedbackState.submittedTransformation.value);
    // Log result
    if (logic.production && logic.shareProductData) {
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
    if (logic.production && logic.shareProductData) {
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
    if (logic.production && logic.shareProductData) {
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
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip'
        }}
        styles={{
          options: {
            zIndex: 1000,
            primaryColor: '#3698DC'
          }
        }}
      />
      <div className="side-by-side-fields">
        <div className="centered" />
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
            onInputChange={handleInputChange}
            className="right-field"
            components={{
              DropdownIndicator: (): JSX.Element => magnifier,
              IndicatorSeparator: (): null => null
            }}
            id="transformationselect"
            filterOption={getKeywordsForFilter}
            maxMenuHeight={400}
            styles={formulabarMainSelect}
            autoFocus={true}
            ref={dataframeSelectionRef}
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
            omitExtraData={true}
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
        {feedbackState.submittedTransformation &&
          !(state.showForm || state.queryConfig) && (
            <form id="feedback" onSubmit={onSubmitDescription}>
              <div id="feedback__buttons">
                <BinaryFeedback
                  onPositiveClick={onPositiveClick}
                  onNegativeClick={onNegativeClick}
                  positiveContent={FeedbackContent(
                    thumbUp,
                    'Worked',
                    '#93C47d'
                  )}
                  negativeContent={FeedbackContent(
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
                  value={feedbackState.negativeDescription}
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
