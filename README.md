This is a JavaScript port of my [curvature](https://github.com/jcomeauictx/curvature/) project, to make it more accessible to the nonprogrammer, and to compete
with Ulrich Deuschle's closed-source [panorama generator](http://www.udeuschle.selfhost.pro/panoramas/makepanoramas_en.htm). It still needs a lot of work, but the basic equirectangular plot is done.

# Bugs

* If you are using a distribution package for PIL, and it happens to be Pillow 5.2, you will need to remove it and install from pypi instead. On Debian,
`sudo apt-get purge python3-pil` followed by `sudo pip3 install --upgrade pillow`; see <https://github.com/python-pillow/Pillow/issues/3231>
