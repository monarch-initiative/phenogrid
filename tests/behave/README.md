* Overview

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

# Tags

These are the tags that we're currently using in the tests (in case
you want to check or remove just a subset).

- ui: tests written for the Monarch-app UI, likely Selenium
- data: tests specific to testing the sanity of Monarch data

# Install Python virtualenv

## Ubuntu 14.04 LTS

Setup the python environment in the right place.

````
sudo apt-get -u install python-virtualenv
````

## CentOS 6.6

Many distributions include virtualenv as part of the default distribution repository. However, these version can become outdated and it is usually recommended installing from a repository containing the latest release.

One common repository added to CentOS and Red Hat Enterprise Linux (RHEL) servers is the Extra Packages for Enterprise Linux (EPEL) repository. The following command will add the EPEL repository to CentOS 6 or RHEL 6.

````
sudo rpm -Uvh http://dl.fedoraproject.org/pub/epel/6/x86_64/epel-release-6-8.noarch.rpm
````

Now virtualenv, and dependencies, can be installed using the YUM package manager.

````
sudo yum -y install python-virtualenv
````

# Run the behave tests

Note: you need to have the desktop installed in order to run the tests in web browser. 

Starting from the phenogrid root directory.

````
cd tests/behave
virtualenv `pwd`
source bin/activate
pip install selenium
pip install behave
pip install jsonpath-rw
````

The products of these steps should all be hidden by the .gitirnore file.

Running all tests (the *.feature files) should be as simple as:

````
behave
````

By default, the tests will run against monarchinitiative.org, when testing in your local server, you can specify the target URL:

````
TARGET=http://localhost:8282 behave
````

# Debugging tests

It is sometimes useful to pause the tests so that you can see what Selenium sees. This can
be accomplished with Python's 'time.sleep' function:

````
import time
````

....


````
time.sleep(5)  # 5 seconds
````

You can leave the virtual environment at any time with the following command.

````
deactivate
````
