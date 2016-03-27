var map;
require([
    'esri/map',
    'esri/layers/FeatureLayer',

    /*'esri/geometry/Extent',*/
    'esri/geometry/geometryEngineAsync',
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
    /*Extent, */geometryEngineAsync, Polyline, Graphic,
    Color, SimpleRenderer, SimpleFillSymbol, SimpleLineSymbol, SimpleMarkerSymbol,
    urlUtils
) {
    map = new Map('map', {
        basemap: 'dark-gray',
        center: [0, 0],
        zoom: 3/*,
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

    featureLayer.on('mouse-over, mouse-out', function(e) {
        geometryEngineAsync.nearestVertices(e.graphic.geometry, e.mapPoint, 5000000, 2).then(function(vertexInfos) {
            map.graphics.clear();

            if (vertexInfos.length === 2) {
                // sort by vertex index for consistent 'direction'
                vertexInfos.sort(function(o1, o2) {
                    return o1.vertexIndex - o2.vertexIndex;
                });

                var coordinate1 = vertexInfos[0].coordinate;
                var coordinate2 = vertexInfos[1].coordinate;

                var coastline = new Polyline(coordinate1.spatialReference);
                coastline.addPath([coordinate1, coordinate2]);

                if (debug) {
                    lineSymbol.setColor(new Color([200, 0, 0, 1]));
                    map.graphics.add(new Graphic(coastline, lineSymbol));

                    pointSymbol.setColor(new Color([255, 200, 0]));
                    map.graphics.add(new Graphic(coordinate1, pointSymbol));

                    pointSymbol.setColor(new Color([200, 50, 200]));
                    map.graphics.add(new Graphic(coordinate2, pointSymbol));
                }

                geometryEngineAsync.rotate(coastline, -90).then(function(perpendicularCoastline) {
                    // geometryEngineAsync.rotate(coastline, -90, e.mapPoint).then(function(perpendicularCoastline) {

                    // var wrapAroundPoint = perpendicularCoastline.getPoint(0, 0);
                    // wrapAroundPoint.setLongitude(wrapAroundPoint.getLongitude() + 360);
                    // wrapAroundPoint.setLatitude(wrapAroundPoint.getLatitude() + 180);
                    // perpendicularCoastline.setPoint(0, 0, wrapAroundPoint);

                    if (debug) {
                        lineSymbol.setColor(new Color([0, 200, 0, 1]));
                        map.graphics.add(new Graphic(perpendicularCoastline, lineSymbol));

                        pointSymbol.setColor(new Color([255, 200, 0]));
                        map.graphics.add(new Graphic(perpendicularCoastline.getPoint(0, 0), pointSymbol));

                        pointSymbol.setColor(new Color([200, 50, 200]));
                        map.graphics.add(new Graphic(perpendicularCoastline.getPoint(0, 1), pointSymbol));
                    }

                    // TODO:
                    // start/end the perpendicular line to wrap all the way around the world
                    // find out which opposing coastline it intersects
                });
            }

        });
    });

});
