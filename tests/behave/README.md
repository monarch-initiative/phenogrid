# Behave Test Overview

Essentially, the idea is this: there are human language-like files
(features) that describe scenarios--pre-conditions, actions, and
their results; separately, there is code that maps these statements
to python selenium code and assertions (steps).

More information here: http://pythonhosted.org/behave/index.html

What this gets you is a pretty nice separation between the tests and
the code. The test language is simple and can be built up in such a
way that a complete non-programmer can easily write unit tests,
snapping them together like legos. The developer makes the legos and
run the tests. With the whole BDD thing there is a lot of kool-aid
being passed around (actually driving development with this seems a
bit mad to me), but being able to have a separation of concerns
between the human language-esque tests and the plumbing will allow
us to actually build up a body of tests without taking too much away
from development time.

# Setting Up Testing Environment

We use Python's virtualenv (Virtual Environments) to create isolated Python environments for this behave test.

## On Ubuntu 14.04 LTS

Setup the python environment in the right place.

````
sudo apt-get -u install python-virtualenv
````

## On CentOS 6.6

Many distributions include virtualenv as part of the default distribution repository. However, these version can become outdated and it is usually recommended installing from a repository containing the latest release.

One common repository added to CentOS and Red Hat Enterprise Linux (RHEL) servers is the Extra Packages for Enterprise Linux (EPEL) repository. The following command will add the EPEL repository to CentOS 6 or RHEL 6.

````
sudo rpm -Uvh http://dl.fedoraproject.org/pub/epel/6/x86_64/epel-release-6-8.noarch.rpm
````

Now virtualenv, and dependencies, can be installed using the YUM package manager.

````
sudo yum -y install python-virtualenv
````

## On Mac OS X

You can install the Python virtualenv through Homebrew on Mac.

# Runing Tests

Note: you need to have the desktop and web browser (it uses Firefox by default) installed in order to run the tests. 

Starting from the phenogrid root directory, type the following in your terminal:

````
PGDIR=`pwd`
````

Then we create a virtual environment for this behave test in the `tests/behave` directory:

````
cd tests/behave
virtualenv `pwd`
````

You sure can use a different name (say venv) for your virtual environment other than the current directory (``pwd``). Now we've created a virtual environment in the current working directory, which is `phenogrid/tests/behave/`. To begin using the virtual environment, it needs to be activated, there's a `activate` shell script in `bin/`.

````
source bin/activate
````

The `activate` script will modify the path and shell prompt (the name of the current virtual environment will now appear on the left of the prompt, which is 'behave' in this case) to let you know that it's active.

Now we will need to install the following tools (Selenium WebDriver and the behave command-line tool) in order to run the behave tests. And any package that you install using pip will be placed in the current folder, isolated from the global Python installation.

````
pip install selenium
pip install behave
````

Note: the products of these steps have been added to the .gitignore file.

Now we can go to the terminal and run all tests (the `phenogrid.feature` file):

When you have phenogrid embedded as a widget, you can either run the behave tests against the phenogrid file path (e,g., `file://PGDIR`) or web server base URL (if it's placed inside the HTTP server, e.g., `http://localhost:8080/phenogrid`)

````
TARGET=file://$PGDIR behave
````
or
````
TARGET=http://localhost:8080/phenogrid behave
````
(If you are running HTTP server on a different port number, adjust accordingly.)

This will test the index.html page in the phenogrid directory and run the behave tests in Firefox by default. If you want to use other browsers, e.g., [PhantomJS](http://phantomjs.org/) (a headless browser), you can do this:

````
TARGET=file://$PGDIR BROWSER=phantomjs behave
````
or
````
TARGET=http://localhost:8080/phenogrid BROWSER=phantomjs behave
````

Make sure after you have PhantomJS installed (let's say at `/usr/local/phantomjs/bin/phantomjs`), create a symbolic link of the phantomjs executable to the `/usr/bin/` so Selenium webdriver knows where to find the PhantomJS executable to run the tests against. For example:

````
ln -s /usr/local/phantomjs/bin/phantomjs /usr/bin/
````

And if you would like to export all the test running details into a log file, you can use the following command:

````
TARGET=file://$PGDIR behave > log
````
or 
````
TARGET=http://localhost:8080/phenogrid behave > log
````

This will create a file in the current directory named `log` that contians all the testing outputs. Make sure to add this log file in `.gitignore` if you do this.

Once you are done working in the virtual environment for the moment, you can deactivate it, this will undo the changes to your path and prompt.

````
deactivate
````

# Adding More Test Scenarios

You will see there are two `.feature` files, the `generic.feature` contains all the test scenarios that don't rely on the data input. And the `specific.feature` contains tests specific to the data input provided in the `index.html` array. You should change the test scenarios based on your data input.

# Debugging Tests

It is sometimes useful to pause the tests so that you can see what Selenium sees. This can be accomplished with Python's `time.sleep` function (don't forget to add `import time`). Example usage can be found in the `steps/phenogrid.py`.
