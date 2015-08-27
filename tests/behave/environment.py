####
#### Setup gross testing environment.
####
#### This currently includes the UI instance target and browser type
#### (FF vs PhantomJS).
####

import os
import time
from selenium import webdriver

###
### Simple (but somewhat excessive for the data parts) environment.
###

## Run this before anything else.
def before_all(context):
    ## Determine the server target. 
    context.target = 'http://monarchinitiative.org'
    if 'TARGET' in os.environ:
        context.target = os.environ['TARGET']
    if 'BROWSER' in os.environ and os.environ['BROWSER'] == 'phantomjs':
        context.browser = webdriver.PhantomJS()
        print("# Using PhantomJS")
    else:
        context.browser = webdriver.Firefox()
    #
    # Set a 30 second implicit wait - http://selenium-python.readthedocs.org/en/latest/waits.html#implicit-waits
    # Once set, the implicit wait is set for the life of the WebDriver object instance.
    #
    context.browser.set_window_size(1440, 900)
    context.browser.implicitly_wait(30) # seconds

## Do this after completing everything.
def after_all(context):
    context.browser.quit()
