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
