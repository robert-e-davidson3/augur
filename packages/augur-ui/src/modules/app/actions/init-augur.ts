import {
  getNetworkId,
} from 'modules/contracts/actions/contractCalls';
import isGlobalWeb3 from 'modules/auth/helpers/is-global-web3';
import { checkIfMainnet } from 'modules/app/actions/check-if-mainnet';
import { closeModal } from 'modules/modal/actions/close-modal';
import logError from 'utils/log-error';
import { JsonRpcProvider, Web3Provider } from 'ethers/providers';
import { isEmpty } from 'utils/is-empty';
import {
  MODAL_NETWORK_DISCONNECTED,
  MODAL_NETWORK_DISABLED,
  ACCOUNT_TYPES,
  MODAL_LOADING,
  MODAL_ERROR,
  SIGNIN_SIGN_WALLET,
  MODAL_NETWORK_MISMATCH,
  NETWORK_NAMES,
} from 'modules/common/constants';
import { windowRef } from 'utils/window-ref';
import { AppState } from 'appStore';
import { ThunkDispatch } from 'redux-thunk';
import { Action } from 'redux';
import { NodeStyleCallback, WindowApp } from 'modules/types';
import { augurSdk } from 'services/augursdk';
import { listenForStartUpEvents } from 'modules/events/actions/listen-to-updates';
import { loginWithInjectedWeb3 } from 'modules/auth/actions/login-with-injected-web3';
import { loginWithPortis } from 'modules/auth/actions/login-with-portis';
import { loginWithFortmatic } from 'modules/auth/actions/login-with-fortmatic';
import { loginWithTorus } from 'modules/auth/actions/login-with-torus';
import { toChecksumAddress } from 'ethereumjs-util';
import { updateLoginAccount } from 'modules/account/actions/login-account';
import { logout } from 'modules/auth/actions/logout';
import { Augur, Provider } from '@augurproject/sdk';
import { getLoggedInUserFromLocalStorage } from 'services/storage/localStorage';
import { getFingerprint } from 'utils/get-fingerprint';
import { tryToPersistStorage } from 'utils/storage-manager';
import {
  isDevNetworkId,
  SDKConfiguration,
  serializeConfig,
  mergeConfig,
  validConfigOrDie,
} from '@augurproject/artifacts';
import { getNetwork } from 'utils/get-network-name';
import { buildConfig } from '@augurproject/artifacts';
import { showIndexedDbSize } from 'utils/show-indexed-db-size';
import { isGoogleBot } from 'utils/is-google-bot';
import { AppStatus } from 'modules/app/store/app-status';

const NETWORK_ID_POLL_INTERVAL_DURATION = 10000;

async function loadAccountIfStored(dispatch: ThunkDispatch<void, any, Action>) {
  const loggedInUser = getLoggedInUserFromLocalStorage();
  const loggedInAccount = (loggedInUser && loggedInUser.address) || null;
  const loggedInAccountType = (loggedInUser && loggedInUser.type) || null;
  const { setModal } = AppStatus.actions;
  const errorModal = () => {
    dispatch(logout());
    setModal({
        type: MODAL_ERROR,
      });
  };
  try {
    if (loggedInAccount) {
      if (isGlobalWeb3() && loggedInAccountType === ACCOUNT_TYPES.WEB3WALLET) {
        if (!windowRef.ethereum.selectedAddress) {
          // show metamask signer
          setModal({
              type: MODAL_LOADING,
              message: SIGNIN_SIGN_WALLET,
              showMetaMaskHelper: true,
              callback: () => dispatch(closeModal()),
            });
        }
        await dispatch(loginWithInjectedWeb3());
      }
      if (loggedInAccountType === ACCOUNT_TYPES.PORTIS) {
        await dispatch(loginWithPortis(false));
      }

      if (loggedInAccountType === ACCOUNT_TYPES.FORTMATIC) {
        await dispatch(loginWithFortmatic());
      }

      if (loggedInAccountType === ACCOUNT_TYPES.TORUS) {
        await dispatch(loginWithTorus());
      }
    }
  } catch (error) {
    errorModal();
  }
}

function pollForNetwork(
  dispatch: ThunkDispatch<void, any, Action>,
  getState: () => AppState
) {
  setInterval(() => {
    const { modal } = AppStatus.get();
    const { setModal } = AppStatus.actions;
    if (!process.env.ENABLE_MAINNET) {
      const isMainnet = checkIfMainnet();
      if (isMainnet && isEmpty(modal)) {
        setModal({
            type: MODAL_NETWORK_DISABLED,
          });
      } else if (!isMainnet && modal.type === MODAL_NETWORK_DISABLED) {
        dispatch(closeModal());
      }
    }
  }, NETWORK_ID_POLL_INTERVAL_DURATION);
}

