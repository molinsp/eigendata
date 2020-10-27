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

// You need to provide your own config. See below 'Config format'
const config: Config = {
  ...InitialConfig,
  fields: {
    qty: {
        label: 'Qty',
        type: 'number',
        fieldSettings: {
            min: 0,
        },
        valueSources: ['value'],
        preferWidgets: ['number'],
    },
    price: {
        label: 'Price',
        type: 'number',
        valueSources: ['value'],
        fieldSettings: {
            min: 10,
            max: 100,
        },
        preferWidgets: ['slider', 'rangeslider'],
    },
    color: {
        label: 'Color',
        type: 'select',
        valueSources: ['value'],
        fieldSettings: {
          listValues: [
            { value: 'yellow', title: 'Yellow' },
            { value: 'green', title: 'Green' },
            { value: 'orange', title: 'Orange' }
          ],
        }
    },
    is_promotion: {
        label: 'Promo?',
        type: 'boolean',
        operators: ['equal'],
        valueSources: ['value'],
    },
  }
};

// You can load query value from your backend storage (for saving see `Query.onChange()`)
// Default empty query value
const queryValue = {"id": QbUtils.uuid(), "type": "group"};


export default class DemoQueryBuilder extends Component {
    state = {
      // @ts-ignore
      tree: QbUtils.checkTree(QbUtils.loadTree(queryValue), config),
      config: config
    };
    
    render = () => (
      // @ts-ignore
      <div>
        <Query
            {...config} 
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