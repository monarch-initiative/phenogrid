##############################################################################
#
# A set of basic steps.
# https://selenium-python.readthedocs.org/
# 
##############################################################################

from behave import *
from urlparse import urlparse
import time
import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait # available since 2.4.0
from selenium.webdriver.support import expected_conditions as EC # available since 2.26.0

# The basic and critical "go to page".
@given('I go to page "{page}"')
def step_impl(context, page):
    context.browser.get(context.target + page)
    # time.sleep(10)
    # from selenium.webdriver.support import expected_conditions as EC
    # wait = WebDriverWait(driver, 10)
    # element = wait.until(EC.element_to_be_clickable((By.ID,'someid')))

@given('I go to slow page "{page}" and wait for id "{id}"')
def step_impl(context, page, id):
    context.browser.get(context.target + page)
    #time.sleep(30)
    element = WebDriverWait(context.browser, 60).until(EC.presence_of_element_located((By.ID, id)))
    # try:
    #     print(id)
    #     element = WebDriverWait(context.browser, 30).until(EC.presence_of_element_located((By.ID, id)))
    # finally:
    #     print("FINALLY")
    #     #context.browser.quit()

# Click 
@given('I click the "{id}"')
def step_impl(context, id):
    webelt = context.browser.find_element_by_id(id)
    webelt.click()
    context.browser.implicitly_wait(30)

# Mouse over
# http://selenium.googlecode.com/svn/trunk/docs/api/py/webdriver/selenium.webdriver.common.action_chains.html
@given('I move mouse to the "{id}"')
def step_impl(context, id):
    elem = context.browser.find_element_by_id(id)
    hover = ActionChains(context.browser).move_to_element(elem)
    hover.perform()

# Check radio button
@given('I check the radio button labelled as "{text}"')
def step_impl(context, text):
    target = "input[type='radio'][value='" + text + "']"
    radio_btn = context.browser.find_element_by_css_selector(target)
    radio_btn.click()
    context.browser.implicitly_wait(30)
    
# The document body should contain a certain piece of text.
@then('the document should contain "{text}"')
def step_impl(context, text):
    print(context.browser.title)
    webelt = context.browser.find_element_by_tag_name('html')
    print(webelt.text)
    assert webelt.text.rfind(text) != -1
    # webelt = context.browser.find_element_by_tag_name('body')
    # print(webelt.get_attribute('innerHTML'))
    # assert webelt.get_attribute('innerHTML').rfind(text) != -1

# The document body should contain a hyperlink with text.
@then('the document should contain link with "{text}"')
def step_impl(context, text):
    from selenium.common.exceptions import NoSuchElementException
    isFound = True
    try:
        context.browser.find_element_by_link_text(text)
    except NoSuchElementException:
        isFound = False
    assert isFound

# A given id should contain a given piece of text/content. 
# Not generably usable by non-dev test writers.
@then('the id "{id}" should contain "{text}"')
def step_impl(context, id, text):
    webelt = context.browser.find_element_by_id(id)
    assert webelt.text.rfind(text) != -1





