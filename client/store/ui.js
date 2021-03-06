import u from 'updeep';

import { createReducerFromMap, fillOutcomeHandlers, SUCCESS, FAIL } from './helpers';

import {
    SET_IS_SMALL_SCREEN,
    SET_SEARCH_FIELD,
    SET_SEARCH_FIELDS,
    RESET_SEARCH,
    TOGGLE_SEARCH_DETAILS,
    LOAD_THEME,
    UPDATE_MODAL
} from './actions';

import { computeIsSmallScreen } from '../helpers';

// Basic action creators
const basic = {
    setSearchField(field, value) {
        return {
            type: SET_SEARCH_FIELD,
            field,
            value
        };
    },

    setSearchFields(fieldsMap) {
        return {
            type: SET_SEARCH_FIELDS,
            fieldsMap
        };
    },

    resetSearch(showDetails) {
        return {
            type: RESET_SEARCH,
            showDetails
        };
    },

    toggleSearchDetails(show) {
        return {
            type: TOGGLE_SEARCH_DETAILS,
            show
        };
    },

    setThemeLoadStatus(status) {
        return {
            type: LOAD_THEME,
            status
        };
    },

    setIsSmallScreen(isSmall) {
        return {
            type: SET_IS_SMALL_SCREEN,
            isSmall
        };
    },

    showModal(slug, modalState) {
        return {
            type: UPDATE_MODAL,
            slug,
            modalState
        };
    },

    hideModal() {
        return {
            type: UPDATE_MODAL,
            slug: null,
            modalState: null
        };
    }
};

const fail = {},
    success = {};
fillOutcomeHandlers(basic, fail, success);

export function setSearchField(field, value) {
    return basic.setSearchField(field, value);
}
export function setSearchFields(fieldsMap) {
    return basic.setSearchFields(fieldsMap);
}
export function resetSearch(showDetails) {
    return basic.resetSearch(showDetails);
}
export function toggleSearchDetails(show) {
    return basic.toggleSearchDetails(show);
}

export function startThemeLoad() {
    return basic.setThemeLoadStatus();
}

export function finishThemeLoad(status) {
    if (status) {
        return success.setThemeLoadStatus();
    }
    return fail.setThemeLoadStatus();
}

export function setIsSmallScreen(isSmall) {
    return basic.setIsSmallScreen(isSmall);
}

export function showModal(slug, modalState) {
    return basic.showModal(slug, modalState);
}

export function hideModal() {
    return basic.hideModal();
}

// Reducers
function reduceSetSearchField(state, action) {
    let { field, value } = action;
    return u.updateIn(['search', field], value, state);
}

function reduceSetSearchFields(state, action) {
    return u.updateIn(['search'], action.fieldsMap, state);
}

function reduceToggleSearchDetails(state, action) {
    let { show } = action;
    if (typeof show !== 'boolean') {
        show = !getDisplaySearchDetails(state);
    }
    return u.updateIn('displaySearchDetails', show, state);
}

function reduceResetSearch(state, action) {
    let { showDetails } = action;
    return u(
        {
            search: initialSearch(showDetails)
        },
        state
    );
}

function reduceUpdateWeboob(state, action) {
    let { status } = action;

    if (status === SUCCESS) {
        return u({ updatingWeboob: false }, state);
    }

    if (status === FAIL) {
        if (action.error && typeof action.error.message === 'string') {
            alert(`Error when updating weboob: ${action.error.message}`);
        }

        return u({ updatingWeboob: false }, state);
    }

    return u({ updatingWeboob: true }, state);
}

function reduceSendTestEmail(state, action) {
    let { status } = action;

    if (status === SUCCESS) {
        return u({ sendingTestEmail: false }, state);
    }

    if (status === FAIL) {
        if (action.error && typeof action.error.message === 'string') {
            alert(`Error when trying to send test email: ${action.error.message}`);
        }

        return u({ sendingTestEmail: false }, state);
    }

    return u({ sendingTestEmail: true }, state);
}

function reduceExportInstance(state, action) {
    let { status } = action;

    if (status === SUCCESS || status === FAIL) {
        return u({ isExporting: false }, state);
    }

    return u({ isExporting: true }, state);
}

function reduceSetIsSmallScreen(state, action) {
    let { isSmall } = action;
    return u({ isSmallScreen: isSmall }, state);
}

