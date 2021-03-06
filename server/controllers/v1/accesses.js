import Access from '../../models/access';
import Account from '../../models/account';

import accountManager from '../../lib/accounts-manager';
import { fullPoll } from '../../lib/poller';

import * as AccountController from './accounts';

import { asyncErr, getErrorCode, KError, makeLogger } from '../../helpers';

let log = makeLogger('controllers/accesses');

// Preloads a bank access (sets @access).
export async function preloadAccess(req, res, next, accessId) {
    try {
        let access = await Access.find(accessId);
        if (!access) {
            throw new KError('bank access not found', 404);
        }
        req.preloaded = { access };
        return next();
    } catch (err) {
        return asyncErr(res, err, 'when finding bank access');
    }
}

// Destroy a given access, including accounts, alerts and operations.
export async function destroy(req, res) {
    try {
        let access = req.preloaded.access;
        log.info(`Removing access ${access.id} for bank ${access.bank}...`);

        // TODO arguably, this should be done in the access model.
        let accounts = await Account.byAccess(access);
        for (let account of accounts) {
            await AccountController.destroyWithOperations(account);
        }

        // The access should have been destroyed by the last account deletion.
        let stillThere = await Access.exists(access.id);
        if (stillThere) {
            log.error('Access should have been deleted! Manually deleting.');
            await access.destroy();
        }

        log.info('Done!');
        res.status(204).end();
    } catch (err) {
        return asyncErr(res, err, 'when destroying an access');
    }
}

function sanitizeCustomFields(access) {
    if (typeof access.customFields !== 'undefined') {
        try {
            JSON.parse(access.customFields);
        } catch (e) {
            log.warn('Sanitizing unparseable access.customFields.');
            let sanitized = { ...access };
            sanitized.customFields = '[]';
            return sanitized;
        }
    }
    return access;
}

// Creates a new bank access (expecting at least (bank / login / password)), and
// retrieves its accounts and operations.
export async function create(req, res) {
    let access;
    let createdAccess = false,
        retrievedAccounts = false;
    try {
        let params = req.body;

        if (!params.bank || !params.login || !params.password) {
            throw new KError('missing parameters', 400);
        }

        access = await Access.create(sanitizeCustomFields(params));
        createdAccess = true;

        await accountManager.retrieveAndAddAccountsByAccess(access);
        retrievedAccounts = true;

        let { accounts, newOperations } = await accountManager.retrieveOperationsByAccess(access);

        res.status(201).json({
            accessId: access.id,
            accounts,
            newOperations
        });
    } catch (err) {
        log.error('The access process creation failed, cleaning up...');

        // Silently swallow errors here, we don't want to catch errors in error
        // code.
        if (retrievedAccounts) {
            log.info('\tdeleting accounts...');
            let accounts = await Account.byAccess(access);
            for (let acc of accounts) {
                await acc.destroy();
            }
        }

        if (createdAccess) {
            log.info('\tdeleting access...');
            await access.destroy();
        }

        return asyncErr(res, err, 'when creating a bank access');
    }
}

// Fetch operations using the backend and return the operations to the client.
export async function fetchOperations(req, res) {
    try {
        let access = req.preloaded.access;

        if (!access.enabled) {
            let errcode = getErrorCode('DISABLED_ACCESS');
            throw new KError('disabled access', 403, errcode);
        }

        let { accounts, newOperations } = await accountManager.retrieveOperationsByAccess(access);

        res.status(200).json({
            accounts,
            newOperations
        });
    } catch (err) {
        return asyncErr(res, err, 'when fetching operations');
    }
}

// Fetch accounts, including new accounts, and operations using the backend and
// return both to the client.
export async function fetchAccounts(req, res) {
    try {
        let access = req.preloaded.access;

        if (!access.enabled) {
            let errcode = getErrorCode('DISABLED_ACCESS');
            throw new KError('disabled access', 403, errcode);
        }

        await accountManager.retrieveAndAddAccountsByAccess(access);

        let { accounts, newOperations } = await accountManager.retrieveOperationsByAccess(access);

        res.status(200).json({
            accounts,
            newOperations
        });
    } catch (err) {
        return asyncErr(res, err, 'when fetching accounts');
    }
}

// Fetch all the operations / accounts for all the accesses, as is done during
// any regular poll.
export async function poll(req, res) {
    try {
        await fullPoll();
        res.status(200).json({
            status: 'OK'
        });
    } catch (err) {
        log.warn(`Error when doing a full poll: ${err.message}`);
        res.status(500).json({
            status: 'error',
            message: err.message
        });
    }
}

// Updates a bank access.
export async function update(req, res) {
    try {
        let access = req.body;

        if (typeof access.enabled === 'undefined' || access.enabled) {
            await req.preloaded.access.updateAttributes(sanitizeCustomFields(access));
            await fetchAccounts(req, res);
        } else {
            if (Object.keys(access).length > 1) {
                log.warn('Supplementary fields not considered when disabling an access.');
            }

            let preloaded = req.preloaded.access;

            delete preloaded.password;
            preloaded.enabled = false;

            await preloaded.save();
            res.status(201).json({ status: 'OK' });
        }
    } catch (err) {
        return asyncErr(res, err, 'when updating bank access');
    }
}
