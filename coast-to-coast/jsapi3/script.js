var map;
require([
    'esri/map',
    'esri/layers/FeatureLayer',
    'esri/layers/VectorTileLayer',

    'esri/geometry/Extent',
    'esri/geometry/geometryEngineAsync',
    'esri/geometry/mathUtils',
    'esri/geometry/Point',
    'esri/geometry/Polyline',
    'esri/graphic',

    'esri/Color',
    'esri/renderers/SimpleRenderer',
    'esri/symbols/SimpleFillSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleMarkerSymbol',

    'esri/urlUtils',

    'dojo/domReady!'
], function(
    Map, FeatureLayer, VectorTileLayer,
    Extent, geometryEngineAsync, mathUtils, Point, Polyline, Graphic,
    Color, SimpleRenderer, SimpleFillSymbol, SimpleLineSymbol, SimpleMarkerSymbol,
    urlUtils
) {
    map = new Map('map', {
        // basemap: 'dark-gray',
        // center: [0, 0],
        // zoom: 3,
        extent: new Extent({
            'xmin': -11633104.208774451,
            'ymin': -9343662.337577458,
            'xmax': 11633104.208774451,
            'ymax': 9343662.337577458,
            'spatialReference': {
                'wkid': 3857
            }
        }),
        wrapAround180: true
    });

    var vtlayer = new VectorTileLayer('//tiles.arcgis.com/tiles/UTG1M5eM6VLBcud8/arcgis/rest/services/ShorelineVectorTile_Draft/VectorTileServer');
    map.addLayer(vtlayer);

    // fill
    // http://services1.arcgis.com/wQnFk5ouCfPzTlPw/arcgis/rest/services/Coastline_90_Gray/FeatureServer/0
    // hollow
    // http://services1.arcgis.com/wQnFk5ouCfPzTlPw/arcgis/rest/services/Coastline_hollow/FeatureServer/0
    // var featureLayer = new FeatureLayer('//services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Continents/FeatureServer/0');
    var featureLayer = new FeatureLayer('//services1.arcgis.com/wQnFk5ouCfPzTlPw/arcgis/rest/services/Coastline_hollow/FeatureServer/0');

    var symbol = new SimpleFillSymbol()
        .setColor(new Color([0, 0, 0, 0]))
        .setOutline(new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0, 0, 0, 0]), 0));
        // .setOutline(new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([100, 0, 255, 0]), 2));
    var renderer = new SimpleRenderer(symbol);
    featureLayer.setRenderer(renderer);

    map.addLayer(featureLayer);

    var urlQuery = urlUtils.urlToObject(document.location.href).query;
    var debug = urlQuery !== null && typeof urlQuery === 'object' && !!urlQuery.debug;

    var pointSymbol = new SimpleMarkerSymbol();

    var lineSymbol = new SimpleLineSymbol();
    lineSymbol.setWidth(3);

    var vertexIndices = [];

    featureLayer.on('click', function(evt) {
        var polygonToSearch = evt.graphic.geometry;
        geometryEngineAsync.nearestVertices(polygonToSearch, evt.mapPoint, 5000000, 2).then(function(vertexInfos) {
            // Sort by vertex index for consistent 'direction'.
            vertexInfos.sort(function(o1, o2) {
                return o1.vertexIndex - o2.vertexIndex;
            });

            tempVertexIndices = vertexInfos.map(function(o) {
                return o.vertexIndex;
            });

            var sameVertices = isSameShallowArray(tempVertexIndices, vertexIndices);

            if (vertexInfos.length === 2 && !sameVertices) {
                // Update vertex tracking array to avoid doing this work again if it's the same as last time.
                vertexIndices = vertexInfos.map(function(o) {
                    return o.vertexIndex;
                });

                var startPoint = vertexInfos[0].coordinate;
                var endPoint = vertexInfos[1].coordinate;

                // Use Geodesy lib to calculate the midpoint location.
                var geodesyMidPoint = calculateGeodesyMethod(startPoint, endPoint, 'midpointTo');

                // Convert Geodesy result to Esri point geometry.
                var midPoint = new Point(geodesyMidPoint.lon, geodesyMidPoint.lat);

                // Calculate compass bearing from coastline midpoint to end point, and then
                //  use that value to help determine the perpendicular direction from the coast.
                var coastlineBearing = calculateGeodesyMethod(midPoint, endPoint, 'bearingTo');

                // Find the perpendicular bearing direction, but constrain between 0 to positive 360.
                var perpendicularBearing = coastlineBearing > 90 ? coastlineBearing - 90 : coastlineBearing + 270;

                // Convert the bearing to latitude values constrained to a range of +/-90.
                var rotationLatitudeBearing = bearingToLatitude(perpendicularBearing);

                // Find the rotation coordinate adjustments for the wrap around line vertices at +90 and +270 longitude.
                var rotationCoordinates = calculateRotationCoordinates(midPoint.getLatitude(), rotationLatitudeBearing);

                // Determine if the wrap around line should be oriented east or west.
                var directionToWrap = Math.abs(perpendicularBearing) < 180 ? 1 : -1;

                // Create a line at the midpoint and wrap it around the Earth.
                var wrapAroundLine = new Polyline({
                    paths: [
                        [
                            [midPoint.getLongitude(), midPoint.getLatitude()],
                            [midPoint.getLongitude() + (directionToWrap * 90) + rotationCoordinates.longitude, rotationCoordinates.latitude],
                            [midPoint.getLongitude() + (directionToWrap * 180), -midPoint.getLatitude()],
                            [midPoint.getLongitude() + (directionToWrap * 270) + rotationCoordinates.longitude, -rotationCoordinates.latitude],
                            [midPoint.getLongitude() + (directionToWrap * 360), midPoint.getLatitude()]
                        ],
                    ],
                    spatialReference: {
                        wkid: 4326
                    }
                });

                geometryEngineAsync.geodesicDensify(wrapAroundLine, 10000).then(function(gdLine) {
                    if (debug) {
                        map.graphics.clear();

                        // lineSymbol.setColor(new Color([255, 255, 100]));
                        // map.graphics.add(new Graphic(wrapAroundLine, lineSymbol));

                        lineSymbol.setColor(new Color([200, 200, 200]));
                        map.graphics.add(new Graphic(gdLine, lineSymbol));

                        /*pointSymbol.setColor(new Color([255, 0, 0]));
                        map.graphics.add(new Graphic(startPoint, pointSymbol));*/

                        pointSymbol.setColor(new Color([255, 255, 0]));
                        map.graphics.add(new Graphic(midPoint, pointSymbol));

                        /*pointSymbol.setColor(new Color([0, 255, 0]));
                        map.graphics.add(new Graphic(endPoint, pointSymbol));*/
                        
                        var oppositeYou = wrapAroundLine.paths[0][2];
                        map.graphics.add(new Graphic(new Point(oppositeYou[0], oppositeYou[1]), pointSymbol));
                    }

                    /*geometryEngineAsync.difference(gdLine, polygonToSearch).then(function(leftoversGeom) {
                        leftoversGeom.paths = [leftoversGeom.paths[0]];
                        if (debug) {
                            map.graphics.clear();
                            lineSymbol.setColor(new Color([200, 0, 200]));
                            map.graphics.add(new Graphic(leftoversGeom, lineSymbol));
                        }
                    });*/
                });

            }

        });
    });

    function isSameShallowArray(arrayA, arrayB) {
        return arrayA.length === arrayB.length &&
            arrayA.every(function(element, index) {
                return element === arrayB[index];
            });
    }

    // github.com/chrisveness/geodesy
    function calculateGeodesyMethod(esriPointA, esriPointB, geodesyMethodName) {
        var geodesyPointA = new LatLon(esriPointA.getLatitude(), esriPointA.getLongitude());
        var geodesyPointB = new LatLon(esriPointB.getLatitude(), esriPointB.getLongitude());
        return geodesyPointA[geodesyMethodName](geodesyPointB);
    }

    function bearingToLatitude(bearing) {
        // normalize 0 - 359
        bearing = bearing % 360;
        // flip sign if > 180
        // when normalized bearings > 180 will be "upside down"
        var sign = 1 - (2 * Math.floor(bearing / 180));
        // normalize 0 - 179
        bearing = bearing % 180;
        // find difference from 90
        return sign * (90 - bearing);
    }

    function calculateRotationCoordinates(initialLatitude, rotationLatitudeBearing) {
        var latitudeFraction = (initialLatitude / 90);

        var rLatitude = Math.abs((1 - Math.abs(latitudeFraction)) * rotationLatitudeBearing);
        if (rotationLatitudeBearing < 0) {
            rLatitude *= -1;
        }

        var rLongitude = latitudeFraction * rotationLatitudeBearing;

        return {
            longitude: rLongitude,
            latitude: rLatitude
        };
    }
});
