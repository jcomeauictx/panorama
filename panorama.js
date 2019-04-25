if (typeof(com) == "undefined") var com = {};
if (typeof(com.jcomeau) == "undefined") com.jcomeau = {};
com.jcomeau.panorama = {};
com.jcomeau.panorama.sampleSeconds = 3;  // SRTM3 data
com.jcomeau.panorama.side =
    ((60 * 60) / com.jcomeau.panorama.sampleSeconds) + 1;
com.jcomeau.panorama.increment = 1.0 / (com.jcomeau.panorama.side - 1);
/* when multiplying the fractional part of latitude or longitude to get the
 * row or column offset, the vagaries of floating point multiplication may get
 * you the cell before the one you want. so we need a correction factor
 * sufficiently large to fix that, and still sufficiently small that it will
 * not introduce a large error in the interpolated height calculation
 */
com.jcomeau.panorama.correction = com.jcomeau.panorama.increment / 10000;
// WGS-84 https://en.wikipedia.org/wiki/World_Geodetic_System
com.jcomeau.panorama.globeRadius = 6378137;  // meters at equator
com.jcomeau.panorama.degree = (com.jcomeau.panorama.globeRadius
                               * 2 * Math.PI) / 360.0;
com.jcomeau.panorama.minute = com.jcomeau.panorama.degree / 60;
com.jcomeau.panorama.second = com.jcomeau.panorama.minute / 60;
com.jcomeau.panorama.sample = com.jcomeau.panorama.second *
                              com.jcomeau.panorama.sampleSeconds;
