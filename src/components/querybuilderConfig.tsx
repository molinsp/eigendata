/*eslint @typescript-eslint/no-unused-vars: ["off", {"varsIgnorePattern": "^_"}]*/
import {
  BasicConfig,
  Config,
  Operators,
  Settings,
  Types,
  Widgets
} from 'react-awesome-query-builder';

import { QuerybuilderCustomSelect } from './querybuilderCustomSelect';
import { QuerybuilderCustomMultiselect } from './querybuilderCustomMultiselect';

import React from 'react';

const InitialConfig = BasicConfig; // or BasicConfig or MaterialConfig

//////////////////////////////////////////////////////////////////////

const types: Types = {
  ...InitialConfig.types,
  // examples of  overriding
  number: {
    defaultOperator: 'equal',
    //mainWidget: "number",
    valueSources: ['value'],
    widgets: {
      number: {
        operators: [
          'equal',
          'not_equal',
          'less',
          'less_or_equal',
          'greater',
          'greater_or_equal',
          //"between",
          //"not_between",
          'is_empty',
          'is_not_empty'
        ]
      },
      slider: {
        operators: [
          'equal',
          'not_equal',
          'less',
          'less_or_equal',
          'greater',
          'greater_or_equal',
          'is_empty',
          'is_not_empty'
        ]
      }
    }
  },
  date: {
    defaultOperator: 'equal',
    //mainWidget: "number",
    valueSources: ['value'],
    widgets: {
      date: {
        operators: [
          'equal',
          'not_equal',
          'less',
          'less_or_equal',
          'greater',
          'greater_or_equal',
          //"between",
          //"not_between",
          'is_empty',
          'is_not_empty'
        ]
      }
    }
  },
  time: {
    defaultOperator: 'equal',
    //mainWidget: "number",
    valueSources: ['value'],
    widgets: {
      time: {
        operators: [
          'equal',
          'not_equal',
          'less',
          'less_or_equal',
          'greater',
          'greater_or_equal'
          //"between",
          //"not_between",
          //"is_empty",
          //"is_not_empty",
        ]
      }
    }
  },
  datetime: {
    defaultOperator: 'equal',
    //mainWidget: "number",
    valueSources: ['value'],
    widgets: {
      datetime: {
        operators: [
          'equal',
          'not_equal',
          'less',
          'less_or_equal',
          'greater',
          'greater_or_equal'
          //"between",
          //"not_between",
          //"is_empty",
          //"is_not_empty",
        ]
      }
    }
  },
  text: {
    defaultOperator: 'equal',
    valueSources: ['value'],
    widgets: {
      text: {
        operators: [
          'equal',
          'not_equal',
          'is_empty',
          'is_not_empty',
          //"like",
          //"not_like",
          //"starts_with",
          //"ends_with",
          //"proximity",
          'python_contains'
        ],
        widgetProps: {},
        opProps: {}
      },
      field: {
        operators: [
          //unary ops (like `is_empty`) will be excluded anyway, see getWidgetsForFieldOp()
          'equal',
          'not_equal'
          //"proximity",
        ]
      }
    }
  },
  select: {
    defaultOperator: 'select_any_in',
    valueSources: ['value'],
    widgets: {
      multiselect: {
        operators: [
          'select_any_in',
          'select_not_any_in',
          'is_empty',
          'is_not_empty'
        ]
      }
    }
  },
  boolean: {
    defaultOperator: 'equal',
    valueSources: ['value'],
    widgets: {
      boolean: {
        operators: ['equal', 'not_equal', 'is_empty', 'is_not_empty'],
        widgetProps: {
          //you can enable this if you don't use fields as value sources
          // hideOperator: true,
          // operatorInlineLabel: "is",
        }
      },
      field: {
        operators: ['equal', 'not_equal']
      }
    }
  }
};

const widgets: Widgets = {
  ...InitialConfig.widgets,
  multiselect: {
    ...InitialConfig.widgets.multiselect,
    type: 'multiselect',
    factory: (props): JSX.Element => (
      <QuerybuilderCustomMultiselect {...props} />
    ),
    sqlFormatValue: (val): string => {
      return val.map(value => `'${value}'`);
    }
  }
};

const operators: Operators = {
  ...InitialConfig.operators,
  // examples of  overriding
  python_contains: {
    label: 'Contains',
    labelForFormat: 'Like',
    reversedOp: 'not_like',
    sqlFormatOp: (
      field,
      op,
      values,
      valueSrc,
      valueType,
      opDef,
      operatorOptions
    ) => {
      if (valueSrc === 'value') {
        return `${field}.str.contains(${values})`;
      } else {
        return undefined;
      } // not supported
    },
    valueSources: ['value']
  }
};

const settings: Settings = {
  ...InitialConfig.settings,
  renderOperator: props => {
    return <QuerybuilderCustomSelect {...props} operatorField />;
  },
  renderField: props => {
    return <QuerybuilderCustomSelect {...props} />;
  }
};

const customConfig: Config = {
  ...InitialConfig,
  types,
  operators,
  settings,
  widgets
};

export default customConfig;
