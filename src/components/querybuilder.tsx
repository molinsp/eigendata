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
      newTableName: ''
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
    console.log('SQL query', sqlQuery);
    sqlQuery = sqlQuery.replace(/ IS EMPTY/g, '.isnull()');
    sqlQuery = sqlQuery.replace(/ IS NOT EMPTY/g, '.notnull()');
    sqlQuery = sqlQuery.replace(/AND/g, 'and');
    sqlQuery = sqlQuery.replace(/OR/g, 'or');
    sqlQuery = sqlQuery.replace(/true/g, 'True');
    sqlQuery = sqlQuery.replace(/false/g, 'False');
    // Handle the case of any in ['a','b'] instead of IN ('a', 'b')
    sqlQuery = sqlQuery.replace(/NOT IN\s\((.*?)\)/g, 'not in [$1]');
    sqlQuery = sqlQuery.replace(/IN\s\((.*?)\)/g, 'in [$1]');
    sqlQuery = sqlQuery.replace(/NOT/g, '~');
    sqlQuery = sqlQuery.replace(/ = /g, '==');
    sqlQuery = sqlQuery.replace(/ <> /g, '!=');

    const colNames = Object.entries(this.state.config.fields).map(
      ([k, v]) => v.label
    );
    //console.log('Querybuilder: Config fields type', typeof colNames);
    //console.log('Querybuilder: Config fields', colNames);
    const colNamesSorted = colNames.sort((a, b) => b.length - a.length);
    //console.log('Querybuilder: Config fields sorted', colNamesSorted);

    for (const i of colNamesSorted) {
      const colName = i;
      //console.log('Col name', colName);
      // Check if there is any blank space in the column names
      if (/\s/.test(colName)) {
        // It has any kind of whitespace
        // Replace with backticks to ensure pandas does not generate an error
        console.log('replacing');
        // Match any string finishing with space and a characte
        // except a space and the word in (special keyword)
        const regex = colName + '(?!( (?!in)\\S))';
        console.log('Regex', regex);
        const re = new RegExp(regex, 'g');
        const replaceTo = '`' + colName + '`';
        sqlQuery = sqlQuery.replace(re, replaceTo);
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

    await this.state.logic.writeToNotebookAndExecute(formula);
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
}
