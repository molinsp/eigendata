/*eslint @typescript-eslint/no-unused-vars: ["off", {"varsIgnorePattern": "^_"}]*/
import React, {Component} from 'react';
import {
  Query, 
  Builder, 
  //BasicConfig, 
  Utils as QbUtils,
  //types:
  ImmutableTree, Config, BuilderProps
} from 'react-awesome-query-builder';
//import AntdConfig from 'react-awesome-query-builder/lib/config/antd';
import 'react-awesome-query-builder/lib/css/styles.css';
//import 'react-awesome-query-builder/lib/css/compact_styles.css'; //optional, for more compact styles
import {Backend} from './formulabar'
import customConfig from './querybuilder_config';
import Select from 'react-select';
//const InitialConfig = BasicConfig; // or BasicConfig

import amplitude from 'amplitude-js';


// You can load query value from your backend storage (for saving see `Query.onChange()`)
// Default empty query value
const queryValue = {"id": QbUtils.uuid(), "type": "group"};

export default class DemoQueryBuilder extends Component<DemoQueryBuilderProps, DemoQueryBuilderState> {
    constructor(props: DemoQueryBuilderProps) {
        super(props);
        const config = {...customConfig, fields: {...this.props.queryConfig}};
        this.state = {
            // @ts-ignore
            tree: QbUtils.checkTree(QbUtils.loadTree(queryValue), config),
            config: config,
            logic : props.backend,
            queryType: "query",
            newTableName: '',
        };
    }

    private options = [
      { value: 'query', label: 'Filter the dataframe' },
      { value: 'eval', label: 'Create true/false indicators' }];


    setQueryType = (input: any) => {
      //console.log('Dropdown changed', input);
      this.setState(state => ({...state,queryType: input.value}));
    }

    handleChange = (event) => {
      this.setState({...this.state, newTableName: event.target.value});
    };

    componentDidUpdate(prevProps: Readonly<DemoQueryBuilderProps>) {
        if (this.props.queryConfig !== prevProps.queryConfig){
            const config = {...customConfig, fields: {...this.props.queryConfig}};
            this.setState(state=>({
                ...this.state,
                // @ts-ignore
                tree: QbUtils.checkTree(QbUtils.loadTree(queryValue), config),
                config: config,
            }));
        }
    }

    render = () => (
      <form id="query-form">
          <div className="form-group">
              <fieldset>
                  <legend>
                      Filter/Query dataframe
                  </legend>
                  <Query
                      {...this.state.config}
                      value={this.state.tree}
                      onChange={this.onChange}
                      renderBuilder={this.renderBuilder}
                  />
                  <div className="form-group">
                      <label
                          htmlFor="filterDataFrame"
                          className="control-label">filter type
                      </label>
                      <Select
                          id="filterDataFrame"
                          options={this.options}
                          onChange={this.setQueryType}
                          defaultValue={{ value: 'query', label: 'Filter the dataframe' }}
                      />
                  </div>
                   <div className="form-group">
                      <label
                          htmlFor="newTableNameTextInput"
                          className="control-label">{this.state.queryType === 'query' ? 'new table name' : 'new column name'}
                      </label>
                      <input
                          id="newTableNameTextInput"
                          value={this.state.newTableName}
                          type="text" name="newTableName"
                          onChange={this.handleChange}
                          className="form-control"
                          placeholder="Leave blank to modify selected table"
                      />
                  </div>
              </fieldset>
          </div>
        <button type="button" onClick={this.generateCode} className="btn btn-info">
            Submit
        </button>
      </form>
    )

    renderBuilder = (props: BuilderProps) => (
      <div className="query-builder-container">
        <div className="query-builder qb-lite">
            <Builder {...props} />
        </div>
      </div>
    )

    /*---------------------------------------------------------------------------------------------------- 
    [FUNCTION] Take query input ange generate code in the notebook
    -> Writes: Notebook
    -----------------------------------------------------------------------------------------------------*/
    generateCode = () => {
      let sql_query = JSON.stringify(QbUtils.sqlFormat(this.state.tree, this.state.config), undefined, 2);
      //console.log('Querybuilder: SQL query', sql_query);
      sql_query = sql_query.replace(/ = /g,'==');
      sql_query = sql_query.replace(/<>/g,'!=');
      sql_query = sql_query.replace(/AND/g,'and');
      sql_query = sql_query.replace(/OR/g,'or');
      sql_query = sql_query.replace(/true/g,'True');
      sql_query = sql_query.replace(/false/g,'False');
      sql_query = sql_query.replace(/ IS EMPTY/g,'.isnull()');
      sql_query = sql_query.replace(/ IS NOT EMPTY/g,'.notnull()');
      sql_query = sql_query.replace(/NOT/g,'~');
      sql_query = sql_query.replace(/\b(?!(?:and|or|true|false|isnull|notnull|in)\b)\w+\s\b(?!(?:and|or|true|false|isnull|notnull|in)\b)\w+/g,'`$&`');
      
      //console.log('Querybuilder: Config fields', this.state.config.fields);
      

      let returnType = '';
      if(this.state.queryType.localeCompare('query') == 0){
        returnType = 'dataframe';
      }else{
        // eval case
        returnType = 'series';
      }

      // If no variable defined, use this dataframe selection
      let variable = '';
      if(returnType.localeCompare('dataframe') == 0){
        if(this.state.newTableName === ''){
          variable = this.props.dataframeSelection ;
        }else{
          variable = this.state.newTableName.replace(/ /g,"_");
        }
      }
      else if(returnType.localeCompare('series') == 0){
        if(this.state.newTableName === ''){
          variable = this.props.dataframeSelection + '["indicator"]';
        }else{
          variable = this.props.dataframeSelection + '["' + this.state.newTableName.replace(/ /g,"_") + '"]';
        }
      }

      //  Compose formula: variable = dataframe . query/eval (query)
      let formula =  variable + ' = ' + this.props.dataframeSelection;
      formula = formula + '.' + this.state.queryType;

      // Add the copy command to make sure pandas knows we are creating a copy
      if(returnType.localeCompare('dataframe') == 0){
        formula = formula + '(' + sql_query + ', engine="python"' + ').copy()';  
      }else{
        formula = formula + '(' + sql_query + ', engine="python"' + ')';  
      } 

      console.log('Querybuilder: Datatable selection', this.props.dataframeSelection);
      console.log('Querybuilder: Formula', formula);

      if (this.state.logic._production && this.state.logic.shareProductData) {
          amplitude.getInstance().logEvent('Querybuilder: submit transformation', {
          function: 'query',
          generatedCode: formula,
        });
      }

      this.state.logic.writeToNotebookAndExecute(formula);  
    }

    /*---------------------------------------------------------------------------------------------------- 
    [FUNCTION] Save changes to state
    -> Writes: State
    -----------------------------------------------------------------------------------------------------*/   
    onChange = (immutableTree: ImmutableTree, config: Config) => {
      // Tip: for better performance you can apply `throttle` - see `examples/demo`
      //this.setState({tree: immutableTree, config: config});
      this.setState(state => ({...state,tree: immutableTree, config: config}));

      // const jsonTree = QbUtils.getTree(immutableTree);
      // console.log('JSON TREE', jsonTree);
      // `jsonTree` can be saved to backend, and later loaded to `queryValue`
    }
}

interface DemoQueryBuilderProps {
    queryConfig: object;
    backend: Backend;
    dataframeSelection: string;
}

interface DemoQueryBuilderState {
    tree: ImmutableTree;
    config: Config;
    logic: Backend;
    queryType:string;
    newTableName: string;
}