export function connectAugur(
  history: History,
  config: SDKConfiguration,
  isInitialConnection = false,
  callback: NodeStyleCallback = logError,
) {
  return async (
    dispatch: ThunkDispatch<void, any, Action>,
    getState: () => AppState
  ) => {
    const { modal } = AppStatus.get();
    const { loginAccount } = getState();
    const windowApp = windowRef as WindowApp;
    const loggedInUser = getLoggedInUserFromLocalStorage();
    const loggedInAccount = loggedInUser && loggedInUser.address || null;
    const loggedInAccountType = loggedInUser && loggedInUser.type || null;

    // Preload Account
    const preloadAccount = accountType => {
      const address = toChecksumAddress(loggedInAccount);
      const accountObject = {
        address,
        mixedCaseAddress: address,
        meta: {
          address,
          signer: null,
          email: null,
          profileImage: null,
          openWallet: null,
          accountType,
          isWeb3: true,
          preloaded: true,
        },
      };
      AppStatus.actions.setRestoredAccount(true);
      dispatch(updateLoginAccount(accountObject));
    };

    if (isGlobalWeb3() && loggedInAccountType === ACCOUNT_TYPES.WEB3WALLET) {
      preloadAccount(ACCOUNT_TYPES.WEB3WALLET);
    }

    if (loggedInAccountType === ACCOUNT_TYPES.PORTIS) {
      preloadAccount(ACCOUNT_TYPES.PORTIS);
    }

    if (loggedInAccountType === ACCOUNT_TYPES.FORTMATIC) {
      preloadAccount(ACCOUNT_TYPES.FORTMATIC);
    }

    if (loggedInAccountType === ACCOUNT_TYPES.TORUS) {
      preloadAccount(ACCOUNT_TYPES.TORUS);
    }

    let provider = null;
    const networkId = config.networkId;

    if (networkId && !isDevNetworkId(networkId)) {
      // Unless DEV, use the provider on window if it exists, otherwise use torus provider
      if (windowRef.web3) {
        // Use window provider
        provider = new Web3Provider(windowRef.web3.currentProvider);
      } else {
        // Use torus provider

        // Use import instead of import for wallet SDK packages
        // to conditionally load web3 into the DOM.
        //
        // Note: This also creates a split point in webpack
        const {default: Torus} = await import(/* webpackChunkName: "torus" */ '@toruslabs/torus-embed');
        const torus = new Torus({});

        const host = getNetwork(networkId);
        await torus.init({
          network: { host },
          showTorusButton: false,
        });

        // Tor.us cleanup
        const torusWidget = document.querySelector('#torusWidget');
        if (torusWidget) {
          torusWidget.remove();
        }
        provider = new Web3Provider(torus.provider);
      }
    }
    else {
      // In DEV, use local ethereum node
      provider = new JsonRpcProvider(config.ethereum.http);
    }

    // Disable mesh/gsn for googleBot
    if (isGoogleBot()) {
      config = validConfigOrDie(mergeConfig(config, {
        zeroX: { mesh: { enabled: false }},
        gsn: { enabled: false },
        useWarpSync: false,
      }));
    }

    let sdk: Augur<Provider> = null;
    try {
      sdk = await augurSdk.makeClient(provider, config);
    } catch (e) {
      console.error(e);
      if (provider._network && config.networkId !== provider._network.chainId) {
        const { setModal } = AppStatus.actions;
        return setModal({
            type: MODAL_NETWORK_MISMATCH,
            expectedNetwork: NETWORK_NAMES[Number(config.networkId)],
          });
      } else {
        return callback('SDK could not be created', { config });
      }
    }

    let universeId = config.addresses?.Universe || sdk.contracts.universe.address;
    if (
      windowApp.localStorage &&
      windowApp.localStorage.getItem &&
      loginAccount.address
    ) {
      const loginAddress =
        (windowApp.localStorage.getItem &&
          windowApp.localStorage.getItem(loginAccount.address)) ||
        '';
      const storedUniverseId = JSON.parse(loginAddress).selectedUniverse[
        getNetworkId().toString()
      ];
      universeId = !storedUniverseId ? universeId : storedUniverseId;
    }
    AppStatus.actions.updateUniverse({ id: universeId });
    // If the network disconnected modal is being shown, but we are now
    // connected -- hide it.
    if (modal?.type === MODAL_NETWORK_DISCONNECTED) {
      dispatch(closeModal());
    }

    if (isInitialConnection) {
      loadAccountIfStored(dispatch);
      pollForNetwork(dispatch, getState);
    }

    // wire up start up events for sdk
    dispatch(listenForStartUpEvents(sdk));
    AppStatus.actions.setCanHotload(true);

    await augurSdk.connect();

    callback(null);
  };
}

interface initAugurParams {
  ethereumNodeHttp: string | null;
  ethereumNodeWs: string | null;
  sdkEndpoint: string | null;
  useWeb3Transport: boolean;
}

export function initAugur(
  history: History,
  {
    ethereumNodeHttp,
    ethereumNodeWs, /* unused */
    sdkEndpoint,
    useWeb3Transport,
  }: initAugurParams,
  callback: NodeStyleCallback = logError
) {
  return (
    dispatch: ThunkDispatch<void, any, Action>,
    getState: () => AppState
  ) => {
    // const config: SDKConfiguration = environments[`${process.env.ETHEREUM_NETWORK}`];
    const config = buildConfig(process.env.ETHEREUM_NETWORK || 'local');

    config.ethereum.useWeb3Transport = useWeb3Transport;

    if (ethereumNodeHttp) {
      config.ethereum.http = ethereumNodeHttp;
    }

    if (sdkEndpoint) {
      config.sdk.ws = sdkEndpoint;
    }

    console.log(
      '******** CONFIGURATION ***********\n' +
      serializeConfig(config) +
      '\n**********************************'
    );
    // cache fingerprint
    getFingerprint();
    AppStatus.actions.setEnv(config);
    tryToPersistStorage();
    connectAugur(history, config, true, callback)(dispatch, getState);

    windowRef.showIndexedDbSize = showIndexedDbSize;
  };
}
