var view;
require([
    'esri/Map',
    'esri/views/SceneView',
    'esri/layers/GraphicsLayer',
    'esri/layers/FeatureLayer',
    'esri/geometry/geometryEngine',
    'esri/geometry/geometryEngineAsync',
    'esri/geometry/Polyline',
    'esri/geometry/Point',
    'esri/Graphic',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleMarkerSymbol',
    'dojo/domReady!'
], function(
    Map, SceneView, GraphicsLayer, FeatureLayer, geometryEngine, geometryEngineAsync, Polyline, Point, Graphic, SimpleLineSymbol, SimpleMarkerSymbol
) {
    var featureLayer = new FeatureLayer({
        url: '//services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Continents/FeatureServer/0'
    });
    featureLayer.then(function(layer) {
        layer.renderer.symbol.color = null;
        layer.renderer.symbol.outline.width = 3;
        layer.renderer.symbol.outline.color = [100, 0, 255];
        layer.generalizeForScale = 1000000;
    });

    var graphicsLayer = new GraphicsLayer();

    var map = new Map({
        basemap: 'dark-gray',
        layers: [featureLayer, graphicsLayer]
    });

    view = new SceneView({
        container: 'viewDiv',
        map: map,
        // scale: 50000000,
        center: [0, 0],
        zoom: 4.5
    });

    var layerView = null;
    var unionGeom = null;

    view.on('click', function(evt) {
        if (!layerView) {
            view.getLayerView(featureLayer).then(function(layerViewResults) {
                layerView = layerViewResults;
                checkAnalysisDependencies(layerView, evt.mapPoint);
            });
        } else {
            checkAnalysisDependencies(layerView, evt.mapPoint);
        }
    });

    function checkAnalysisDependencies(layerView, mapPoint) {
        graphicsLayer.clear();

        var canvas3DGraphics = layerView.getCanvas3DGraphics();

        var geoms = Object.keys(canvas3DGraphics).map(function(key) {
            return canvas3DGraphics[key].graphic.geometry;
        });

        if (!unionGeom) {
            unionGeom = geometryEngineAsync.union(geoms).then(function(geoms) {
                unionGeom = geoms;
                
                console.info(0);

                performAnalysis(canvas3DGraphics, mapPoint, unionGeom);
            });
        } else {
            performAnalysis(canvas3DGraphics, mapPoint, unionGeom);
        }
    }

    function performAnalysis(canvas3DGraphics, mapPoint) {
        var filteredIndices = Object.keys(canvas3DGraphics).filter(function(key) {
            return geometryEngine.intersects(canvas3DGraphics[key].graphic.geometry, mapPoint);
        });

        if (filteredIndices.length) {
            var polygonToSearch = canvas3DGraphics[filteredIndices[0]].graphic.geometry;
            geometryEngineAsync.nearestVertices(polygonToSearch, mapPoint, 5000000, 2).then(function(vertexInfos) {

                console.info(1);

                if (vertexInfos.length === 2) {
                    // sort by vertex index for consistent coastline direction
                    vertexInfos.sort(function(o1, o2) {
                        return o1.vertexIndex - o2.vertexIndex;
                    });

                    var startPoint = vertexInfos[0].coordinate;
                    var endPoint = vertexInfos[1].coordinate;

                    var midPoint = new Point({
                        x: (startPoint.x + endPoint.x) / 2,
                        y: (startPoint.y + endPoint.y) / 2,
                        spatialReference: startPoint.spatialReference
                    });

                    var wrapAroundLine = new Polyline({
                        paths: [
                            [
                                [midPoint.x, midPoint.y],
                                [midPoint.x, midPoint.y]
                            ]
                        ],
                        spatialReference: startPoint.spatialReference
                    });

                    var wrapAroundPoint = wrapAroundLine.getPoint(0, 1);
                    wrapAroundPoint.longitude += 360;
                    wrapAroundLine.setPoint(0, 1, wrapAroundPoint);

                    graphicsLayer.add(new Graphic({
                        geometry: wrapAroundLine,
                        symbol: new SimpleLineSymbol({
                            color: [200, 0, 0],
                            width: 6
                        })
                    }));

                    graphicsLayer.add(new Graphic({
                        geometry: startPoint,
                        symbol: new SimpleMarkerSymbol({
                            color: [255, 200, 0]
                        })
                    }));

                    graphicsLayer.add(new Graphic({
                        geometry: midPoint,
                        symbol: new SimpleMarkerSymbol({
                            color: [100, 200, 0]
                        })
                    }));

                    graphicsLayer.add(new Graphic({
                        geometry: endPoint,
                        symbol: new SimpleMarkerSymbol({
                            color: [200, 50, 200]
                        })
                    }));

                    // https://github.com/chrisveness/geodesy
                    // calculate bearing from coastline midpoint to 2nd point
                    // use bearing to determine the perpendicular direction from the coast
                    var geodesyPoint1 = new LatLon(midPoint.latitude, midPoint.longitude);
                    var geodesyPoint2 = new LatLon(endPoint.latitude, endPoint.longitude);
                    var bearing = geodesyPoint1.bearingTo(geodesyPoint2);
                    geometryEngineAsync.rotate(wrapAroundLine, (180 - bearing), wrapAroundLine.getPoint(0, 0)).then(function(rotLine) {

                        console.info(2);

                        var tooLongGraphic = new Graphic({
                            geometry: rotLine,
                            symbol: new SimpleLineSymbol({
                                color: [0, 0, 200],
                                width: 6
                            })
                        });
                        graphicsLayer.add(tooLongGraphic);

                        geometryEngineAsync.difference(rotLine, unionGeom).then(function(leftoversGeom) {

                            console.info(3);

                            // only keep the first difference line segment,
                            // which whould be the path across the ocean to the opposing coast
                            leftoversGeom.paths = [leftoversGeom.paths[0]];

                            graphicsLayer.add(new Graphic({
                                geometry: leftoversGeom,
                                symbol: new SimpleLineSymbol({
                                    color: [200, 0, 200],
                                    width: 6
                                })
                            }));

                            graphicsLayer.add(new Graphic({
                                geometry: leftoversGeom.getPoint(0, leftoversGeom.paths[0].length - 1),
                                symbol: new SimpleMarkerSymbol({
                                    color: [200, 0, 200]
                                })
                            }));

                            // graphicsLayer.remove(tooLongGraphic);
                        });

                    });
                }

            });

        }

    }

});
