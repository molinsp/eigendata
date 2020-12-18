/*eslint @typescript-eslint/no-unused-vars: ["off", {"varsIgnorePattern": "^_"}]*/
import {
  BasicConfig,
  Operators,
  Settings,
  Types,
  Widgets
} from 'react-awesome-query-builder';

import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { querySelectStyles } from './styles/reactSelectStyles';

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
  }
};

const widgets: Widgets = {
  ...InitialConfig.widgets,
  multiselect: {
    ...InitialConfig.widgets.multiselect,
    type: 'multiselect',
    factory: (props): JSX.Element => <CustomMultiSelect {...props} />,
    sqlFormatValue: (val): string => {
      return val.map(value => `'${value}'`);
    }
  }
};

const operators: Operators = {
  ...InitialConfig.operators,
  // examples of  overriding
  python_contains: {
    label: 'contains',
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
    return <CustomSelect {...props} />;
  },
  renderField: props => {
    return <CustomSelect {...props} />;
  }
};

const customConfig: any = {
  ...InitialConfig,
  types,
  operators,
  settings,
  widgets
};

export default customConfig;

const CustomMultiSelect = (props): JSX.Element => {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    // React select requires 'value' field for options
    const modifiedOptions = props.listValues.map(listValue => {
      return { label: listValue.title, value: listValue.value };
    });
    setOptions(modifiedOptions);
  }, []);
  return (
    <Select
      onChange={(selection: ISelection[]): void => {
        props.setValue(selection.map(item => item.value));
      }}
      isMulti
      options={options}
      menuPortalTarget={document.body}
      styles={querySelectStyles}
    />
  );
};

const CustomSelect = (props): JSX.Element => {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    // React select requires 'value' field for options
    const modifiedOptions = props.items.map(item => {
      return { value: item.key, label: item.label };
    });

    setOptions(modifiedOptions);
  }, []);

  return (
    <Select
      onChange={(selection: ISelection): void => {
        props.setField(selection.value);
      }}
      options={options}
      menuPortalTarget={document.body}
      styles={querySelectStyles}
    />
  );
};

interface ISelection {
  value: string;
  label: string;
}
