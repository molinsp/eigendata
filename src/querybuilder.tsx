import React, {Component} from 'react';
// @ts-ignore
import {
  Query, 
  Builder, 
  BasicConfig, 
  Utils as QbUtils,
  //types:
  // @ts-ignore
  ImmutableTree, Config, BuilderProps, JsonTree, JsonLogicTree
} from 'react-awesome-query-builder';
//import AntdConfig from 'react-awesome-query-builder/lib/config/antd';
import 'react-awesome-query-builder/lib/css/styles.css';
//import 'react-awesome-query-builder/lib/css/compact_styles.css'; //optional, for more compact styles
// @ts-ignore
const InitialConfig = BasicConfig; // or BasicConfig

// You can load query value from your backend storage (for saving see `Query.onChange()`)
// Default empty query value
const queryValue = {"id": QbUtils.uuid(), "type": "group"};

export default class DemoQueryBuilder extends Component<DemoQueryBuilderProps, DemoQueryBuilderState> {
    constructor(props: DemoQueryBuilderProps) {
        super(props);
        const config = {...InitialConfig, fields: {...this.props.queryConfig}};
        this.state = {
            // @ts-ignore
            tree: QbUtils.checkTree(QbUtils.loadTree(queryValue), config),
            config: config
        };
    }

    render = () => (
      // @ts-ignore
      <div>
        <Query
            {...this.state.config}
            value={this.state.tree}
            onChange={this.onChange}
            renderBuilder={this.renderBuilder}
        />
      </div>
    )

    renderBuilder = (props: BuilderProps) => (
      <div className="query-builder-container" style={{padding: '10px'}}>
        <div className="query-builder qb-lite">
            <Builder {...props} />
        </div>
      </div>
    )

    
    onChange = (immutableTree: ImmutableTree, config: Config) => {
      // Tip: for better performance you can apply `throttle` - see `examples/demo`
      // this.setState({tree: immutableTree, config: config});

      // const jsonTree = QbUtils.getTree(immutableTree);
      // console.log('JSON TREE', jsonTree);
      // `jsonTree` can be saved to backend, and later loaded to `queryValue`
    }
}

interface DemoQueryBuilderProps {
    queryConfig: object;
}

interface DemoQueryBuilderState {
    tree: ImmutableTree;
    config: Config;
}