function reduceUpdateModal(state, action) {
    let { slug, modalState } = action;
    return u({ modal: { slug, state: modalState } }, state);
}

function makeHideModalOnSuccess(reducer = null) {
    return function(state, action) {
        let newState = state;
        if (reducer !== null) {
            newState = reducer(state, action);
        }
        if (action.status === SUCCESS) {
            return reduceUpdateModal(newState, { slug: null, modalState: null });
        }
        return newState;
    };
}

const hideModalOnSuccess = makeHideModalOnSuccess();

// Generates the reducer to display or not the spinner.
function makeProcessingReasonReducer(processingReason) {
    return function(state, action) {
        let { status } = action;
        if (status === FAIL || status === SUCCESS) {
            return u({ processingReason: null }, state);
        }
        return u({ processingReason }, state);
    };
}

const reducers = {
    IMPORT_INSTANCE: makeProcessingReasonReducer('client.spinner.import'),
    CREATE_ACCESS: makeProcessingReasonReducer('client.spinner.fetch_account'),
    DELETE_ACCESS: makeHideModalOnSuccess(
        makeProcessingReasonReducer('client.spinner.delete_account')
    ),
    DELETE_ACCOUNT: makeHideModalOnSuccess(
        makeProcessingReasonReducer('client.spinner.delete_account')
    ),
    DELETE_ALERT: hideModalOnSuccess,
    DELETE_CATEGORY: hideModalOnSuccess,
    DELETE_OPERATION: hideModalOnSuccess,
    RESET_SEARCH: reduceResetSearch,
    RUN_ACCOUNTS_SYNC: makeProcessingReasonReducer('client.spinner.sync'),
    RUN_BALANCE_RESYNC: makeProcessingReasonReducer('client.spinner.balance_resync'),
    RUN_OPERATIONS_SYNC: makeProcessingReasonReducer('client.spinner.sync'),
    SEND_TEST_EMAIL: reduceSendTestEmail,
    SET_SEARCH_FIELD: reduceSetSearchField,
    SET_SEARCH_FIELDS: reduceSetSearchFields,
    TOGGLE_SEARCH_DETAILS: reduceToggleSearchDetails,
    LOAD_THEME: makeProcessingReasonReducer('client.general.loading_assets'),
    UPDATE_ACCESS: makeProcessingReasonReducer('client.spinner.fetch_account'),
    UPDATE_MODAL: reduceUpdateModal,
    UPDATE_WEBOOB: reduceUpdateWeboob,
    EXPORT_INSTANCE: reduceExportInstance,
    SET_IS_SMALL_SCREEN: reduceSetIsSmallScreen
};

const uiState = u({
    search: {},
    displaySearchDetails: false,
    processingReason: 'client.general.loading_assets',
    updatingWeboob: false,
    sendingTestEmail: false
});

export const reducer = createReducerFromMap(uiState, reducers);

// Initial state
function initialSearch() {
    return {
        keywords: [],
        categoryId: '',
        type: '',
        amountLow: null,
        amountHigh: null,
        dateLow: null,
        dateHigh: null
    };
}

export function initialState() {
    let search = initialSearch();
    return u(
        {
            search,
            displaySearchDetails: false,
            processingReason: 'client.general.loading_assets',
            updatingWeboob: false,
            sendingTestEmail: false,
            isExporting: false,
            isSmallScreen: computeIsSmallScreen(),
            modal: {
                slug: null,
                state: null
            }
        },
        {}
    );
}

// Getters
export function getSearchFields(state) {
    return state.search;
}
export function hasSearchFields(state) {
    // Keep in sync with initialSearch();
    let { search } = state;
    return (
        search.keywords.length ||
        search.categoryId !== '' ||
        search.type !== '' ||
        search.amountLow !== null ||
        search.amountHigh !== null ||
        search.dateLow !== null ||
        search.dateHigh !== null
    );
}

export function getDisplaySearchDetails(state) {
    return state.displaySearchDetails;
}

export function getProcessingReason(state) {
    return state.processingReason;
}

export function isWeboobUpdating(state) {
    return state.updatingWeboob;
}

export function isSendingTestEmail(state) {
    return state.sendingTestEmail;
}

export function isExporting(state) {
    return state.isExporting;
}

export function isSmallScreen(state) {
    return state.isSmallScreen;
}

export function getModal(state) {
    return state.modal;
}
