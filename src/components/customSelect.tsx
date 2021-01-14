/*-----------------------------------
 CUSTOM SELECT: Use React select with JSONschema form
 -----------------------------------*/
// Inspired by example here https://codesandbox.io/s/13vo8wj13?file=/src/formGenerationEngine/Form.js
// To-do: Move custom components to separate files
import Select from 'react-select';
import React from 'react';

const CustomSelect = function(props: any): JSX.Element {
  const processSingleSelect = (selection: any): any => {
    const { value } = selection;
    return value;
  };

  const processMultiSelect = (selection: any): any => {
    // Handle the case when the user removes selections
    if (selection === null) {
      return [];
    }

    return selection.map((item: any) => item.value);
  };

  // If defined as array, use the multi-select
  if (props.schema.type === 'array') {
    return (
      <Select
        options={props.options.enumOptions}
        onChange={(selection): void =>
          props.onChange(processMultiSelect(selection))
        }
        isMulti={true}
      />
    );
  } else {
    return (
      <Select
        options={props.options.enumOptions}
        onChange={(selection): void =>
          props.onChange(processSingleSelect(selection))
        }
        //Default value is a dict {value: "", label: ""} and thus the need to filter from the available options
        //defaultValue={props.value}
        defaultValue={props.options.enumOptions.filter(
          (option: any) => option.value === props.value
        )}
      />
    );
  }
};

export default CustomSelect;
