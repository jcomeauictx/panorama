#!/usr/bin/python3
'''
Return HGT file as JSON array
'''
import sys, os, cgi, posixpath, re, zipfile, struct, math
from urllib.request import urlopen
from tempfile import gettempdir
from common import logging, STORAGE, init
from itertools import groupby

HGT_SERVER = "https://dds.cr.usgs.gov/srtm/version2_1/SRTM3/North_America"

def fetch(url):
    '''
    return arbitrary URL data
    '''
    filename = posixpath.split(url)[-1]
    logging.info('attempting to fetch %s', filename)
    filepath = os.path.join(STORAGE, filename)
    if filename.endswith(".zip"):
        unzippedname = filename[:-4]
        unzippedpath = os.path.join(STORAGE, unzippedname)
        if os.path.exists(unzippedpath):
            logging.debug('found cached content %s', unzippedpath)
            with open(unzippedpath, 'rb') as infile:
                return infile.read()
    if not os.path.exists(filepath):
        logging.info('fetching %s', url)
        with urlopen(url) as infile:
            with open(filepath, 'wb') as outfile:
                outfile.write(infile.read())
    if filename.endswith(".zip"):
        zipped = zipfile.ZipFile(filepath)
        with zipped.open(unzippedname, 'r') as datafile:  # 'rb' not accepted
            data = datafile.read()
            logging.debug('caching %s for next time', unzippedname)
            with open(unzippedpath, 'wb') as outfile:
                outfile.write(data)
            return data
    else:
        with open(filepath, 'rb') as infile:
            return infile.read()

def hgtfetch(prefix=None):
    '''
    return HGT data
    '''
    if prefix is None:
        query = cgi.FieldStorage()
        logging.debug('query: %s', dict(query))
        prefix = query.getfirst('request')
    url = posixpath.join(HGT_SERVER, prefix + ".hgt.zip")
    return fill_voids(array(fetch(url)))

def array(rawdata):
    '''
    split HGT 16-bit signed values into an integer array
    '''
    data = [struct.unpack('>h', rawdata[i:i + 2])[0]
            for i in range(0, len(rawdata), 2)]
    logging.debug('data[:10]: %s', data[:10])
    return data

def fill_voids(data):
    '''
    fill in missing (0x8000) data points

    >>> data = [0, -32768, 2, -32768, -32768, 1, 3, 3, 3]
    >>> fill_voids(data)
    [0, 1, 2, 1, 1, 1, 3, 3, 3]
    >>> data = [0, -32768, 2, 1, -32768, -32768, 3, 3, 3]
    >>> fill_voids(data)
    [0, 1, 2, 1, 1, 1, 3, 3, 3]
    >>> data = [-32768] * 9
    >>> try: fill_voids(data)
    ... except ValueError: print('failed')
    failed
    '''
    side = round(math.sqrt(len(data)))  # should work with both SRTM1 and SRTM3
    nodata = -32768  # SRTM uses 0x8000 to indicate lack of data
    for rowindex in range(side):
        #logging.debug('processing row %d of %d', rowindex, side)
        rowstart = rowindex * side
        row = data[rowstart:rowstart + side]
        count = row.count(nodata)
        #logging.debug('count of nodata in row %s: %d', row, count)
        if count == side:
            raise(ValueError('Cannot fix entire row of missing data'))
        elif count == 0:
            continue
        indices = [None, None]
        while nodata in row[indices[0]:]:
            start, increment = None, None
            indices[0] = row.index(nodata)
            runlength = find_run(row[indices[0]:])
            indices[1] = indices[0] + runlength
            #logging.debug('found run of %d', runlength)
            if indices[0] == 0:
                run = [row[indices[1]]] * runlength
            elif indices[1] == side:
                run = [row[indices[0] - 1]] * runlength
            else:
                start = row[indices[0] - 1]
                increment = (row[indices[1]] - start) / (runlength + 1)
                run = [round(start + increment) for i in range(runlength)]
            #logging.debug('rewriting row between indices %s', indices)
            row[indices[0]:indices[1]] = run
            indices[0] = indices[1]
        data[rowstart:rowstart + side] = row
    return data

def find_run(array):
    '''
    return array length in which a[n] == a[n + 1] where n = 0..len(array) - 2

    >>> find_run([0, 0, 0, 1])
    3
    >>> find_run([0, 0, 0, 0])
    4
    '''
    for key, iterator in groupby(array):
        return len(list(iterator))

if __name__ == '__main__':
    init()
    logging.debug('before cleaning: sys.argv: %s', sys.argv)
    sys.argv = [arg for arg in sys.argv if arg]
    logging.debug('after cleaning: sys.argv: %s', sys.argv)
    if len(sys.argv) == 1 or re.compile(r'^\w+$').match(sys.argv[1]):
        print('Content-type: text/json\r\n\r\n', end='')
        print(hgtfetch((sys.argv + [None])[1]), end='')
    else:
        print('Content-type: text/plain\r\n\r\n', end='')
        print(fetch(sys.argv[1]), end='')
