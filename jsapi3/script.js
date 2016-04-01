var map;
require([
    'esri/map',
    'esri/layers/FeatureLayer',

    /*'esri/geometry/Extent',*/
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
    Map, FeatureLayer,
    /*Extent, */
    geometryEngineAsync, mathUtils, Point, Polyline, Graphic,
    Color, SimpleRenderer, SimpleFillSymbol, SimpleLineSymbol, SimpleMarkerSymbol,
    urlUtils
) {
    map = new Map('map', {
        basemap: 'dark-gray',
        center: [0, 0],
        zoom: 3
            /*,
                    extent: new Extent({
                        "xmin": -11633104.208774451,
                        "ymin": -9343662.337577458,
                        "xmax": 11633104.208774451,
                        "ymax": 9343662.337577458,
                        "spatialReference": {
                            "wkid": 3857
                        }
                    }),
                    wrapAround180: true*/
    });

    var featureLayer = new FeatureLayer('//services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Continents/FeatureServer/0');

    var symbol = new SimpleFillSymbol()
        .setColor(null)
        .setOutline(new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([100, 0, 255]), 2));
    var renderer = new SimpleRenderer(symbol);
    featureLayer.setRenderer(renderer);

    /*featureLayer.on('load', function() {
        document.getElementsByTagName('body')[0].style.backgroundImage = 'none';
    });*/

    map.addLayer(featureLayer);

    var urlQuery = urlUtils.urlToObject(document.location.href).query;
    var debug = urlQuery !== null && typeof urlQuery === 'object' && !!urlQuery.debug;

    var pointSymbol = new SimpleMarkerSymbol();

    var lineSymbol = new SimpleLineSymbol();
    lineSymbol.setWidth(3);

    // github.com/chrisveness/geodesy
    function calculateGeodesyMethod(esriPointA, esriPointB, geodesyMethodName) {
        var geodesyPointA = new LatLon(esriPointA.getLatitude(), esriPointA.getLongitude());
        var geodesyPointB = new LatLon(esriPointB.getLatitude(), esriPointB.getLongitude());
        return geodesyPointA[geodesyMethodName](geodesyPointB);
    }

    featureLayer.on('mouse-over, mouse-out', function(e) {
        geometryEngineAsync.nearestVertices(e.graphic.geometry, e.mapPoint, 5000000, 2).then(function(vertexInfos) {
            map.graphics.clear();

            if (vertexInfos.length === 2) {
                // sort by vertex index for consistent 'direction'
                vertexInfos.sort(function(o1, o2) {
                    return o1.vertexIndex - o2.vertexIndex;
                });

                var startPoint = vertexInfos[0].coordinate;
                var endPoint = vertexInfos[1].coordinate;

                // Use Geodesy lib to calculate the midpoint location.
                var geodesyMidPoint = calculateGeodesyMethod(startPoint, endPoint, 'midpointTo');

                // Convert Geodesy result to Esri point geometry.
                var midPoint = new Point(geodesyMidPoint.lon, geodesyMidPoint.lat);

                // Calculate compass bearing from coastline midpoint to end point, and then
                //  use that value to help determine the perpendicular direction from the coast.
                var compassBearing = calculateGeodesyMethod(midPoint, endPoint, 'bearingTo') - 90;

                // Convert the bearing to latitude values constrained to a range of +/-90.
                var rotationLatitude = 0;

                // Create a line at the midpoint and wrap it around the Earth.
                var wrapAroundLine = new Polyline({
                    paths: [
                        [
                            [midPoint.getLongitude(), midPoint.getLatitude()],
                            [midPoint.getLongitude() + 90, rotationLatitude],
                            [midPoint.getLongitude() + 180, -midPoint.getLatitude()],
                            [midPoint.getLongitude() + 270, -rotationLatitude],
                            [midPoint.getLongitude() + 360, midPoint.getLatitude()]
                        ],
                    ],
                    spatialReference: {
                        wkid: 4326
                    }
                });


                geometryEngineAsync.geodesicDensify(wrapAroundLine, 10000).then(function(gdLine) {

                    if (debug) {
                        lineSymbol.setColor(new Color([255, 255, 100]));
                        map.graphics.add(new Graphic(wrapAroundLine, lineSymbol));

                        lineSymbol.setColor(new Color([200, 200, 200]));
                        map.graphics.add(new Graphic(gdLine, lineSymbol));

                        pointSymbol.setColor(new Color([255, 0, 0]));
                        map.graphics.add(new Graphic(startPoint, pointSymbol));

                        pointSymbol.setColor(new Color([255, 255, 0]));
                        map.graphics.add(new Graphic(midPoint, pointSymbol));

                        pointSymbol.setColor(new Color([0, 255, 0]));
                        map.graphics.add(new Graphic(endPoint, pointSymbol));
                    }
                });

            }

        });
    });

});
