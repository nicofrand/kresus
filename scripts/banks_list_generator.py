#!/usr/bin/python

'''
A simple script to generate the banks.json file for Kresus.
'''

import argparse
import json
import os
import sys


# Import Weboob core
if 'WEBOOB_DIR' in os.environ and os.path.isdir(os.environ['WEBOOB_DIR']):
    WEBOOB_DIR = os.environ['WEBOOB_DIR']
    sys.path.append(WEBOOB_DIR)
else:
    print >>sys.stderr, '"WEBOOB_DIR" env variable shall be set.'
    sys.exit(1)

from weboob.core import WebNip
from weboob.core.modules import ModuleLoadError
from weboob.tools.backend import BackendConfig
from weboob.tools.value import Value, ValueBackendPassword


class MockModule(object):
    def __init__(self, name, description, config):
        self.name = name
        self.description = description
        self.config = config
        self.backend = 'mock'


# The known modules to be ignored either because they are only called by another module,
# or because they are deprecated.
IGNORE_MODULE_LIST = ['s2e', 'linebourse', 'groupama', 'wellsfargo', 'gmf']

MOCK_MODULES = [
    MockModule('fakebank1', 'Fake Bank 1', BackendConfig(
        Value('login'),
        ValueBackendPassword('password'),
        Value(
            'favorite_code_editor', choices={'vim': 'Vim', 'emacs': 'Emacs', 'sublime': 'Sublime'},
            default='sublime', required=True),
        ValueBackendPassword('secret', required=True))),
    MockModule('fakebank2', 'Fake Bank 2', BackendConfig(
        Value('login'), ValueBackendPassword('password')))
]

NEEDS_PLACEHOLDER = ['secret', 'birthday']

def print_error(text):
    print >>sys.stderr, text

def format_kresus(backend, module):
    '''
    Export the bank module to kresus format
    name : module.description
    uuid: module.name
    backend: backend
    customFields: [
        name:
        type:
    ]
    '''

    kresus_module = {
        'name': module.description,
        'uuid': module.name,
        'backend': backend
    }

    fields = []

    # Kresus does not expect login and password to be part of the custom fields, it is then not necessary to add them to the file.
    config = [item for item in module.config.items() if item[0] not in ('login', 'password')]

    for key, value in config:
        if not value.required and key not in ['website', 'auth_type']:
            print_error('Skipping key "%s" for module "%s".' % (key, module.name))
            continue

        field = {
            'name': key
        }

        if value.choices:
            field['type'] = 'select'
            if value.default:
                field['default'] = value.default
            choices = []
            for k, label in value.choices.iteritems():
                choices.append(dict(label=label, value=k))
            field['values'] = choices
        else:
            if value.masked:
                field['type'] = 'password'
            else:
                field['type'] = 'text'

        if key in NEEDS_PLACEHOLDER:
            field['placeholderKey'] = 'client.settings.%s_placeholder' % key

        fields.append(field)

    if fields:
        kresus_module['customFields'] = fields

    return kresus_module

class ModuleManager(WebNip):
    def __init__(self, modules_path):
        self.modules_path = modules_path
        super(ModuleManager, self).__init__(modules_path=self.modules_path)

    def list_bank_modules(self):
        module_list = []
        for module_name in sorted(self.modules_loader.iter_existing_module_names()):
            try:
                module = self.modules_loader.get_or_load_module(module_name)
            except ModuleLoadError as err:
                print_error('Could not import module "%s". Import raised:' % err.module)
                print_error('\t%s' % err)
                continue

            if not module.has_caps('CapBank'):
                continue

            if module_name in IGNORE_MODULE_LIST:
                print_error('Ignoring module "%s" as per request.' % module_name)
                continue

            if 'login' not in module.config:
                print_error('Ignoring module "%s". It does not have login.' % module_name)
                continue

            if 'password' not in module.config:
                print_error('Ignoring module "%s". It does not have password.' % module_name)
                continue

            module_list.append(module)
        return module_list

    def format_list_modules(self):
        return [format_kresus('weboob', module) for module in self.list_bank_modules()]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Generates the banks.json for Kresus')
    parser.add_argument('-o', '--output', help='The file to write the output of the command.', default=None)
    parser.add_argument('-i', '--ignore-fakemodules', help="Don't add the fakemodules to the list (default: false)", default=False, action='store_true')

    options = parser.parse_args()

    modules_path = os.path.join(WEBOOB_DIR, 'modules')
    if not os.path.isdir(modules_path):
        print_error('Unknown weboob directory %s' % modules_path)
        sys.exit(1)

    modules_manager = ModuleManager(modules_path)
    content = modules_manager.format_list_modules()

    if not options.ignore_fakemodules:
        # First add the fakeweboob modules.
        fake_modules_path = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server', 'weboob', 'fakemodules'))
        fake_modules_manager = ModuleManager(fake_modules_path)
        content += fake_modules_manager.format_list_modules()

        # Then the mock modules.
        content += [format_kresus(module.backend, module) for module in MOCK_MODULES]

    data = json.dumps(content, ensure_ascii=False, indent=4, separators=(',', ': '), sort_keys=True).encode('utf-8')

    output_file = options.output
    if output_file:
        try:
            with open(os.path.abspath(output_file), 'w') as f:
                f.write(data)
        except IOError as err:
            print_error('Failed to open output file: %s' % err)
            sys.exit(1)
    else:
        print data
