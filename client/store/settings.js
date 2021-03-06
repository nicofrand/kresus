import u from 'updeep';
import moment from 'moment';

import DefaultSettings from '../../shared/default-settings';

import { assert, setupTranslator, translate as $t } from '../helpers';

import * as backend from './backend';
import { createReducerFromMap, fillOutcomeHandlers, SUCCESS, FAIL } from './helpers';

import {
    DISABLE_ACCESS,
    EXPORT_INSTANCE,
    SEND_TEST_EMAIL,
    SET_SETTING,
    UPDATE_ACCESS,
    UPDATE_WEBOOB,
    GET_WEBOOB_VERSION,
    GET_LOGS
} from './actions';

import Errors, { genericErrorHandler } from '../errors';

const settingsState = u({
    // A map of key to values.
    map: {}
});

// Basic action creators
const basic = {
    sendTestEmail() {
        return {
            type: SEND_TEST_EMAIL
        };
    },

    set(key, value) {
        return {
            type: SET_SETTING,
            key,
            value
        };
    },

    updateWeboob() {
        return {
            type: UPDATE_WEBOOB
        };
    },

    fetchWeboobVersion(version = null, isInstalled = null) {
        return {
            type: GET_WEBOOB_VERSION,
            version,
            isInstalled
        };
    },

    fetchLogs(logs = null) {
        return {
            type: GET_LOGS,
            logs
        };
    },

    disableAccess(accessId, newFields = {}) {
        return {
            type: DISABLE_ACCESS,
            accessId,
            newFields
        };
    },

    updateAccess(accessId, newFields = {}, results = null) {
        return {
            type: UPDATE_ACCESS,
            accessId,
            newFields,
            results
        };
    },

    exportInstance(password, content = null) {
        return {
            type: EXPORT_INSTANCE,
            password,
            content
        };
    }
};

const fail = {},
    success = {};
fillOutcomeHandlers(basic, fail, success);

export function disableAccess(accessId) {
    let newFields = {
        enabled: false
    };
    return dispatch => {
        dispatch(basic.disableAccess(accessId));
        return backend
            .updateAccess(accessId, newFields)
            .then(() => {
                dispatch(success.disableAccess(accessId, newFields));
            })
            .catch(err => {
                dispatch(fail.disableAccess(err));
                throw err;
            });
    };
}

export function sendTestEmail(email) {
    return dispatch => {
        dispatch(basic.sendTestEmail());
        backend
            .sendTestEmail(email)
            .then(() => {
                dispatch(success.sendTestEmail());
            })
            .catch(err => {
                dispatch(fail.sendTestEmail(err));
            });
    };
}

export function set(key, value) {
    assert(typeof key === 'string', 'key must be a string');
    assert(typeof value === 'string', 'value must be a string');
    assert(key.length + value.length, 'key and value must be non-empty');

    return dispatch => {
        dispatch(basic.set(key, value));
        return backend
            .saveSetting(String(key), String(value))
            .then(() => {
                dispatch(success.set(key, value));
            })
            .catch(err => {
                dispatch(fail.set(err, key, value));
                throw err;
            });
    };
}

export function updateWeboob() {
    return dispatch => {
        dispatch(basic.updateWeboob());
        backend
            .updateWeboob()
            .then(() => {
                dispatch(success.updateWeboob());
            })
            .catch(err => {
                dispatch(fail.updateWeboob(err));
            });
    };
}

export function fetchWeboobVersion() {
    return dispatch => {
        backend
            .fetchWeboobVersion()
            .then(result => {
                let { version, isInstalled } = result.data;
                dispatch(success.fetchWeboobVersion(version, isInstalled));
            })
            .catch(err => {
                dispatch(fail.fetchWeboobVersion(err));
            });
    };
}

export function resetWeboobVersion() {
    return success.fetchWeboobVersion(null, null);
}

export function updateAccess(accessId, login, password, customFields) {
    let newFields = {
        login,
        customFields,
        enabled: true
    };
    return dispatch => {
        dispatch(basic.updateAccess(accessId, newFields));
        return backend
            .updateAccess(accessId, { password, ...newFields })
            .then(results => {
                results.accessId = accessId;
                dispatch(success.updateAccess(accessId, newFields, results));
            })
            .catch(err => {
                dispatch(fail.updateAccess(err));
                throw err;
            });
    };
}

