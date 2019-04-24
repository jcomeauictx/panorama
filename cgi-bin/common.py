#!/usr/bin/python3
'''
Common utilities for panorama CGI scripts
'''
import sys, os, cgi, logging
from tempfile import gettempdir
logging.basicConfig(level=logging.DEBUG if __debug__ else logging.INFO)

STORAGE = os.path.join(gettempdir(), 'jcomeauictx', 'panorama')

def init():
    '''
    setup for cached data
    '''
    if not os.path.exists(STORAGE):
        os.makedirs(STORAGE)

if __name__ == '__main__':
    init()
