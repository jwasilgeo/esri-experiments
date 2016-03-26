require([
    "esri/Color",
    "esri/map",
    "esri/layers/FeatureLayer",
    "esri/geometry/geometryEngineAsync",
    "esri/geometry/Polyline",
    "esri/graphic",
    "esri/symbols/SimpleLineSymbol",
    "esri/symbols/SimpleMarkerSymbol",

    "dojo/domReady!"
], function(
    Color, Map, FeatureLayer, geometryEngineAsync, Polyline, Graphic, SimpleLineSymbol, SimpleMarkerSymbol
) {
    var map = new Map("map", {
        basemap: "satellite",
        center: [0, 0],
        zoom: 4
    });

    // Carbon storage of trees in Warren Wilson College.
    var featureLayer = new FeatureLayer("//services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Continents/FeatureServer/0");

    map.addLayer(featureLayer);

    var pointSymbol = new SimpleMarkerSymbol();

    var lineSymbol = new SimpleLineSymbol();
    lineSymbol.setWidth(3);

    featureLayer.on('mouse-over, mouse-out', function(e) {
        geometryEngineAsync.nearestVertices(e.graphic.geometry, e.mapPoint, 5000000, 2).then(function(vertexInfos) {
            map.graphics.clear();

            if (vertexInfos.length === 2) {
                // sort by vertex index for consistent "direction"
                vertexInfos.sort(function(o1, o2) {
                    return o1.vertexIndex - o2.vertexIndex;
                });

                var coordinate1 = vertexInfos[0].coordinate;
                var coordinate2 = vertexInfos[1].coordinate;


                var coastline = new Polyline(coordinate1.spatialReference);
                coastline.addPath([coordinate1, coordinate2]);

                lineSymbol.setColor(new Color([200, 0, 0, 1]));
                map.graphics.add(new Graphic(coastline, lineSymbol));

                pointSymbol.setColor(new Color([255, 200, 0]));
                map.graphics.add(new Graphic(coordinate1, pointSymbol));
                pointSymbol.setColor(new Color([200, 50, 200]));
                map.graphics.add(new Graphic(coordinate2, pointSymbol));
                
                geometryEngineAsync.rotate(coastline, -90).then(function(perpendicularCoastline) {
                // geometryEngineAsync.rotate(coastline, -90, e.mapPoint).then(function(perpendicularCoastline) {
                    // perpendicularCoastline.setPoint(0, 0, perpendicularCoastline.getPoint(0, 1));

                    lineSymbol.setColor(new Color([0, 200, 0, 1]));
                    map.graphics.add(new Graphic(perpendicularCoastline, lineSymbol));


                    pointSymbol.setColor(new Color([255, 200, 0]));
                    map.graphics.add(new Graphic(perpendicularCoastline.getPoint(0, 0), pointSymbol));
                    pointSymbol.setColor(new Color([200, 50, 200]));
                    map.graphics.add(new Graphic(perpendicularCoastline.getPoint(0, 1), pointSymbol));

                    // TODO:
                    // start/end the perpendicular line to wrap all the way around the world
                    // find out which opposing coastline it intersects
                });
            }

        });
    });

});
