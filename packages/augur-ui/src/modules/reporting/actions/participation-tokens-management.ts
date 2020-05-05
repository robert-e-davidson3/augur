import logError from 'utils/log-error';
import { AppState } from 'appStore';
import { NodeStyleCallback } from 'modules/types';
import { ThunkDispatch } from 'redux-thunk';
import { Action } from 'redux';
import {
  buyParticipationTokens,
  buyParticipationTokensEstimateGas,
} from 'modules/contracts/actions/contractCalls';
import { addUpdatePendingTransaction } from 'modules/pending-queue/actions/pending-queue-management';
import { BUYPARTICIPATIONTOKENS } from 'modules/common/constants';
import { TXEventName } from '@augurproject/sdk';
import { AppStatus } from 'modules/app/store/app-status';

export const purchaseParticipationTokens = (
  amount: string,
  estimateGas = false,
  callback: NodeStyleCallback = logError
) => async (
  dispatch: ThunkDispatch<void, any, Action>,
  getState: () => AppState
) => {
  const { universe: { id: universeId }} = AppStatus.get();
  if (!universeId) return callback('no universe provided');
  if (estimateGas) {
    const gas = await buyParticipationTokensEstimateGas(
      universeId,
      amount
    );
    return callback(null, gas);
  }
  buyParticipationTokens(universeId, amount).catch(() => {
    dispatch(addUpdatePendingTransaction(BUYPARTICIPATIONTOKENS, TXEventName.Failure))
  });
  callback(null);
};
