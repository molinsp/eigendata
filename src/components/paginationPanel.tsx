// [COMPONENT] Panel for pagination control
//   -> Description: return JSX.Element with buttons and selects
// that allows to add pagination for table
//   -> Used in: Datavizualizer

import React from 'react';
import Select from 'react-select';

export const PaginationPanel = (props: Props): JSX.Element => {
  const modifiedSelectedOption = {
    ...props.currentPageConfig.selectedOption
  };
  modifiedSelectedOption.label =
    props.currentPageConfig.selectedOption.label + ` of ${props.pageSize}`;
  return (
    <div className="pagination-panel">
      <button
        className="pagination-segment"
        onClick={props.onFirstClick}
        disabled={props.currentPageConfig.selectedOption.value === 1}
      >
        First
      </button>
      <button
        className="pagination-segment"
        onClick={props.onPrevClick}
        disabled={props.currentPageConfig.selectedOption.value === 1}
      >
        &#10094;
      </button>
      <button
        className="pagination-segment"
        onClick={props.onNextClick}
        disabled={
          props.currentPageConfig.selectedOption.value === props.pageSize
        }
      >
        &#10095;
      </button>
      <button
        className="pagination-segment"
        onClick={props.onLastClick}
        disabled={
          props.currentPageConfig.selectedOption.value === props.pageSize
        }
      >
        Last
      </button>
      <Select
        options={props.currentPageConfig.options}
        value={modifiedSelectedOption}
        onChange={(value): void => props.currentPageConfig.onSelect(value)}
        className="pagination-page-select"
        placeholder="Go to the page..."
        menuPlacement="auto"
        isSearchable
      />
      <Select
        options={props.pageSizeSelectionConfig.options}
        value={props.pageSizeSelectionConfig.selectedOption}
        onChange={(value): void =>
          props.pageSizeSelectionConfig.onSelect(value)
        }
        className="pagination-size-select"
        menuPlacement="auto"
      />
    </div>
  );
};

type Props = {
  pageSize: number;
  onNextClick?(): void;
  onPrevClick?(): void;
  onFirstClick?(): void;
  onLastClick?(): void;
  pageSizeSelectionConfig?: SelectionConfig;
  currentPageConfig?: SelectionConfig;
};

type SelectionConfig = {
  options: Option[];
  selectedOption: Option;
  onSelect(value): void;
};

type Option = {
  value: any;
  label: string;
};
