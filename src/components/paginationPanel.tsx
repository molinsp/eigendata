import React from 'react';
import Select from 'react-select';

export const PaginationPanel = (props: Props): JSX.Element => {
  return (
    <div className="pagination-panel">
      <button className="pagination-segment" onClick={props.onFirstClick}>
        First
      </button>
      <button className="pagination-segment" onClick={props.onPrevClick}>
        &#10094;
      </button>
      <button className="pagination-segment" onClick={props.onNextClick}>
        &#10095;
      </button>
      <button className="pagination-segment" onClick={props.onLastClick}>
        Last
      </button>
      <div className="pagination-segment">Page 1 of {props.pageCount}</div>
      <div className="pagination-segment">
        <input
          onChange={(e): void => {
            let value = Number(e.target.value) > 0 ? e.target.value : 1;
            value = value <= props.pageCount ? value : props.pageCount;
            props.onTextChange(value);
          }}
          value={props.textValue}
          type="number"
        />
      </div>
      <Select
        options={props.selectionConfig.options}
        value={props.selectionConfig.selectedValue}
        onChange={props.selectionConfig.onSelect}
        className="pagination-select"
      />
    </div>
  );
};

type Props = {
  textValue: number;
  onTextChange(value): void;
  pageCount: number;
  onNextClick?(): void;
  onPrevClick?(): void;
  onFirstClick?(): void;
  onLastClick?(): void;
  selectionConfig?: SelectionConfig;
};

type SelectionConfig = {
  options: Option[];
  selectedValue: Option;
  onSelect(value): void;
};

type Option = {
  value: any;
  label: string;
};