export function exportInstance(maybePassword) {
    return dispatch => {
        dispatch(basic.exportInstance());
        backend
            .exportInstance(maybePassword)
            .then(res => {
                dispatch(success.exportInstance(null, res));
            })
            .catch(err => {
                dispatch(fail.exportInstance(err));
            });
    };
}

export function fetchLogs() {
    return dispatch => {
        backend
            .fetchLogs()
            .then(result => {
                dispatch(success.fetchLogs(result));
            })
            .catch(err => {
                dispatch(fail.fetchLogs(err));
            });
    };
}

export function resetLogs() {
    return success.fetchLogs(null);
}

// Reducers
function reduceSet(state, action) {
    let { status, key, value } = action;

    if (status === SUCCESS) {
        if (key === 'locale') {
            setupTranslator(value);
        }

        return u({ map: { [key]: value } }, state);
    }

    return state;
}

function reduceExportInstance(state, action) {
    let { status } = action;

    if (status === SUCCESS) {
        let { content } = action;

        let blob;
        let extension;
        if (typeof content === 'object') {
            blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
            extension = 'json';
        } else {
            assert(typeof content === 'string');
            blob = new Blob([content], { type: 'txt' });
            extension = 'txt';
        }
        const url = URL.createObjectURL(blob);

        const date = moment().format('YYYY-MM-DD');
        const filename = `kresus-backup_${date}.${extension}`;

        try {
            // Create a fake link and simulate a click on it.
            const anchor = document.createElement('a');
            anchor.setAttribute('href', url);
            anchor.setAttribute('download', filename);

            const event = document.createEvent('MouseEvents');
            event.initEvent('click', true, true);
            anchor.dispatchEvent(event);
        } catch (e) {
            // Revert to a less friendly method if the previous doesn't work.
            window.open(url, '_blank');
        }
    }

    return state;
}

function reduceGetWeboobVersion(state, action) {
    let { status } = action;

    if (status === SUCCESS) {
        let stateUpdates = { map: { 'weboob-version': action.version } };

        if (typeof action.isInstalled === 'boolean') {
            if (!action.isInstalled) {
                window.alert($t('client.sync.weboob_not_installed'));
            }
            stateUpdates.map['weboob-installed'] = action.isInstalled.toString();
        }

        return u(stateUpdates, state);
    }

    if (status === FAIL) {
        if (action.error.code === Errors.WEBOOB_NOT_INSTALLED) {
            window.alert($t('client.sync.weboob_not_installed'));
            return u({ map: { 'weboob-installed': 'false' } }, state);
        }

        genericErrorHandler(action.error);
        return u({ map: { 'weboob-version': null } }, state);
    }

    return state;
}

function reduceGetLogs(state, action) {
    let { status } = action;

    if (status === SUCCESS) {
        return u({ logs: action.logs }, state);
    }

    if (status === FAIL) {
        genericErrorHandler(action.error);
        return u({ logs: null }, state);
    }

    return state;
}

const reducers = {
    EXPORT_INSTANCE: reduceExportInstance,
    GET_WEBOOB_VERSION: reduceGetWeboobVersion,
    GET_LOGS: reduceGetLogs,
    SET_SETTING: reduceSet
};

export const reducer = createReducerFromMap(settingsState, reducers);

// Initial state
export function initialState(settings) {
    let map = {};

    for (let pair of settings) {
        assert(
            DefaultSettings.has(pair.name),
            `all settings must have their default value, missing for: ${pair.name}`
        );
        map[pair.name] = pair.value;
    }

    assert(typeof map.locale !== 'undefined', 'Kresus needs a locale');

    setupTranslator(map.locale);

    return u({ logs: null, map }, {});
}

// Getters
export function get(state, key) {
    if (typeof state.map[key] !== 'undefined') {
        return state.map[key];
    }

    return getDefaultSetting(state, key);
}

export function getDefaultSetting(state, key) {
    assert(
        DefaultSettings.has(key),
        `all settings must have default values, but ${key} doesn't have one.`
    );
    return DefaultSettings.get(key);
}

export function getLogs(state) {
    return state.logs;
}

export function getWeboobVersion(state) {
    return get(state, 'weboob-version');
}
