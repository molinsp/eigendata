import React, { Component } from 'react';
import {
  Query,
  Builder,
  Utils as QbUtils,
  //types:
  ImmutableTree,
  Config,
  BuilderProps,
  JsonGroup
} from 'react-awesome-query-builder';
import 'react-awesome-query-builder/lib/css/styles.css';
import { Backend } from '../core/backend';
import customConfig from './querybuilderConfig';
import Select from 'react-select';
import amplitude from 'amplitude-js';

// You can load query value from your backend storage (for saving see `Query.onChange()`)
// Default empty query value
const queryValue: JsonGroup = { id: QbUtils.uuid(), type: 'group' };

export default class QueryBuilder extends Component<
  IQueryBuilderProps,
  IQueryBuilderState
> {
  constructor(props: IQueryBuilderProps) {
    super(props);
    const config = { ...customConfig, fields: { ...this.props.queryConfig } };
    this.state = {
      tree: QbUtils.checkTree(QbUtils.loadTree(queryValue), config),
      config: config,
      logic: props.backend,
      queryType: 'query',
      newTableName: '',
      error: null
    };
  }

  private options = [
    { value: 'query', label: 'Filter the dataframe' },
    { value: 'eval', label: 'Create true/false indicators' }
  ];

  setQueryType = (input): void => {
    //console.log('Dropdown changed', input);
    this.setState(state => ({ ...state, queryType: input.value }));
  };

  handleChange = (event): void => {
    this.setState({ ...this.state, newTableName: event.target.value });
  };

  componentDidUpdate(prevProps: Readonly<IQueryBuilderProps>): void {
    if (this.props.queryConfig !== prevProps.queryConfig) {
      const config = { ...customConfig, fields: { ...this.props.queryConfig } };
      this.setState(state => ({
        ...this.state,
        tree: QbUtils.checkTree(QbUtils.loadTree(queryValue), config),
        config: config
      }));
    }
  }

  render = (): JSX.Element => (
    <form id="query-form">
      {this.state.error && (
      <div className="panel panel-danger errors">
        <div className="panel-heading">
          <h3 className="panel-title">Errors</h3>
        </div>
        <ul className="list-group">
          <li className="list-group-item text-danger">{this.state.error.message}</li>
        </ul>
      </div>
      )}
      <div className="form-group">
        <fieldset>
          <legend>Filter/Query dataframe</legend>
          <Query
            {...this.state.config}
            value={this.state.tree}
            onChange={this.onChange}
            renderBuilder={this.renderBuilder}
          />
          <div className="form-group">
            <label htmlFor="filterDataFrame" className="control-label">
              filter type
            </label>
            <Select
              id="filterDataFrame"
              options={this.options}
              onChange={this.setQueryType}
              defaultValue={{ value: 'query', label: 'Filter the dataframe' }}
            />
          </div>
          <div className="form-group">
            <label htmlFor="newTableNameTextInput" className="control-label">
              {this.state.queryType === 'query'
                ? 'new table name'
                : 'new column name'}
            </label>
            <input
              id="newTableNameTextInput"
              value={this.state.newTableName}
              type="text"
              name="newTableName"
              onChange={this.handleChange}
              className="form-control"
              placeholder="Leave blank to modify selected table"
            />
          </div>
        </fieldset>
      </div>
      <button
        type="button"
        onClick={this.generateCode}
        className="btn btn-info"
      >
        Submit
      </button>
    </form>
  );

  renderBuilder = (props: BuilderProps): JSX.Element => (
    <div className="query-builder-container">
      <div className="query-builder qb-lite">
        <Builder {...props} />
      </div>
    </div>
  );

  /*----------------------------------------------------------------------------------------------------
    [FUNCTION] Take query input ange generate code in the notebook
    -> Writes: Notebook
    -----------------------------------------------------------------------------------------------------*/

  generateCode = async (): Promise<void> => {
    let sqlQuery = JSON.stringify(
      QbUtils.sqlFormat(this.state.tree, this.state.config),
      undefined,
      2
    );
    console.log('Querybuilder: Original SQL query', sqlQuery);

    if(sqlQuery){    
      sqlQuery = sqlQuery
        .replace(/ IS EMPTY/g, '.isnull()')
        .replace(/ IS NOT EMPTY/g, '.notnull()')
        .replace(/AND/g, 'and')
        .replace(/OR/g, 'or')
        .replace(/true/g, 'True')
        .replace(/false/g, 'False') 
        // Handle the case of any in ['a','b'] instead of IN ('a', 'b')  
        .replace(/NOT IN\s\((.*?)\)/g, 'not in [$1]') 
        // Not and not in in python
        .replace(/IN\s\((.*?)\)/g, 'in [$1]')
        .replace(/NOT/g, '~')
        // Replace comparison to remove spaces (convention)
        .replace(/ >= /g, '>=')
        .replace(/ <= /g, '<=')
        .replace(/ > /g, '>')
        .replace(/ < /g, '<')
        // Use python characters for equal to and distinct to
        .replace(/ <> /g, '!=')
        .replace(/ = /g, '==');

      const colNames = Object.entries(this.state.config.fields).map(
        ([k, v]) => v.label
      );
      //console.log('Querybuilder: Config fields type', typeof colNames);
      //console.log('Querybuilder: Config fields', colNames);
      const colNamesSorted = colNames.sort((a, b) => b.length - a.length);
      //console.log('Querybuilder: Config fields sorted', colNamesSorted);

      console.log('Querybuilder: Processed sql query', sqlQuery);
      for (const i of colNamesSorted) {
        const colName = i;
        //console.log('Col name', colName);
        // Check if there is any blank space in the column names
        if (/\s/.test(colName) && sqlQuery.includes(colName)) {
          // It has any kind of whitespace
          // Replace with backticks to ensure pandas does not generate an error;
          // To avoid replacing columns that are substrings of other columns with backticks
          // E.g. "col on", "cole one two" -> "`col one` two"
          // To avoid this, we replace only strins that do not end with space
          // since by convention we don't use spaces for comparison operators
          // - Numercial operators. e.g. "col a>5"
          // - String and null operators, e.g. "col a.isnull"
          // EXCEPT for the cases of "in [" / "not in ["
          const colsWithBlanks = "(" + colName + ")(?! (?!in \\[|not in \\[))";
          const colsAlsoCategories = "'`" + colName + "`'";
          const reColsWithBlanks = new RegExp(colsWithBlanks, 'g');
          const reColsAlsoCategories = new RegExp(colsAlsoCategories,'g');
          console.log('re',colsWithBlanks);
          sqlQuery = sqlQuery
            .replace(reColsWithBlanks,"`" + colName + "`")
            .replace(reColsAlsoCategories,"'" + colName + "'");

        }
      }

      let returnType = '';
      if (this.state.queryType.localeCompare('query') === 0) {
        returnType = 'dataframe';
      } else {
        // eval case
        returnType = 'series';
      }

      // If no variable defined, use this dataframe selection
      let variable = '';
      if (returnType.localeCompare('dataframe') === 0) {
        if (this.state.newTableName === '') {
          variable = this.props.dataframeSelection;
        } else {
          variable = this.state.newTableName.replace(/ /g, '_');
        }
      } else if (returnType.localeCompare('series') === 0) {
        if (this.state.newTableName === '') {
          variable = this.props.dataframeSelection + '["indicator"]';
        } else {
          variable =
            this.props.dataframeSelection +
            '["' +
            this.state.newTableName.replace(/ /g, '_') +
            '"]';
        }
      }

      //  Compose formula: variable = dataframe . query/eval (query)
      let formula = variable + ' = ' + this.props.dataframeSelection;
      formula = formula + '.' + this.state.queryType;

      // Add the copy command to make sure pandas knows we are creating a copy
      if (returnType.localeCompare('dataframe') === 0) {
        formula = formula + '(' + sqlQuery + ', engine="python"' + ').copy()';
      } else {
        formula = formula + '(' + sqlQuery + ', engine="python"' + ')';
      }

      console.log(
        'Querybuilder: Datatable selection',
        this.props.dataframeSelection
      );
      console.log('Querybuilder: Formula', formula);

      if (this.state.logic.production && this.state.logic.shareProductData) {
        amplitude.getInstance().logEvent('Querybuilder: submit transformation', {
          function: 'query',
          generatedCode: formula
        });
      }

      try{
        await this.state.logic.writeToNotebookAndExecute(formula, returnType);
        this.setState(state => ({
          ...state, 
          error: null}));
      }catch(error){
        this.setState(state => ({
          ...state, 
          error: error}));
      }
    }else{
      var error = new ErrorEvent('oh nose', {
          message : 'Invalid query: The submited query is not valid, please check your inputs.',
      });
      this.setState(state => ({
          ...state, 
          error: error}));
    }
  };

  /*----------------------------------------------------------------------------------------------------
    [FUNCTION] Save changes to state
    -> Writes: State
    -----------------------------------------------------------------------------------------------------*/

  onChange = (immutableTree: ImmutableTree, config: Config): void => {
    // Tip: for better performance you can apply `throttle` - see `examples/demo`
    this.setState(state => ({ ...state, tree: immutableTree, config: config }));
    // const jsonTree = QbUtils.getTree(immutableTree);
    // console.log('JSON TREE', jsonTree);
    // `jsonTree` can be saved to backend, and later loaded to `queryValue`
  };
}

interface IQueryBuilderProps {
  queryConfig: object;
  backend: Backend;
  dataframeSelection: string;
}

interface IQueryBuilderState {
  tree: ImmutableTree;
  config: Config;
  logic: Backend;
  queryType: string;
  newTableName: string;
  error: ErrorEvent
}
