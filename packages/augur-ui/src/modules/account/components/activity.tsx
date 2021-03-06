import React, { useState } from 'react';

import Stats from 'modules/account/components/stats';
import { TIMEFRAME_OPTIONS } from 'modules/common/constants';
import { LinearPropertyLabel } from 'modules/common/labels';
import Styles from 'modules/account/components/activity.styles.less';
import { useAppStatusStore } from 'modules/app/store/app-status';
import { formatDai } from 'utils/format-number';
import { createBigNumber } from 'utils/create-big-number';
import { convertAttoValueToDisplayValue } from '@augurproject/utils';

const Activity = () => {
  const { universe: { timeframeData: { openInterest: totalOpenInterest } }} = useAppStatusStore();
  const value = convertAttoValueToDisplayValue(createBigNumber(totalOpenInterest || 0));
  const openInterest = formatDai(value, { decimals: 2, removeComma: true });
  const [selected, setSelected] = useState(TIMEFRAME_OPTIONS[2].id);
  return (
    <div className={Styles.Activity}>
      <h4>Activity</h4>
      <LinearPropertyLabel
        highlight
        key="openInterest"
        label="Open Interest"
        value={openInterest}
        useFull
      />
      <Stats
        timeframe={selected}
        updateSelected={selected => setSelected(selected)}
        isPlatform
      />
    </div>
  );
};

export default Activity;
