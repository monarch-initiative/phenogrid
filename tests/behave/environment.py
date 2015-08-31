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

# Run this before anything else.
def before_all(context):
    # Determine the target path. Can either be file path or base URL. 
    if 'PATH' in os.environ:
        context.target = os.environ['PATH']
    else:
        print("Please specify the Base URL with 'PATH=' format")
        sys.exit(1)
		
	# Check to see which browser to use, default to use Firefox
    if 'BROWSER' in os.environ and os.environ['BROWSER'] == 'phantomjs':
        context.browser = webdriver.PhantomJS()
        print("# Using PhantomJS")
    else: 
        context.browser = webdriver.Firefox()
        print("# Using Firefox")

    # Set a 30 second implicit wait - http://selenium-python.readthedocs.org/en/latest/waits.html#implicit-waits
    # Once set, the implicit wait is set for the life of the WebDriver object instance.
    context.browser.set_window_size(1440, 900)
    context.browser.implicitly_wait(30) # seconds

# Do this after completing everything.
def after_all(context):
    context.browser.quit()
