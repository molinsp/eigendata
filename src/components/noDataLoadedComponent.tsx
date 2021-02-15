// [COMPONENT] Empty state component
//   -> Description: is shown if there are no dataframes loaded
//   -> Used in: Datavizualizer

import React from 'react';
import { noDataMagnifier } from '../assets/svgs';
import { ReloadButton } from './reloadButton';

export const EmptyStateComponent = ({
  onLinkClick,
  onReloadButtonClick
}: Props): JSX.Element => {
  return (
    <div className="empty-state__container">
      <p className="empty-state__title">No data loaded</p>
      <p className="empty-state__link">
        Use the Magic Formula Bar to load data
      </p>
      <a
        className="empty-state__link"
        onClick={(): void => {
          if (onLinkClick) {
            onLinkClick();
          }
        }}
      >
        Click here to load data with the magic formula bar
      </a>
      <div>{noDataMagnifier}</div>
      <ReloadButton
        title="Reload datavizualizer"
        onClick={onReloadButtonClick}
      />
    </div>
  );
};

type Props = {
  onLinkClick?(): void;
  onReloadButtonClick?(): void;
};
