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
        scale: 50000000,
        center: [-101.17, 21, 78]
    });

    var unionGeom = null;
    var layerView = null;
    view.on('click', function(evt) {
        /*//evt is the event object returned after the event fires

        //prints the map coordinates of the clicked location
        console.log(evt.mapPoint);
        //prints the screen coordinates of the clicked location
        console.log(evt.screenPoint);
        //the graphic object if a feature is clicked in the view
        console.log(evt.graphic);*/

        graphicsLayer.clear();

        view.getLayerView(featureLayer).then(function(layerView) {
            var canvas3DGraphics = layerView.getCanvas3DGraphics();

            var geoms = Object.keys(canvas3DGraphics).map(function(key) {
                return canvas3DGraphics[key].graphic.geometry;
            });

            if (!unionGeom) {
                unionGeom = geometryEngine.union(geoms);
                console.info(0);
            }

            // var filteredIndices = Object.keys(canvas3DGraphics).filter(function(key) {
            //     return geometryEngine.intersects(canvas3DGraphics[key].graphic.geometry, evt.mapPoint);
            // });

            if (true) {
                // if (filteredIndices.length) {
                // var polygonToSearch = canvas3DGraphics[filteredIndices[0]].graphic.geometry;
                geometryEngineAsync.nearestVertices(unionGeom, evt.mapPoint, 5000000, 2).then(function(vertexInfos) {
                    // geometryEngineAsync.nearestVertices(polygonToSearch, evt.mapPoint, 5000000, 2).then(function(vertexInfos) {

                    console.info(1);

                    if (vertexInfos.length === 2) {
                        // sort by vertex index for consistent 'direction'
                        vertexInfos.sort(function(o1, o2) {
                            return o1.vertexIndex - o2.vertexIndex;
                        });

                        var coordinate1 = vertexInfos[0].coordinate;
                        var coordinate2 = vertexInfos[1].coordinate;

                        var midPoint = new Point({
                            x: (coordinate1.x + coordinate2.x) / 2,
                            y: (coordinate1.y + coordinate2.y) / 2,
                            spatialReference: coordinate1.spatialReference
                        });

                        // var coastline = new Polyline({
                        //     spatialReference: coordinate1.spatialReference
                        // });
                        // coastline.addPath([coordinate1, coordinate2]);

                        var coastline = Polyline.fromJSON({
                            'paths': [
                                [
                                    [coordinate1.x, coordinate1.y],
                                    [coordinate2.x, coordinate2.y]
                                ]
                            ],
                            'spatialReference': {
                                'wkid': 102100,
                                'latestWkid': 3857
                            }
                        });

                        var wrapAroundPoint = coastline.getPoint(0, 0);
                        wrapAroundPoint.longitude = wrapAroundPoint.longitude + 360;
                        // wrapAroundPoint.latitude = wrapAroundPoint.latitude + 90;
                        coastline.setPoint(0, 1, wrapAroundPoint);
                        coastline.setPoint(0, 0, midPoint);

                        var angleDeg = Math.atan2(coordinate2.latitude - coordinate1.latitude, coordinate2.longitude - coordinate1.longitude) * 180 / Math.PI;

                        graphicsLayer.add(new Graphic({
                            geometry: coastline,
                            symbol: new SimpleLineSymbol({
                                color: [200, 0, 0],
                                width: 6
                            })
                        }));

                        graphicsLayer.add(new Graphic({
                            geometry: coordinate1,
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
                            geometry: coordinate2,
                            symbol: new SimpleMarkerSymbol({
                                color: [200, 50, 200]
                            })
                        }));



                        geometryEngineAsync.rotate(coastline, angleDeg + 90, coastline.getPoint(0, 0)).then(function(rotLine) {

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

                                leftoversGeom.paths = [leftoversGeom.paths[0]];
                                graphicsLayer.add(new Graphic({
                                    geometry: leftoversGeom,
                                    symbol: new SimpleLineSymbol({
                                        color: [200, 0, 200],
                                        width: 6
                                    })
                                }));

                                graphicsLayer.remove(tooLongGraphic);
                            });

                        });
                    }

                });
            }

        });
    });

    /*view.container.onmousemove = function(e) {
        view.hitTest(e.layerX, e.layerY).then(function(e) {
            if (e.graphic) {
                console.log(e);
            }
            // if (e.mapPoint) {

            //     e.mapPoint.z = 0;
            //     graphicsLayer.add(new Graphic({
            //         geometry: e.mapPoint,
            //         symbol: new SimpleMarkerSymbol()
            //     }));
            // }
        });
    };*/

    /*    var polyline = Polyline.fromJSON({
            'paths': [
                [
                    [-8805544.382827772, 3938155.670738265],
                    [-8805544.38282777, 23864344.522734046]
                ]
            ],
            'spatialReference': {
                'wkid': 102100,
                'latestWkid': 3857
            }
        });

        var pointSymbol = new SimpleMarkerSymbol();

        var lineSymbol = new SimpleLineSymbol({
            color: [200, 0, 0],
            width: 10
        });

        var polylineGraphic = new Graphic({
            geometry: polyline,
            symbol: lineSymbol
        });

        graphicsLayer.add(polylineGraphic);

        geometryEngineAsync.geodesicDensify(polyline, 10000).then(function(gdLine) {
            console.log(gdLine);
            var lineSymbol = new SimpleLineSymbol({
                color: [0, 200, 0],
                width: 3
            });
            var gdLineGraphic = new Graphic({
                geometry: gdLine,
                symbol: lineSymbol
            });

            graphicsLayer.add(gdLineGraphic);
        });



        // geometryEngineAsync*/

});
