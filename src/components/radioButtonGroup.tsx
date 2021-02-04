// [COMPONENT] Container with radio buttons
//   -> Custom widget for radio button group in transformations.json
//   -> Used in: Formulabar

import React from 'react';

export const RadioButtonGroup = (props): JSX.Element => {
  return (
    <div className="radio-button-group">
      {props.options.enumOptions.map((option, index) => (
        <div key={option.label + index} className="radio-wrapper">
          <input
            type="radio"
            className="radio-button"
            id={`rb-${index}`}
            onChange={(): void => {
              props.onChange(option.value);
            }}
            checked={props.value === option.value}
          />
          <label
            className="radio-button-label ellipsized"
            htmlFor={`rb-${index}`}
          >
            {option.label}
          </label>
        </div>
      ))}
    </div>
  );
};
