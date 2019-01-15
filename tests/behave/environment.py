##############################################################################
#
# Setup gross testing environment.
#
# UI instance target base URL and browser type (Chrome, firefox, and PhantomJS).
# This software is subject to the provisions of the MIT license at
# https://pythonhosted.org/behave/tutorial.html#environmental-controls
#
##############################################################################

import os
import sys
import time
from selenium import webdriver
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
# from selenium.webdriver.firefox.firefox_binary import FirefoxBinary
from selenium.webdriver import Firefox
from selenium.webdriver.firefox.options import Options

options = Options()
options.add_argument('-headless')
firefox = Firefox(firefox_options=options)

# Run this before anything else.
def before_all(context):
    print("context", context)
    # Determine the target path. Can either be file path or base URL.
    if 'TARGET' in os.environ:
        context.target = os.environ['TARGET']
    else:
        print("Please specify the Phenogrid file path or base URL with 'TARGET=' format")
        sys.exit(1)

	# Check to see which browser to use, default to use Firefox
    if 'BROWSER' in os.environ and os.environ['BROWSER'] == 'phantomjs':
        context.browser = webdriver.PhantomJS()
        print("# Using PhantomJS")
    else:
        pass # FF is default

        # print("# Using Firefox")
        # d = DesiredCapabilities.FIREFOX
        # d['marionette'] = True
        # # d['binary'] = '/Applications/Firefox.app/Contents/MacOS/firefox-bin'
        # d['loggingPrefs'] = {'browser': 'ALL', 'client': 'ALL', 'driver': 'ALL', 'performance': 'ALL', 'server': 'ALL'}
        # fp = webdriver.FirefoxProfile()
        # fp.set_preference('devtools.jsonview.enabled', False)
        # fp.set_preference('javascript.options.showInConsole', True)
        # fp.set_preference('browser.dom.window.dump.enabled', True)
        # fp.set_preference('devtools.chrome.enabled', True)
        # fp.set_preference("devtools.webconsole.persistlog", True)

        # fp.set_preference("devtools.browserconsole.filter.jslog", True)
        # fp.set_preference("devtools.browserconsole.filter.jswarn", True)
        # fp.set_preference("devtools.browserconsole.filter.error", True)
        # fp.set_preference("devtools.browserconsole.filter.warn", True)
        # fp.set_preference("devtools.browserconsole.filter.info", True)
        # fp.set_preference("devtools.browserconsole.filter.log", True)

        # fp.set_preference("devtools.webconsole.filter.jslog", True)
        # fp.set_preference("devtools.webconsole.filter.jswarn", True)
        # fp.set_preference("devtools.webconsole.filter.error", True)
        # fp.set_preference("devtools.webconsole.filter.warn", True)
        # fp.set_preference("devtools.webconsole.filter.info", True)
        # fp.set_preference("devtools.webconsole.filter.log", True)

        # context.browser = webdriver.Firefox(capabilities=d, firefox_profile=fp, executable_path='/usr/local/bin/geckodriver')
        # context.browser._is_remote = False

    # Set a 30 second implicit wait - http://selenium-python.readthedocs.org/en/latest/waits.html#implicit-waits
    # Once set, the implicit wait is set for the life of the WebDriver object instance.
    context.browser.set_window_size(1440, 900)
    context.browser.implicitly_wait(30) # seconds

# Do this after completing everything.
def after_all(context):
    context.browser.quit()
