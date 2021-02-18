/*-----------------------------------
 CUSTOM SELECT: Use React select with JSONSchema form
 -----------------------------------*/
// Inspired by example here https://codesandbox.io/s/13vo8wj13?file=/src/formGenerationEngine/Form.js
// To-do: Move custom components to separate files
import Select from 'react-select';
import React from 'react';

const CustomSelect = (props): JSX.Element => {
  const processSingleSelect = (selection: OptionType): string => {
    const { value } = selection;
    return value;
  };

  const processMultiSelect = (selection: OptionType[]): string[] => {
    // Handle the case when the user removes selections
    if (selection === null) {
      return [];
    }
    return selection.map(item => item.value);
  };

  // If defined as array, use the multi-select
  if (props.schema.type === 'array') {
    return (
      <Select
        options={props.options.enumOptions}
        onChange={(selection: OptionType[]): void =>
          props.onChange(processMultiSelect(selection))
        }
        isMulti={true}
        value={props.options.enumOptions.filter((option: OptionType) =>
          props.value.includes(option.value)
        )}
      />
    );
  } else {
    return (
      <Select
        value={props.options.enumOptions.filter(
          (option: OptionType) => option.value === props.value
        )}
        options={props.options.enumOptions}
        onChange={(selection: OptionType): void =>
          props.onChange(processSingleSelect(selection))
        }
      />
    );
  }
};

export default CustomSelect;

type OptionType = {
  value: string;
  label: string;
};
