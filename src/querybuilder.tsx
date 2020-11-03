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
//const InitialConfig = BasicConfig; // or BasicConfig

// You can load query value from your backend storage (for saving see `Query.onChange()`)
// Default empty query value
const queryValue = {"id": QbUtils.uuid(), "type": "group"};

export default class DemoQueryBuilder extends Component<DemoQueryBuilderProps, DemoQueryBuilderState> {

    constructor(props: DemoQueryBuilderProps) {
        super(props);
        console.log('CUSTOM CONFIG', customConfig );
        const config = {...customConfig, fields: {...this.props.queryConfig}};
        this.state = {
            // @ts-ignore
            tree: QbUtils.checkTree(QbUtils.loadTree(queryValue), config),
            config: config,
            dataframeSelection : props.dataframeSelection,
            logic : props.backend
        };
    }

    render = () => (
      <div>
        <Query
            {...this.state.config}
            value={this.state.tree}
            onChange={this.onChange}
            renderBuilder={this.renderBuilder}
        />
        <button onClick={this.onSubmit}> Filter </button>
      </div>
    )

    renderBuilder = (props: BuilderProps) => (
      <div className="query-builder-container" style={{padding: '10px'}}>
        <div className="query-builder qb-lite">
            <Builder {...props} />
        </div>
      </div>
    )

    /*---------------------------------------------------------------------------------------------------- 
    [FUNCTION] Take query input ange generate code in the notebook
    -> Writes: Notebook
    -----------------------------------------------------------------------------------------------------*/
    onSubmit = () => {
      let sql_query = JSON.stringify(QbUtils.sqlFormat(this.state.tree, this.state.config), undefined, 2);
      console.log('SQL query', sql_query);
      sql_query = sql_query.replace(/ = /g,'==');
      sql_query = sql_query.replace(/<>/g,'!=');
      sql_query = sql_query.replace(/AND/g,'and');
      sql_query = sql_query.replace(/OR/g,'or');
      sql_query = sql_query.replace(/true/g,'True');
      sql_query = sql_query.replace(/false/g,'False');
      sql_query = sql_query.replace(/ IS EMPTY/g,'.isnull()');
      sql_query = sql_query.replace(/ IS NOT EMPTY/g,'.notnull()');

      const formula = this.state.dataframeSelection + ' = ' + this.state.dataframeSelection + '.query(' + sql_query + ')';
      console.log('Formula', formula);
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
    dataframeSelection: string;
}