com.jcomeau.panorama.oceanfront = true;
com.jcomeau.panorama.white = 255;
com.jcomeau.panorama.black = 0;
com.jcomeau.panorama.darkest = 15;  // black is reserved for ridge lines
com.jcomeau.panorama.opaque = 255;
com.jcomeau.panorama.palette = {
    white: [255, 255, 255, 255],
    black: [0, 0, 0, 255],
    blue: [0, 0, 255, 255],
    skyblue: [128, 128, 255, 255]
};
// the following to be initialized later
com.jcomeau.panorama.data = {};
//com.jcomeau.panorama.colormap = {};  /* don't actually set this now */
com.jcomeau.panorama.args = null;
com.jcomeau.panorama.canvas = null;
com.jcomeau.panorama.context = null;
com.jcomeau.panorama.image = null;
com.jcomeau.panorama.prefix = null;
com.jcomeau.panorama.cursor = null;
// functions
com.jcomeau.panorama.cacheData = function(url, object, prefix, callback) {
    var cjp = com.jcomeau.panorama;
    var request = new XMLHttpRequest();
    if (prefix in object && callback) {callback(); return;}
    request.open("POST", url, true);
    request.setRequestHeader("Content-Type",
        "application/x-www-form-urlencoded");
    request.responseType = "json";
    request.onload = function() {
        if (request.status == 200) {
            object[prefix] = request.response;
            if (callback) callback();
        } else console.error(request.status);
    }
    request.send("request=" + prefix);
};
com.jcomeau.panorama.alert = function(message) {
// log to console *and* to statusbox
    var cjp = com.jcomeau.panorama;
    console.log(message);
    cjp.updateStatus(message);
};
com.jcomeau.panorama.updateStatus = function(text, toBeContinued) {
    var cjp = com.jcomeau.panorama;
    var statusBox = document.getElementById("statusbox");
    var span = document.createElement("span");
    span.appendChild(document.createTextNode(text));
    if (!toBeContinued) span.appendChild(document.createElement("br"));
    statusBox.insertBefore(span, statusBox.firstChild);
};
com.jcomeau.panorama.initCanvas = function(canvasId, width, height) {
    var cjp = com.jcomeau.panorama;
    cjp.canvas = document.getElementById(canvasId);
    cjp.canvas.width = width;
    cjp.canvas.height = height;
    cjp.context = cjp.canvas.getContext("2d");
    cjp.image = cjp.context.createImageData(width, height);
    cjp.canvas.onclick = function(event) {
        var x = event.offsetX, y = event.offsetY;
        var index = y * cjp.side + x;
        var coordinates = cjp.reverseMapping(x, y);
        alert(
            "position: " + x + ", " + y +
            ", longitude offset: " + (x * cjp.increment).toFixed(6) +
            ", latitude offset: " + (1 - (y * cjp.increment)).toFixed(6) +
            ", elevation: " + cjp.data[cjp.prefix][index].toFixed(8)
        );
    };
};
com.jcomeau.panorama.showHgt = function(prefix, canvasId) {
    var cjp = com.jcomeau.panorama;
    var side = ((60 * 60) / cjp.sampleSeconds) + 1;
    cjp.initCanvas(canvasId, side, side);
    var data, i, j, index, pixels, color;
    var yellow = [255, 255, 0, 255];  // for lookup failure
    cjp.alert("getting ready to load data");
    cjp.prefix = prefix;  // kludge for now to show elevation
    pixels = cjp.data[prefix].length;
    data = cjp.image.data;
    cjp.alert("pixels=" + pixels + ", side=" + side);
    console.log("first values: " + cjp.data[prefix].slice(0, 5));
    console.log("colormap[0]: " + cjp.colormap[0]);
    for (i = 0; i < pixels; i++) {
        index = i * 4;
        color = cjp.colormap[Math.floor(cjp.data[prefix][i])] || yellow;
        for (j = 0; j < 4; j++) {
            data[index + j] = color[j];
        }
    }
    cjp.context.putImageData(cjp.image, 0, 0);
};
com.jcomeau.panorama.getargs = function() {
    var keypairs = location.search.substring(1).split("&");
    var args = {};
    for (var i = 0; i < keypairs.length; i++) {
        var parts = keypairs[i].split("=");
        args[parts[0]] = parseFloat(parts[1]);
        if (isNaN(args[parts[0]])) args[parts[0]] = parts[1];
    }
    console.log("args:", args);
    return args;
};
com.jcomeau.panorama.dms = function(degrees) {
    var cjp = com.jcomeau.panorama;
    var roundTo = cjp.sampleSeconds;
    var d, m, s;
    d = Math.floor(degrees);
    m = Math.floor((degrees - d) * 60);
    s = (degrees - d - (m / 60)) * 3600;
    roundedSeconds = (Math.floor(s) / roundTo) * roundTo;
    return [d, m, roundedSeconds];
};
com.jcomeau.panorama.decimal = function(dms) {
    var cjp = com.jcomeau.panorama;
    var d, m, s;
    d = dms[0];
    m = dms[1] / 60;
    s = dms[2] / (60 * 60);
    return d + m + s;
};
com.jcomeau.panorama.getPrefix = function(north, east) {
    const cjp = com.jcomeau.panorama;
    let n, e, key;
    if (north < 0) n = "S" + (Math.floor(Math.abs(north)) + 1);
    else n = "N" + Math.floor(north);
    if (east < 0) e = "W" + (Math.floor(Math.abs(east)) + 1);
    else e = "E" + Math.floor(east);
    return n + e;
};
com.jcomeau.panorama.getCoordinates = function(prefix, latitudeOffset,
        longitudeOffset) {
    let north, latitude, east, longitude, nextEast = 1, nextNorth = 1;
    [north, latitude, east, longitude] = prefix.match(/[A-Z]|\d+/g);
    latitude = parseFloat(latitude);
    longitude = parseFloat(longitude);
    if (latitudeOffset) latitude += latitudeOffset;
    if (longitudeOffset) longitude += longitudeOffset;
    if (north == "S") {latitude = -latitude + 1; nextNorth = -1;}
    if (east == "W") {longitude = -longitude + 1; nextEast = -1;}
    return [latitude, longitude, nextNorth, nextEast];
};
com.jcomeau.panorama.getElevationData = function(north, east) {
    var cjp = com.jcomeau.panorama;
    return cjp.data[cjp.getPrefix(north, east)];
};
com.jcomeau.panorama.indexOf = function(north, east) {
    const cjp = com.jcomeau.panorama;
    var northOffset = north - Math.trunc(north) + cjp.correction;
    var eastOffset = east - Math.trunc(east) + cjp.correction;
    var northIndex = Math.abs(Math.floor(northOffset / cjp.increment));
    if (north >= 0) northIndex = cjp.side - 1 - northIndex;
    var eastIndex = Math.abs(Math.floor(eastOffset / cjp.increment));
    if (east < 0) eastIndex = cjp.side - 1 - eastIndex;
    var index = northIndex * cjp.side + eastIndex;
    return index;
};
com.jcomeau.panorama.reverseMapping = function(prefix, x, y) {
    // determines latitude and longitude from prefix, x (column), and y(row)
};
com.jcomeau.panorama.putpixel = function(canvas, image, point, color, update) {
    const cjp = com.jcomeau.panorama;
    let [x, y] = point;
    let offset = ((y * canvas.width) + x) * 4;
    for (let i = 0; i < color.length; i++) {
        image.data[offset + i] = color[i];
    }
    if (update) {
        canvas.getContext("2d").putImageData(image, 0, 0);
    }
};
com.jcomeau.panorama.getpixel = function(canvas, image, point) {
    const cjp = com.jcomeau.panorama;
    let [x, y] = point;
    let offset = ((y * canvas.width) + x) * 4;
    return image.data.slice(offset, offset + 4);
};
com.jcomeau.panorama.panorama = function(id, latitude, longitude, bearing,
        distance, span, height) {
    const cjp = com.jcomeau.panorama;
    const canvas = document.getElementById(id);
    const canvasContext = canvas.getContext("2d");
    const radians = Math.radians(bearing), spanRadians = Math.radians(span);
    const halfspan = spanRadians / 2;
    const step = cjp.sample, move = cjp.sample;
    const viewrange = distance * 1000;  // km to meters
    const deltaBearing = Math.asin(step / viewrange)
    let angle = radians - halfspan
    /* elevations will be expressed in 3 ways:
     * 0. actual elevation above sea level;
     * 1. 'y' pixel coordinate after correcting for perspective
     *    (also for curvature if enabled in model)
     * 2. 'y' as mapped to image coordinates
     */
    const [closer, current, farther] = [0, 1, 2];
    const [raw, yCartesian, yImage] = [0, 1, 2];
    let elevations = [], elevation, theta, projected, color, ridgecolor;
    const imageHeight = 360;
    const horizon = Math.trunc(imageHeight / 2);
    // initializers for bad pixels
    const nearest = [0, -horizon, imageHeight - 1];
    const farthest = [0, 0, horizon - 1];
    height += cjp.height(latitude, longitude);
    while (angle < radians + halfspan) {
        //console.log("angle:", angle, "finished at:", radians + halfspan);
        elevations.push(cjp.look(Math.degrees(angle), latitude, longitude,
                                    distance, step)
            .map(elevation => [elevation].concat(nearest.slice(yCartesian))));
        for (let i = 1; i < elevations[elevations.length - 1].length; i++) {
            elevation = elevations[elevations.length - 1][i][raw];
            // factor in curvature if enabled
            //elevation -= earthcurvature(step * index, 'm', 'm')[1][2]
            // apparent elevation is reduced by eye height above sea level
            elevation -= height;
            let theta = Math.atan(elevation / (step * i));
            // now convert radians to projected pixels
            let projected = Math.trunc(Math.round(
                theta / Math.abs(deltaBearing)));
            elevations[elevations.length - 1][i][yCartesian] = projected;
            elevations[elevations.length - 1][i][yImage] =
                horizon - 1 - projected;
            if (false && i < 4) console.log(
                "elevation:", elevation,
                "theta:", theta,
                "projected:", projected)
        }
        angle += deltaBearing;
    }
    console.log("elevations.length:", elevations.length);
    console.log("elevations.slice(0, 5):", elevations.slice(0, 5));
    console.log("nearest:", nearest);
    canvas.width = elevations.length;
    canvas.height = imageHeight;
    let image = canvasContext.createImageData(canvas.width, canvas.height);
    // initialize to sky and ocean
    for (let y = 0; y < canvas.height; y++) {
        color = y < horizon ? cjp.palette.skyblue : cjp.palette.blue;
        for (let x = 0; x < canvas.width; x++) {
            cjp.putpixel(canvas, image, [x, y], color);
        }
    }
    for (let i = 0; i < canvas.width; i++) {
        let x = i, divider, gray, context;
        /* adding a previous level of `imageHeight` will ensure a ridge line
         * gets drawn on the most distant plot
         * adding the spot on which the observer is standing will allow
         * checking the arc of view of each point
         */
        let pointlist = elevations[i];
        let mostDistant = [null, null, imageHeight];
        pointlist = [pointlist[0]].concat(pointlist).concat([mostDistant]);
        for (let depth = pointlist.length - 2; depth > 0; depth--) {
            context = pointlist.slice(depth - 1, depth + 2);
            if (context[current][yImage] == context[closer][yImage]) {
                // carry forward the previous "farther" value
                pointlist[depth] = pointlist[depth + 1];
            } else if (context[current][yCartesian] >
                    context[closer][yCartesian]) {
                if (cjp.oceanfront && context[current][raw] == 0) {
                    color = ridgecolor = cjp.palette.blue;
                } else {
                    // farthest away shown lightest
                    // map depth values from darkest to white
                    divider = pointlist.length / (cjp.white - cjp.darkest);
                    gray = Math.trunc(depth / divider) + cjp.darkest;
                    color = [gray, gray, gray, cjp.opaque];
                    ridgecolor = cjp.palette.black;
                }
                // remember that (0, 0) is top left of canvas image
                let y = Math.max(0, context[current][yImage]);
                // mark the top of every ridge
                if (y < context[farther][yImage]) {
                    cjp.putpixel(canvas, image, [x, y], ridgecolor);
                // don't overwrite black pixel from previous ridgeline
                } else if (y > context[farther][yImage] ||
                        cjp.getpixel(canvas, image, [x, y]) != ridgecolor) {
                    cjp.putpixel(canvas, image, [x, y], color);
                }
                for (plot = y + 1; plot < context[closer][yImage] + 1; plot++) {
                    cjp.putpixel(canvas, image, [x, plot], color)
                }
            }
        }
    }
    // plot the image only once, at the end.
    // attempting plots after each scan didn't display anyway.
    canvasContext.putImageData(image, 0, 0);
};
com.jcomeau.panorama.height = function(north, east, array, correct) {
    const cjp = com.jcomeau.panorama;
    let index = cjp.indexOf(north, east);
    if (!array) array = cjp.data[cjp.getPrefix(north, east)];
    let height = array[index];
    if (correct) {
        //console.log("height before correction:", height);
        /* this is for interpolating between points, so close-by objects don't
         * appear flat when plotting the panorama and scanning over the same
         * x/y coordinate each `look`. we will only interpolate east-west, and
         * if we're at the end of the row we'll assume the slope is continuous
         * from the other direction. that is, if we're at 5 meters at x=0,
         * and array[1] is 6 meters, we'll assume the next cell west is 4.
         */
        let x = index % cjp.side;
        let decimal = east - Math.trunc(east);
        if (decimal < 0.5) {
            if (x == 0) height += decimal * (array[index + 1] - height);
            else height += decimal * (height - array[index - 1]);
        } else {
            if (x == cjp.side) height += decimal * (height - array[index - 1]);
            else height += decimal * (array[index + 1] - height);
        }
        //console.log("height:", height, "x:", x, "decimal:", decimal);
    } 
    return height;
};
com.jcomeau.panorama.makeTestData = function(prefix) {
    var cjp = com.jcomeau.panorama;
    var parts = prefix.match(/[A-Z]|\d+/g);
    var latitude, longitude;
    cjp.data[prefix] = new Array(cjp.side ** 2);
    latitude = parseFloat(parts[1]);
    if (parts[0] == "S") latitude != -1;
    longitude = parseFloat(parts[3]);
    if (parts[2] == "W") longitude != -1;
    for (var i = 0; i < cjp.side; i++) {  // rows
        for (var j = 0; j < cjp.side; j++) {  // columns
            cjp.data[prefix][i * cjp.side + j] =
                (latitude * 10000) + i + ((longitude * 10000 + j) / 100000000);
        }
    }
};
com.jcomeau.panorama.runTests = function() {
    var cjp = com.jcomeau.panorama;
    cjp.makeTestData('N0E0');
    console.log("height at (0, 0)", cjp.height(0, 0, cjp.data['N0E0']));
};
com.jcomeau.panorama.look = function(bearing, north, east, distance) {
    const cjp = com.jcomeau.panorama;
    let elevations = [], height, index, prefix;
    let traversed = 0;
    let travel = cjp.sample;
    distance *= 1000;  // km to meters
    //console.log("north:", north, "east:", east, "sample:", travel);
    radians = cjp.cartesian(bearing);
    while (traversed < distance) {
        prefix = cjp.getPrefix(north, east);
        if (!cjp.data[prefix]) {  // no data for this lat/long available
            //console.error("No data for", prefix);
            break;
        }
        index = cjp.indexOf(north, east);
        height = cjp.height(north, east, cjp.data[prefix], true);
        if (cjp.context) cjp.image.data[index * 4] = 255;  // pixel to red
        elevations.push(height);
        [north, east] = cjp.move(north, east, radians, travel);
        traversed += travel;
    }
    if (cjp.context) cjp.context.putImageData(cjp.image, 0, 0);
    return elevations;
};
com.jcomeau.panorama.cartesian = function(bearing) {
    /*
    convert compass bearing in degrees to math module bearing in radians
    
    0 (north) becomes 90 (0x, 1y), pi/2 radians
    90 (east) becomes 0  (1x, 0y), 0 radians
    180 (south) becomes -90 (0x, -1y) -pi/2 radians
    270 (west) becomes 180 (-1x, 0y), pi radians
    */
    var converted = (90 - bearing) % 360;
    if (converted > 180) converted -= 360;
    else if (converted < -180) converted += 360;
    return Math.radians(converted);
};
com.jcomeau.panorama.compass = function(bearing) {
    /* reverse of com.jcomeau.panorama.cartesian */
    bearing = Math.degrees(bearing);
    var converted = (90 - bearing) % 360;
    if (converted > 180) converted -= 360;
    else if (converted < -180) converted += 360;
    return converted;
};
com.jcomeau.panorama.move = function(latitude, longitude, radians, distance) {
    // moving `distance` meters on a fictitious equirectangular earth
    // remember Math functions assume Cartesian plane, 0 radians is to the
    // right (east)
    var cjp = com.jcomeau.panorama;
    var dx = Math.cos(radians) * (distance / cjp.degree);
    var dy = Math.sin(radians) * (distance / cjp.degree);
    return [latitude + dy, longitude + dx];
};
// initialization
window.onload = function() {
    const cjp = com.jcomeau.panorama;
    cjp.cursor = document.body.style.cursor;
    if (!("radians" in Math)) Math.radians = function(degrees) {
        return degrees * Math.PI / 180;
    };
    if (!("degrees" in Math)) Math.degrees = function(radians) {
        return radians * 180 / Math.PI;
    };
    cjp.alert("querystring: " + location.search);
    cjp.updateStatus("JavaScript started");
    cjp.runTests();
    let args = cjp.args = cjp.getargs();
    document.body.style.cursor = "wait";
    cjp.cacheData("/cgi-bin/colormap.py", cjp, "colormap", function() {
        let prefix = cjp.getPrefix(cjp.args.latitude, cjp.args.longitude);
        cjp.cacheData("/cgi-bin/fetch.py", cjp.data, prefix, function() {
            console.log("first showing map");
            cjp.showHgt(prefix, "map");
            console.log("now showing panorama");
            cjp.panorama("panorama", args.latitude, args.longitude,
                args.bearing || 0, args.distance || 120,
                args.span || 60.0, args.height || 1.5);
        });
    });
    document.body.style.cursor = cjp.cursor;
};
// vim: tabstop=8 expandtab shiftwidth=4 softtabstop=4
