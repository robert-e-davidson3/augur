import React, { useMemo } from 'react';
import { SelectedOrderProperties } from 'modules/trading/components/wrapper';
import Wrapper from 'modules/trading/components/wrapper';
import Styles from 'modules/trading/components/trading-form.styles.less';
import { MarketData, OutcomeFormatted, NewMarket, IndividualOutcomeOrderBook } from 'modules/types';
import { TradingProvider } from 'modules/trading/store/trading';
 
interface TradingFormProps {
  selectedOutcomeId: number;
  market: MarketData | NewMarket;
  selectedOrderProperties: SelectedOrderProperties;
  updateSelectedOrderProperties: Function;
  updateSelectedOutcome: Function;
  updateLiquidity?: Function;
  tutorialNext?: Function;
  orderBook: IndividualOutcomeOrderBook;
}

const TradingForm = ({
  selectedOutcomeId = 2,
  market,
  ...props
}: TradingFormProps) => {
  const selectedOutcome = useMemo(
    () =>
      market.outcomesFormatted.find(
        ({ id }) => id === selectedOutcomeId
      ),
    [selectedOutcomeId, market]
  );
  return (
    <TradingProvider>
      <section className={Styles.TradingForm}>
        <Wrapper
          market={market}
          selectedOutcome={selectedOutcome}
          {...props}
        />
      </section>
   </TradingProvider>
  );
};

export default TradingForm;
