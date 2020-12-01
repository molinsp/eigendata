/*eslint @typescript-eslint/no-unused-vars: ["off", {"varsIgnorePattern": "^_"}]*/
import {
  BasicConfig,
  // types:
  Types,
  Settings,
  Operators
  //Widgets, Fields, Config, Types, Conjunctions, Settings, LocaleSettings, Funcs,
} from 'react-awesome-query-builder';

import React, { useEffect, useState } from 'react';
import Select from 'react-select';

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
          "is_empty",
          "is_not_empty",
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

const CustomSelect = props => {
  const [options, setOptions] = useState([...props.items]);

  useEffect(() => {
    // React select requires 'value' field for options
    const modifiedOptions = options.map(option => {
      option.value = option.key;
      return option;
    });

    setOptions(modifiedOptions);
  }, []);

  const selectHeight = 30;

  const customStyles = {
    menuPortal: base => ({ ...base, zIndex: 9999 }),
    control: base => ({
      ...base,
      height: selectHeight,
      minHeight: selectHeight
    }),
    valueContainer: base => ({
      ...base,
      height: selectHeight,
      minHeight: selectHeight
    }),
    input: base => ({ ...base, margin: 0 }),
    indicatorsContainer: base => ({
      ...base,
      height: selectHeight,
      minHeight: selectHeight
    })
  };

  return (
    <Select
      onChange={(selection: ISelection) => {
        props.setField(selection.value);
      }}
      options={options}
      menuPortalTarget={document.body}
      styles={customStyles}
    />
  );
};

interface ISelection {
  value: string;
  label: string;
}


const settings: Settings = {
  ...InitialConfig.settings,
  renderOperator: props => {
    return <CustomSelect {...props} />;
  },
  renderField: props => {
    console.log(props);
    return <CustomSelect {...props} />;
  }
};

const customConfig: any = {
  ...InitialConfig,
  types,
  operators,
  settings
};

export default customConfig;
