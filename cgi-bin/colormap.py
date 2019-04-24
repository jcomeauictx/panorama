#!/usr/bin/python3 -OO
'''
create a colormap for loading into a Javascript object

RGB values from Wikipedia, but massaged to come out to exactly 1
'''
import sys, os, math, json, struct
from common import logging, STORAGE, init
from PIL import Image
from collections import OrderedDict

OPAQUE = 255
NONE = TRANSPARENT = BLACK = 0
COMPLETELY = OPAQUE = WHITE = 255
MAPFILE = os.path.join(STORAGE, "colormap.json")
RED = .214
GREEN = .714
BLUE = .0720

def create_colormap(view=False):
    '''
    map all expected values to a color

    -32768 means 'no data', and nothing outside of the range -1000 to +9000
    is expected.
    '''
    colormap = OrderedDict() 
    colorbytes = b''
    blueratio = math.floor(GREEN / BLUE)
    red, blue, green = NONE, COMPLETELY, COMPLETELY
    i = 0
    underwater = {}
    while green > blueratio:
        underwater[i] = (red, green, blue, OPAQUE)
        blue -= 1
        i -= 1
        if green - blue == blueratio:
            green -= 1
            blue = green
    colormap.update({k: underwater[k] for k in sorted(underwater)})
    logging.debug('colormap with underwater values: %s', colormap)
    # now compute the positive values
    blueratio = math.floor(1 / BLUE)
    redratio = math.floor(1 / RED)
    # ensure that no values are greater than 255
    maxgreen = 256 - max(blueratio, redratio)
    samples = ((i, 0, j) for i in range(redratio + 1)
               for j in range(blueratio + 1))
    brightnesses = {sample: brightness(*sample) for sample in samples
                    if brightness(*sample) < 1}
    # sorted dict https://stackoverflow.com/a/613218/493161
    pattern = OrderedDict(sorted(brightnesses.items(), key=lambda kv: kv[1]))
    logging.debug('pattern: %s', pattern)
    logging.debug('possibilities: about %d values', 256 * len(brightnesses))
    permutations = list(pattern.keys())
    colormap.update({g * len(permutations) + i + 1:
                     (permutations[i][0] + g, g, permutations[i][2] + g, OPAQUE)
                     for g in range(maxgreen)
                     for i in range(len(permutations))
                    })
    values = len(colormap)
    logging.debug('colormap length: %d', values)
    if (view):
        # display an image of the expected values
        width = height = 100
        start = -1000
        size = width * height
        colorbytes = b''.join(struct.pack('BBBB', *colormap[i])
                              for i in colormap.keys()
                              if i > start and i < size)
        testimage = Image.frombytes('RGBA', (width, height), colorbytes)
        testimage.show()
    return colormap

def clean(number):
    '''
    return as integer
    '''
    return int(round(number))

def colormap(force=False, view=False):
    '''
    return cached file or create a new one
    '''
    init()
    print('content-type: text/json\r\n\r\n', end='')
    if os.path.exists(MAPFILE) and not force:
        logging.info('returning cached color map')
        with open(MAPFILE) as infile:
            colormap = infile.read()
    else:
        logging.info('creating new color map')
        colormap = json.dumps(create_colormap(view))
        with open(MAPFILE, 'w') as outfile:
            outfile.write(colormap)
    print(colormap, end='')

def brightness(r, g, b):
    '''
    relative luminance, linear model

    if rgb specified in 0-255, result will also be 0-255
    '''
    return RED * r + GREEN * g + BLUE * b

if __name__ == '__main__':
    colormap(*sys.argv[1:])
