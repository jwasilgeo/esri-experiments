var mapView, sceneView;
require([
    'esri/geometry/geometryEngine',
    'esri/geometry/geometryEngineAsync',
    'esri/geometry/Point',
    'esri/geometry/Polyline',
    'esri/Graphic',
    'esri/layers/FeatureLayer',
    'esri/layers/GraphicsLayer',
    'esri/Map',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/views/SceneView',

    'dojo/domReady!'
], function(
    geometryEngine, geometryEngineAsync, Point, Polyline, Graphic, FeatureLayer, GraphicsLayer, Map, SimpleLineSymbol, SimpleMarkerSymbol, SceneView
) {
    // fill
    // http://services1.arcgis.com/wQnFk5ouCfPzTlPw/arcgis/rest/services/Coastline_90_Gray/FeatureServer/0
    // hollow
    // http://services1.arcgis.com/wQnFk5ouCfPzTlPw/arcgis/rest/services/Coastline_hollow/FeatureServer/0
    var featureLayer = new FeatureLayer({
        // url: '//services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Continents/FeatureServer/0'
        url: '//services1.arcgis.com/wQnFk5ouCfPzTlPw/arcgis/rest/services/Coastline_hollow/FeatureServer/0'
    });
    featureLayer.then(function(layer) {
        layer.renderer.symbol.color = null;
        layer.renderer.symbol.outline.width = 2;
        // layer.renderer.symbol.outline.color = [100, 0, 255];
        layer.generalizeForScale = 1000000;
    });

    var graphicsLayer = new GraphicsLayer();

    var map = new Map({
        basemap: 'dark-gray',
        layers: [featureLayer, graphicsLayer]
    });

    sceneView = new SceneView({
        container: 'sceneViewDiv',
        map: map,
        center: [0, 0],
        zoom: 4
    });

    var layerView = null;
    // var unionGeom = true; // TODO: return to falsy when/if the uioned geoms are still needed
    var vertexIndices = [];

    sceneView.whenLayerView(featureLayer)
        .then(function(layerView) {
            // The layerview for the layer
            sceneView.on('click', function(evt) {
                checkAnalysisDependencies(layerView, evt.mapPoint);
            });

            // simulate a view 'mouse-move' listener
            /*sceneView.container.addEventListener('mousemove', function(mouseEvt) {
                sceneView.hitTest(mouseEvt.layerX, mouseEvt.layerY).then(function(response) {
                    // a hitTest appears to fire on a 'click' as well
                    checkAnalysisDependencies(layerView, response.results[0].mapPoint);
                });
            });*/
        })
        .otherwise(function(error) {
            // An error occurred during the layerview creation
            console.error(error);
        });

    function checkAnalysisDependencies(layerView, mapPoint) {
        var canvas3DGraphics = layerView.getGraphics3DGraphics();

        var geoms = Object.keys(canvas3DGraphics).map(function(key) {
            return canvas3DGraphics[key].graphic.geometry;
        });

        // if (!unionGeom) {
        //     unionGeom = geometryEngineAsync.union(geoms).then(function(geoms) {
        //         unionGeom = geoms;

        //         console.info('union preprocessing complete');

        //         performAnalysis(canvas3DGraphics, mapPoint, unionGeom);
        //     });
        // } else {
        performAnalysis(canvas3DGraphics, mapPoint);
        // }
    }

    function performAnalysis(canvas3DGraphics, mapPoint) {
        var filteredIndices = Object.keys(canvas3DGraphics).filter(function(key) {
            return geometryEngine.intersects(canvas3DGraphics[key].graphic.geometry, mapPoint);
        });

        if (filteredIndices.length) {
            var polygonToSearch = canvas3DGraphics[filteredIndices[0]].graphic.geometry;
            geometryEngineAsync.nearestVertices(polygonToSearch, mapPoint, 500000, 2).then(function(vertexInfos) {
                console.info('nearest coastline vertices found');

                // Sort by vertex index for consistent 'direction'.
                vertexInfos.sort(function(o1, o2) {
                    return o1.vertexIndex - o2.vertexIndex;
                });

                tempVertexIndices = vertexInfos.map(function(o) {
                    return o.vertexIndex;
                });

                var sameVertices = isSameShallowArray(tempVertexIndices, vertexIndices);

                if (vertexInfos.length === 2 && !sameVertices) {
                    console.info('continuing analysis because nearest coastline vertices are different');

                    // Update vertex tracking array to avoid doing this work again if it's the same as last time.
                    vertexIndices = vertexInfos.map(function(o) {
                        return o.vertexIndex;
                    });

                    var startPoint = vertexInfos[0].coordinate;
                    var endPoint = vertexInfos[1].coordinate;

                    // Use Geodesy lib to calculate the midpoint location.
                    var geodesyMidPoint = calculateGeodesyMethod(startPoint, endPoint, 'midpointTo');

                    // Convert Geodesy result to Esri point geometry.
                    var midPoint = new Point({
                        longitude: geodesyMidPoint.lon,
                        latitude: geodesyMidPoint.lat,
                        spatialReference: startPoint.spatialReference
                    });

                    // Calculate compass bearing from coastline midpoint to end point, and then
                    //  use that value to help determine the perpendicular direction from the coast.
                    var coastlineBearing = calculateGeodesyMethod(midPoint, endPoint, 'bearingTo');

                    // Find the perpendicular bearing direction, but constrain between 0 to positive 360.
                    var perpendicularBearing = coastlineBearing > 90 ? coastlineBearing - 90 : coastlineBearing + 270;

                    // Convert the bearing to latitude values constrained to a range of +/-90.
                    var rotationLatitudeBearing = bearingToLatitude(perpendicularBearing);

                    // Find the rotation coordinate adjustments for the wrap around line vertices at +90 and +270 longitude.
                    var rotationCoordinates = calculateRotationCoordinates(midPoint.latitude, rotationLatitudeBearing);

                    console.info(coastlineBearing, perpendicularBearing, rotationLatitudeBearing);
                    console.info(rotationCoordinates.longitude, rotationCoordinates.latitude);

                    // Determine if the wrap around line should be oriented east or west.
                    var directionToWrap = Math.abs(perpendicularBearing) < 180 ? 1 : -1;

                    // Create a line at the midpoint and wrap it around the Earth.
                    var wrapAroundLine = new Polyline({
                        paths: [
                            [
                                [midPoint.longitude, midPoint.latitude],
                                [midPoint.longitude + (directionToWrap * 90) + rotationCoordinates.longitude, rotationCoordinates.latitude],
                                [midPoint.longitude + (directionToWrap * 180), -midPoint.latitude],
                                [midPoint.longitude + (directionToWrap * 270) + rotationCoordinates.longitude, -rotationCoordinates.latitude],
                                [midPoint.longitude + (directionToWrap * 360), midPoint.latitude]
                            ],
                        ],
                        spatialReference: {
                            wkid: 4326
                        }
                    });


                    // Geodetically densify the wrap around line.
                    geometryEngineAsync.geodesicDensify(wrapAroundLine, 10000).then(function(gdLine) {
                        graphicsLayer.removeAll();

                        /*graphicsLayer.add(new Graphic({
                            geometry: wrapAroundLine,
                            symbol: new SimpleLineSymbol({
                                color: [255, 255, 100],
                                width: 6
                            })
                        }));*/

                        var red = 0;
                        var green = 250;
                        wrapAroundLine.paths[0].forEach(function(vertex, idx) {
                            // if (idx === 2) {
                            graphicsLayer.add(new Graphic({
                                geometry: new Point(vertex[0], vertex[1]),
                                symbol: new SimpleMarkerSymbol({
                                    color: [red, green, 0]
                                })
                            }));
                            red += 75;
                            green -= 75;
                            // }
                        });

                        graphicsLayer.add(new Graphic({
                            geometry: gdLine,
                            symbol: new SimpleLineSymbol({
                                color: [200, 200, 200],
                                width: 6
                            })
                        }));

                        /*graphicsLayer.add(new Graphic({
                            geometry: startPoint,
                            symbol: new SimpleMarkerSymbol({
                                color: [255, 0, 0]
                            })
                        }));*/

                        graphicsLayer.add(new Graphic({
                            geometry: midPoint,
                            symbol: new SimpleMarkerSymbol({
                                color: [255, 255, 0]
                            })
                        }));

                        /*graphicsLayer.add(new Graphic({
                            geometry: endPoint,
                            symbol: new SimpleMarkerSymbol({
                                color: [0, 255, 0]
                            })
                        }));*/

                        return;
                        // Split the wrapped around and rotated line by any intersecting continents.
                        geometryEngineAsync.difference(gdLine, polygonToSearch).then(function(leftoversGeom) {

                            console.info('line differencing complete');

                            // Only keep the first difference line segment,
                            //  which whould be the path across the ocean to the opposing coast.
                            leftoversGeom.paths = [leftoversGeom.paths[0]];
                            // leftoversGeom.paths = [leftoversGeom.paths.slice(leftoversGeom.paths.length-1)];

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

                            // graphicsLayer.remove(gdLineGraphic);
                        });

                    });
                }

            });

        }

    }

    function isSameShallowArray(arrayA, arrayB) {
        return arrayA.length === arrayB.length &&
            arrayA.every(function(element, index) {
                return element === arrayB[index];
            });
    }

    // github.com/chrisveness/geodesy
    function calculateGeodesyMethod(esriPointA, esriPointB, geodesyMethodName) {
        var geodesyPointA = new LatLon(esriPointA.latitude, esriPointA.longitude);
        var geodesyPointB = new LatLon(esriPointB.latitude, esriPointB.longitude);
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
