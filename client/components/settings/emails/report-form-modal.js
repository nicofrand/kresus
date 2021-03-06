import React from 'react';
import { connect } from 'react-redux';

import { translate as $t } from '../../../helpers';
import { actions } from '../../../store';
import { registerModal } from '../../ui/modal';

import AccountSelector from './account-select';
import ModalContent from '../../ui/modal/content';
import CancelAndSave from '../../ui/modal/cancel-and-save-buttons';

export const MODAL_SLUG = 'report-creation';

const ReportCreationModal = connect(
    null,
    dispatch => {
        return {
            async createAlert(newAlert) {
                try {
                    await actions.createAlert(dispatch, newAlert);
                    actions.hideModal(dispatch);
                } catch (err) {
                    // TODO properly report.
                }
            }
        };
    }
)(
    class Content extends React.Component {
        refFrequencySelect = node => (this.frequency = node);
        refAccountSelector = node => (this.account = node);

        handleSubmit = () => {
            let newAlert = {
                type: 'report',
                accountId: this.account.getWrappedInstance().value(),
                frequency: this.frequency.value
            };
            this.props.createAlert(newAlert);
        };

        render() {
            const body = (
                <React.Fragment>
                    <div className="cols-with-label">
                        <label htmlFor="account">{$t('client.settings.emails.account')}</label>
                        <AccountSelector ref={this.refAccountSelector} id="account" />
                    </div>

                    <div className="cols-with-label">
                        <label htmlFor="frequency">{$t('client.settings.emails.frequency')}</label>
                        <select ref={this.refFrequencySelect} id="frequency">
                            <option value="daily">{$t('client.settings.emails.daily')}</option>
                            <option value="weekly">{$t('client.settings.emails.weekly')}</option>
                            <option value="monthly">{$t('client.settings.emails.monthly')}</option>
                        </select>
                    </div>
                </React.Fragment>
            );

            const footer = (
                <CancelAndSave
                    onSave={this.handleSubmit}
                    saveLabel={$t('client.settings.emails.create')}
                />
            );

            return (
                <ModalContent
                    title={$t('client.settings.emails.add_report')}
                    body={body}
                    footer={footer}
                />
            );
        }
    }
);

registerModal(MODAL_SLUG, () => <ReportCreationModal />);
